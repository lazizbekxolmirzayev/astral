import { BODIES, SI_EXACT } from '../constants';
import type { Quantity } from '../models/quantity';
import { toBase, valueIn } from '../units';
import type { LaunchSite } from '../models/catalog';
import type { AssumptionReader } from './assumptions';
import { derive, marginOf, type Derived } from './derived';
import { circularSpeed, describeOrbit, visViva } from './orbit';
import type { ResolvedDesign } from './resolve';

export type DeltaVStep = { id: 'orbit-insertion' | 'trajectory-corrections' | 'stationkeeping'; value: Derived };

export type DeltaVResult = {
  steps: DeltaVStep[];
  /** Sum of the steps, before margin. */
  subtotal: Derived;
  /** Subtotal × (1 + margin). */
  required: Derived;
  /** Tsiolkovsky Δv of the loaded spacecraft. Zero without propulsion or propellant. */
  available: Derived;
  margin: number;
  /** Propellant that `required` needs for this dry mass; null when there is no propulsion to size it with. */
  requiredPropellant: Derived | null;
  /** Departure energy the transfer needs and the launch target provides (escape targets only). */
  departureC3: { required: Derived; provided: Derived } | null;
  /** The propulsion cannot make impulsive burns, but the trajectory needs some. */
  impulsiveBurnsImpossible: boolean;
  /**
   * What the launch site's inclination corridor does to an Earth-orbit mission; null for
   * escape targets, where the site's inclination does not enter the model.
   */
  site: {
    /** Inclination the launcher can deliver directly: the desired one, clamped into the site's corridor. */
    deliveryInclinationDeg: number;
    /** How far the desired inclination lies outside the corridor, degrees; 0 when it can be flown directly. */
    shortfallDeg: number;
    /** Extra Δv the plane change costs, compared with launching straight into the desired inclination. */
    extra: Derived;
  } | null;
};

/** Inclination (degrees) a launch from `site` can deliver directly when `desiredDeg` is wanted: the desired value clamped into the corridor. */
export function deliveryInclinationDeg(site: LaunchSite, desiredDeg: number): number {
  const min = valueIn(site.inclinationRange.min, 'deg');
  const max = valueIn(site.inclinationRange.max, 'deg');
  return Math.min(max, Math.max(min, desiredDeg));
}

/** Tsiolkovsky rocket equation: Δv = Isp · g0 · ln(m0 / mf). Masses in kg, result in m/s. */
export function rocketDeltaV(ispSeconds: number, initialMassKg: number, finalMassKg: number): number {
  if (!(finalMassKg > 0) || initialMassKg < finalMassKg) return 0;
  return ispSeconds * SI_EXACT.standardGravityMS2 * Math.log(initialMassKg / finalMassKg);
}

/** Inverse of the rocket equation: propellant needed to give a spacecraft of final mass `finalMassKg` a Δv. */
export function propellantForDeltaV(ispSeconds: number, finalMassKg: number, deltaV: number): number {
  return finalMassKg * (Math.exp(deltaV / (ispSeconds * SI_EXACT.standardGravityMS2)) - 1);
}

/**
 * Two-impulse transfer between circular orbits of radius r1 and r2, with an optional
 * inclination change `planeChange` (radians) merged into the burn at the higher orbit,
 * where it is cheapest.
 */
export function hohmannWithPlaneChange(gm: number, r1: number, r2: number, planeChange: number): number {
  const low = Math.min(r1, r2);
  const high = Math.max(r1, r2);
  const a = (low + high) / 2;
  const vHighCircular = circularSpeed(gm, high);
  const vHighTransfer = visViva(gm, high, a);
  const atHigh = Math.sqrt(vHighTransfer ** 2 + vHighCircular ** 2 - 2 * vHighTransfer * vHighCircular * Math.cos(planeChange));
  const atLow = low === high ? 0 : Math.abs(visViva(gm, low, a) - circularSpeed(gm, low));
  return atHigh + atLow;
}

