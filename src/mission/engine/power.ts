import { BODIES, SI_EXACT, SOLAR_CONSTANT, type BodyId } from '../constants';
import type { Quantity } from '../models/quantity';
import { toBase } from '../units';
import type { AssumptionReader } from './assumptions';
import { derive, marginOf, type Derived } from './derived';
import { describeOrbit, eclipseFraction } from './orbit';
import type { ResolvedDesign } from './resolve';

export type PowerLoad = { source: string; kind: 'bus' | 'obc' | 'adcs' | 'comms' | 'instrument' | 'propulsion'; averageW: number; peakW: number };

export type PowerResult = {
  /** Distance from the Sun used for the irradiance: the worst case (aphelion) of the planet the destination belongs to. */
  sunDistance: Derived;
  irradiance: Derived;
  generationBol: Derived;
  generationEol: Derived;
  averageLoad: Derived;
  peakLoad: Derived;
  loads: PowerLoad[];
  orbitPeriod: Derived;
  eclipseDuration: Derived;
  /** Energy the batteries must deliver in the longest eclipse. */
  eclipseEnergy: Derived;
  batteryUsable: Derived;
  batteryMargin: number;
  /** Array output needed to run the loads and recharge the batteries each orbit. */
  requiredGeneration: Derived;
  generationMargin: number;
  /** Years of degradation applied to the arrays. */
  degradationYears: number;
};

/** The planet whose distance from the Sun applies at a destination (the Moon shares Earth's). */
export function sunHostBody(centralBody: BodyId): BodyId {
  return centralBody === 'moon' ? 'earth' : centralBody;
}

/**
 * Power budget at the end of life, in the worst case: farthest from the Sun, longest
 * eclipse, degraded arrays. Loads are duty-cycle averages. See the power-budget card.
 */