/** Burn at periapsis radius `rp` that captures an approach with excess speed `vInf` into an orbit of semi-major axis `a`. */
export function captureBurn(gm: number, rp: number, a: number, vInf: number): number {
  return Math.sqrt(vInf ** 2 + (2 * gm) / rp) - visViva(gm, rp, a);
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

type Insertion = { value: number; inputs: Quantity[]; basis: string; departure?: { requiredM2S2: number; providedM2S2: number; inputs: Quantity[] } };

/** `deliveryDeg` overrides the inclination the launch delivers (used to price the site's plane change). */
function insertion(design: ResolvedDesign, assume: AssumptionReader, deliveryDeg?: number): Insertion {
  const { destination, deliveryTarget, mission } = design;
  const body = BODIES[destination.centralBody];
  const gm = toBase(body.gm);
  const bodyInputs = [body.gm, body.radius];
  const target = describeOrbit(destination.centralBody, mission.orbit);

  if (destination.id === 'leo' || destination.id === 'sso') {
    if (deliveryTarget.kind !== 'orbit') throw new Error(`${destination.id} must be served by an orbit delivery target`);
    const delivery = describeOrbit(deliveryTarget.centralBody, deliveryTarget);
    const delivered = deliveryDeg ?? deliveryInclinationDeg(design.site, mission.orbit.inclinationDeg);
    const planeChange = Math.abs(toRad(mission.orbit.inclinationDeg - delivered));
    return {
      value: hohmannWithPlaneChange(gm, delivery.semiMajorAxis, target.semiMajorAxis, planeChange),
      inputs: bodyInputs,
      basis: 'Hohmann transfer between circular orbits at the mean radii, plane change merged into the burn at the higher orbit',
    };
  }

  if (destination.id === 'geo') {
    if (deliveryTarget.kind !== 'orbit') throw new Error('geo must be served by an orbit delivery target');
    const gto = describeOrbit(deliveryTarget.centralBody, deliveryTarget);
    const delivered = deliveryDeg ?? deliveryInclinationDeg(design.site, mission.orbit.inclinationDeg);
    const planeChange = Math.abs(toRad(mission.orbit.inclinationDeg - delivered));
    // Circularise (and remove the inclination) at the transfer orbit's apoapsis, then Hohmann to the final radius if it differs.
    const vApogee = visViva(gm, gto.apoapsisRadius, gto.semiMajorAxis);
    const vCircular = circularSpeed(gm, gto.apoapsisRadius);
    const circularise = Math.sqrt(vApogee ** 2 + vCircular ** 2 - 2 * vApogee * vCircular * Math.cos(planeChange));
    const adjust = gto.apoapsisRadius === target.semiMajorAxis ? 0 : hohmannWithPlaneChange(gm, gto.apoapsisRadius, target.semiMajorAxis, 0);
    return { value: circularise + adjust, inputs: bodyInputs, basis: 'apogee burn from the transfer orbit that circularises and changes the inclination in one manoeuvre' };
  }

  if (destination.id === 'moon') {
    const vInf = assume.value('moon-arrival-vinf');
    return {
      value: captureBurn(gm, target.periapsisRadius, target.semiMajorAxis, vInf),
      inputs: [...bodyInputs, assume.quantity('moon-arrival-vinf')],
      basis: 'capture burn at periapsis: √(v∞² + 2μ/rp) − v_orbit(rp)',
    };
  }

  if (destination.id === 'helio') {
    if (deliveryTarget.kind !== 'escape') throw new Error('helio must be served by an escape delivery target');
    const sunBody = BODIES.sun;
    const earthOrbit = BODIES.earth.orbit;
    if (!earthOrbit) throw new Error('Earth needs heliocentric orbit data');
    const gmSun = toBase(sunBody.gm);
    const rE = toBase(earthOrbit.semiMajorAxis);
    const vE = circularSpeed(gmSun, rE);
    const { periapsisRadius: rp, apoapsisRadius: ra, semiMajorAxis: aOrbit } = target;
    const inclination = toRad(mission.orbit.inclinationDeg);
    const solarInputs = [sunBody.gm, sunBody.radius, earthOrbit.semiMajorAxis];
    const provided = { providedM2S2: toBase(deliveryTarget.c3) };
    if (rp <= rE && rE <= ra) {
      // The target orbit crosses Earth's orbit: the launcher can inject straight onto it where the two meet.
      const eccentricity = (ra - rp) / (ra + rp);
      const vTangential = Math.sqrt(gmSun * aOrbit * (1 - eccentricity ** 2)) / rE;
      const vRadialSquared = Math.max(0, visViva(gmSun, rE, aOrbit) ** 2 - vTangential ** 2);
      const vInfSquared = vRadialSquared + vTangential ** 2 + vE ** 2 - 2 * vTangential * vE * Math.cos(inclination);
      return {
        value: 0,
        inputs: solarInputs,
        basis: 'the orbit crosses Earth\'s orbit, so the launcher injects directly onto it; v∞² = v_r² + v_t² + v_E² − 2·v_t·v_E·cos(i)',
        departure: { requiredM2S2: vInfSquared, ...provided, inputs: [...solarInputs, deliveryTarget.c3] },
      };
    }
    // The orbit lies wholly inside or outside Earth's. The launcher puts the spacecraft on a Hohmann-type ellipse between
    // Earth's orbit and the target orbit's nearer extreme (perihelion if inside, aphelion if outside); the spacecraft then
    // burns at that extreme to turn the ellipse into the target orbit. The limit of an orbit touching 1 AU is the crossing case above.
    const rApsis = ra < rE ? rp : ra;
    const aTransfer = (rE + rApsis) / 2;
    const vDeparture = visViva(gmSun, rE, aTransfer);
    const vInfSquared = vDeparture ** 2 + vE ** 2 - 2 * vDeparture * vE * Math.cos(inclination);
    return {
      value: Math.abs(visViva(gmSun, rApsis, aTransfer) - visViva(gmSun, rApsis, aOrbit)),
      inputs: solarInputs,
      basis: 'Hohmann-type ellipse from Earth\'s orbit to the target orbit\'s nearer extreme, then a burn there that reshapes it into the target orbit',
      departure: { requiredM2S2: vInfSquared, ...provided, inputs: [...solarInputs, deliveryTarget.c3] },
    };
  }

  // Mars: Hohmann transfer between circular, coplanar planetary orbits around the Sun.
  const sun = BODIES.sun;
  const earth = BODIES.earth.orbit;
  const mars = BODIES.mars.orbit;
  if (!earth || !mars) throw new Error('Earth and Mars need heliocentric orbit data');
  const gmSun = toBase(sun.gm);
  const rE = toBase(earth.semiMajorAxis);
  const rM = toBase(mars.semiMajorAxis);
  const aTransfer = (rE + rM) / 2;
  const vInfDeparture = visViva(gmSun, rE, aTransfer) - circularSpeed(gmSun, rE);
  const vInfArrival = circularSpeed(gmSun, rM) - visViva(gmSun, rM, aTransfer);
  const solarInputs = [sun.gm, earth.semiMajorAxis, mars.semiMajorAxis];
  if (deliveryTarget.kind !== 'escape') throw new Error('mars must be served by an escape delivery target');
  return {
    value: captureBurn(gm, target.periapsisRadius, target.semiMajorAxis, vInfArrival),
    inputs: [...bodyInputs, ...solarInputs],
    basis: 'Hohmann Earth–Mars transfer (circular, coplanar planet orbits) gives v∞ at Mars; capture burn at periapsis',
    departure: { requiredM2S2: vInfDeparture ** 2, providedM2S2: toBase(deliveryTarget.c3), inputs: [...solarInputs, deliveryTarget.c3] },
  };
}

/** Δv requirement and Δv capability. See the delta-v and transfer-approximation cards. */
export function computeDeltaV(design: ResolvedDesign, assume: AssumptionReader, launchMassKg: number): DeltaVResult {
  const { mission, destination, propulsion, deliveryTarget } = design;
  const model = 'delta-v' as const;
  const transferModel = 'transfer-approximation' as const;

  const entry = insertion(design, assume);
  const insertionStep = derive(entry.value, 'm/s', transferModel, entry.basis, entry.inputs);

  const correctionId = destination.id === 'moon' ? 'delta-v-correction-moon' : destination.id === 'mars' ? 'delta-v-correction-mars' : destination.id === 'helio' ? 'delta-v-correction-helio' : null;
  const corrections = correctionId
    ? derive(assume.value(correctionId), 'm/s', model, 'reserve for trajectory corrections', [assume.quantity(correctionId)])
    : derive(0, 'm/s', model, 'no trajectory corrections for a launch directly into Earth orbit');

  const years = mission.plannedOperationsDays / (toBase({ value: 1, unit: 'yr' }) / 86_400);
  const stationkeeping = derive(
    toBase(destination.stationkeepingDvPerYear) * years,
    'm/s',
    model,
    'stationkeeping Δv per year × years of operations',
    [destination.stationkeepingDvPerYear],
  );

  const steps: DeltaVStep[] = [
    { id: 'orbit-insertion', value: insertionStep },
    { id: 'trajectory-corrections', value: corrections },
    { id: 'stationkeeping', value: stationkeeping },
  ];
  const subtotalValue = steps.reduce((sum, step) => sum + step.value.value, 0);
  const subtotal = derive(subtotalValue, 'm/s', model, 'sum of insertion, corrections and stationkeeping', steps.map((step) => step.value));
  const required = derive(subtotalValue * (1 + assume.value('delta-v-margin')), 'm/s', model, 'subtotal × (1 + margin)', [subtotal, assume.quantity('delta-v-margin')]);

  let availableValue = 0;
  let requiredPropellant: Derived | null = null;
  const availableInputs: Quantity[] = [];
  if (propulsion) {
    const isp = valueIn(propulsion.isp, 's');
    const dry = launchMassKg - mission.spacecraft.propellantMassKg;
    availableValue = rocketDeltaV(isp, launchMassKg, dry);
    availableInputs.push(propulsion.isp);
    requiredPropellant = derive(propellantForDeltaV(isp, dry, required.value), 'kg', model, 'm_p = m_dry · (exp(Δv / (Isp·g0)) − 1)', [propulsion.isp, required]);
  }
  const available = derive(availableValue, 'm/s', model, 'Δv = Isp · g0 · ln(m0 / mf)', availableInputs);

  const departureC3 = entry.departure
    ? {
        required: derive(entry.departure.requiredM2S2, 'm^2/s^2', transferModel, 'C3 = v∞² of the Hohmann departure', entry.departure.inputs),
        provided: derive(entry.departure.providedM2S2, 'm^2/s^2', 'launch-fit', 'C3 of the launch target', entry.departure.inputs.slice(-1)),
      }
    : null;

  let site: DeltaVResult['site'] = null;
  if (deliveryTarget.kind === 'orbit') {
    const delivered = deliveryInclinationDeg(design.site, mission.orbit.inclinationDeg);
    const direct = insertion(design, assume, mission.orbit.inclinationDeg).value;
    site = {
      deliveryInclinationDeg: delivered,
      shortfallDeg: Math.abs(mission.orbit.inclinationDeg - delivered),
      extra: derive(Math.max(0, entry.value - direct), 'm/s', transferModel, 'Δv with the site\'s inclination corridor minus Δv with a direct launch into the desired inclination', entry.inputs),
    };
  }

  return {
    steps,
    subtotal,
    required,
    available,
    margin: marginOf(availableValue, required.value),
    requiredPropellant,
    departureC3,
    impulsiveBurnsImpossible: propulsion?.thrustClass === 'low-thrust' && insertionStep.value + corrections.value > 0,
    site,
  };
}