export function computePower(design: ResolvedDesign, assume: AssumptionReader, contactSeconds: number): PowerResult {
  const { mission, destination, bus } = design;
  const model = 'power-budget' as const;

  // --- sunlight ---
  const heliocentric = destination.centralBody === 'sun';
  const host = BODIES[sunHostBody(destination.centralBody)];
  if (!heliocentric && !host.orbit?.eccentricity) throw new Error(`body ${host.id} has no heliocentric orbit data`);
  // Around a planet the worst case is the planet's aphelion; on a heliocentric orbit it is the orbit's own aphelion.
  const aphelionM = heliocentric
    ? describeOrbit('sun', mission.orbit).apoapsisRadius
    : toBase(host.orbit!.semiMajorAxis) * (1 + toBase(host.orbit!.eccentricity!));
  const sunDistance = heliocentric
    ? derive(aphelionM, 'm', model, 'aphelion distance of the heliocentric orbit: R_sun + apoapsis altitude', [BODIES.sun.radius])
    : derive(aphelionM, 'm', model, `aphelion distance of ${host.id}: a·(1+e)`, [host.orbit!.semiMajorAxis, host.orbit!.eccentricity!]);
  const irradianceValue = toBase(SOLAR_CONSTANT) * (SI_EXACT.astronomicalUnitM / aphelionM) ** 2;
  const irradiance = derive(irradianceValue, 'W/m^2', model, 'S = S0 · (1 AU / r)²', [SOLAR_CONSTANT, sunDistance]);

  // --- generation ---
  const systemEfficiency = assume.value('power-system-efficiency');
  const years = (toBase(destination.cruiseDuration) + mission.plannedOperationsDays * 86_400) / toBase({ value: 1, unit: 'yr' });
  let bol = 0;
  let eol = 0;
  const generationInputs: Quantity[] = [irradiance, assume.quantity('power-system-efficiency')];
  for (const { part, quantity } of design.solarArrays) {
    const sunFactor = assume.value(part.mounting === 'sun-tracking' ? 'sun-factor-sun-tracking' : 'sun-factor-body-mounted');
    const perArray = irradianceValue * toBase(part.area) * toBase(part.efficiency) * sunFactor * systemEfficiency * quantity;
    bol += perArray;
    eol += perArray * (1 - toBase(part.degradationPerYear)) ** years;
    generationInputs.push(part.area, part.efficiency, part.degradationPerYear);
  }
  const generationBol = derive(bol, 'W', model, 'Σ S · area · efficiency · sun factor · system efficiency (beginning of life)', generationInputs);
  const generationEol = derive(eol, 'W', model, 'beginning-of-life output × (1 − degradation per year)^years', generationInputs);

  // --- loads ---
  const contactFraction = Math.min(1, contactSeconds / 86_400);
  const standby = assume.value('comms-standby-fraction');
  const loads: PowerLoad[] = [];
  const loadInputs: Quantity[] = [bus.basePowerDraw];
  loads.push({ source: bus.id, kind: 'bus', averageW: toBase(bus.basePowerDraw), peakW: toBase(bus.basePowerDraw) });
  for (const { part, quantity } of design.computers) {
    loads.push({ source: part.id, kind: 'obc', averageW: toBase(part.powerDraw) * quantity, peakW: toBase(part.powerDraw) * quantity });
    loadInputs.push(part.powerDraw);
  }
  for (const { part, quantity } of design.attitude) {
    loads.push({ source: part.id, kind: 'adcs', averageW: toBase(part.powerDraw) * quantity, peakW: toBase(part.powerDraw) * quantity });
    loadInputs.push(part.powerDraw);
  }
  for (const { part, quantity } of design.comms) {
    const full = toBase(part.powerDraw) * quantity;
    loads.push({ source: part.id, kind: 'comms', averageW: full * (contactFraction + (1 - contactFraction) * standby), peakW: full });
    loadInputs.push(part.powerDraw);
  }
  for (const { part, quantity } of design.instruments) {
    const full = toBase(part.powerDraw) * quantity;
    loads.push({ source: part.id, kind: 'instrument', averageW: full * toBase(part.dutyCycle), peakW: full });
    loadInputs.push(part.powerDraw, part.dutyCycle);
  }
  if (design.propulsion) {
    // Electric thrusters draw power only while firing; chemical systems draw (almost) none.
    loads.push({ source: design.propulsion.id, kind: 'propulsion', averageW: 0, peakW: toBase(design.propulsion.powerDraw) });
    loadInputs.push(design.propulsion.powerDraw);
  }
  const averageW = loads.reduce((sum, load) => sum + load.averageW, 0);
  const peakW = loads.reduce((sum, load) => sum + load.peakW, 0);
  loadInputs.push(assume.quantity('comms-standby-fraction'));
  const averageLoad = derive(averageW, 'W', model, 'duty-cycle-weighted sum of all loads', loadInputs);
  const peakLoad = derive(peakW, 'W', model, 'sum of all loads switched on at once', loadInputs);

  // --- orbit and eclipse ---
  const geometry = describeOrbit(destination.centralBody, mission.orbit);
  // The Sun itself casts no shadow on a heliocentric orbit.
  const fraction = heliocentric ? 0 : eclipseFraction(geometry.radius, geometry.semiMajorAxis);
  const bodyInputs = [BODIES[destination.centralBody].gm, BODIES[destination.centralBody].radius];
  const orbitPeriod = derive(geometry.period, 's', 'orbit-geometry', 'T = 2π·√(a³/μ), a = mean of periapsis and apoapsis radius', bodyInputs);
  const eclipseSeconds = fraction * geometry.period;
  const eclipseDuration = derive(eclipseSeconds, 's', model, 'longest eclipse: T · asin(R/a) / π (Sun in the orbital plane)', bodyInputs);

  // --- batteries ---
  const eclipseEnergy = derive(averageW * eclipseSeconds, 'J', model, 'average load × eclipse duration', [averageLoad, eclipseDuration]);
  let usableJ = 0;
  const batteryInputs: Quantity[] = [];
  for (const { part, quantity } of design.batteries) {
    usableJ += toBase(part.capacity) * toBase(part.depthOfDischarge) * quantity;
    batteryInputs.push(part.capacity, part.depthOfDischarge);
  }
  const batteryUsable = derive(usableJ, 'J', model, 'Σ capacity · depth of discharge · quantity', batteryInputs);

  // --- balance: loads in sunlight + recharging the eclipse energy (with round-trip losses) ---
  const roundTrip = assume.value('battery-round-trip-efficiency');
  const sunlitFraction = 1 - fraction;
  const requiredW = averageW * (1 + fraction / (sunlitFraction * roundTrip));
  const requiredGeneration = derive(
    requiredW,
    'W',
    model,
    'P_load · (1 + f_eclipse / ((1 − f_eclipse) · η_round-trip))',
    [averageLoad, eclipseDuration, assume.quantity('battery-round-trip-efficiency')],
  );

  return {
    sunDistance,
    irradiance,
    generationBol,
    generationEol,
    averageLoad,
    peakLoad,
    loads,
    orbitPeriod,
    eclipseDuration,
    eclipseEnergy,
    batteryUsable,
    batteryMargin: eclipseEnergy.value === 0 ? 1 : marginOf(usableJ, eclipseEnergy.value),
    requiredGeneration,
    generationMargin: marginOf(eol, requiredW),
    degradationYears: years,
  };
}

