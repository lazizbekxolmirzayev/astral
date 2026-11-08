import { describe, expect, it } from 'vitest';
import { BODIES, EARTH_J2, EARTH_SIDEREAL_DAY, TROPICAL_YEAR } from '../constants';
import {
  DESTINATION_IDS,
  LAUNCH_TARGET_IDS,
  destinationSchema,
  launcherSchema,
  launchTargetSchema,
  partSchema,
} from '../models/catalog';
import { toBase, valueIn } from '../units';
import {
  ADCS,
  BATTERIES,
  BUSES,
  COMMS,
  DESTINATIONS,
  INSTRUMENTS,
  LAUNCHERS,
  LAUNCH_TARGETS,
  PARTS,
  PROPULSION,
  SOLAR_ARRAYS,
  getDestination,
  getLaunchTarget,
  getLauncher,
  getPart,
} from './index';

const CYRILLIC = /[Ѐ-ӿ]/;

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

describe('catalog schema and integrity', () => {
  it('every part, launcher, target and destination satisfies its schema', () => {
    for (const part of PARTS) expect(() => partSchema.parse(part), part.id).not.toThrow();
    for (const launcher of LAUNCHERS) expect(() => launcherSchema.parse(launcher), launcher.id).not.toThrow();
    for (const target of LAUNCH_TARGETS) expect(() => launchTargetSchema.parse(target), target.id).not.toThrow();
    for (const destination of DESTINATIONS) expect(() => destinationSchema.parse(destination), destination.id).not.toThrow();
  });

  it('ids are unique among parts and launchers, and lookups find them', () => {
    const ids = [...PARTS.map((part) => part.id), ...LAUNCHERS.map((launcher) => launcher.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of PARTS) expect(getPart(part.id)).toBe(part);
    for (const launcher of LAUNCHERS) expect(getLauncher(launcher.id)).toBe(launcher);
    expect(getPart('does-not-exist')).toBeUndefined();
  });

  it('covers every destination and every launch target exactly once', () => {
    expect(DESTINATIONS.map((destination) => destination.id).sort()).toEqual([...DESTINATION_IDS].sort());
    expect(LAUNCH_TARGETS.map((target) => target.id).sort()).toEqual([...LAUNCH_TARGET_IDS].sort());
  });

  it('every destination can be reached with a bus, an instrument and a launcher', () => {
    for (const destination of DESTINATIONS) {
      expect(BUSES.some((bus) => bus.destinations.includes(destination.id)), `bus for ${destination.id}`).toBe(true);
      expect(INSTRUMENTS.some((instrument) => instrument.destinations.includes(destination.id)), `instrument for ${destination.id}`).toBe(true);
      expect(getLaunchTarget(destination.deliveryTarget), `target for ${destination.id}`).toBeDefined();
      expect(
        LAUNCHERS.some((launcher) => launcher.capacity[destination.deliveryTarget] !== undefined),
        `launcher for ${destination.id}`,
      ).toBe(true);
    }
  });

  it('every part and instrument is usable somewhere: instruments have a compatible attitude system', () => {
    const bestPointing = Math.min(...ADCS.map((adcs) => valueIn(adcs.pointingAccuracy, 'deg')));
    for (const instrument of INSTRUMENTS) {
      expect(bestPointing, instrument.id).toBeLessThanOrEqual(valueIn(instrument.requiredPointing, 'deg'));
    }
  });

  it('has English and Uzbek text everywhere, with no placeholder copies and no Cyrillic slips', () => {
    const texts = [...PARTS, ...LAUNCHERS, ...LAUNCH_TARGETS, ...DESTINATIONS];
    for (const item of texts) {
      const name = item.name;
      expect(name.en.trim().length, item.id).toBeGreaterThan(0);
      expect(name.uz.trim().length, item.id).toBeGreaterThan(0);
      expect(name.uz, `${item.id} name`).not.toBe(name.en);
      if ('summary' in item) expect(item.summary.uz, `${item.id} summary`).not.toBe(item.summary.en);
    }
    for (const string of collectStrings(texts)) expect(CYRILLIC.test(string), string).toBe(false);
  });
});

describe('catalog provenance policy', () => {
  it('prices and science values are labelled as game values, never as real figures', () => {
    for (const part of PARTS) {
      expect(part.cost.provenance, `${part.id} cost`).toBe('fictional');
      if (part.category === 'instrument') expect(part.scienceValue.provenance, `${part.id} science`).toBe('fictional');
    }
    for (const launcher of LAUNCHERS) expect(launcher.cost.provenance, launcher.id).toBe('fictional');
    for (const destination of DESTINATIONS) expect(destination.operationsCostPerDay.provenance, destination.id).toBe('fictional');
  });

  it('class-typical performance is "estimated" and carries a source', () => {
    for (const part of PARTS) {
      expect(part.mass.provenance, `${part.id} mass`).toBe('estimated');
      expect(part.mass.source, `${part.id} mass source`).toBeTruthy();
    }
    for (const launcher of LAUNCHERS) {
      for (const capacity of Object.values(launcher.capacity)) expect(capacity.provenance).toBe('estimated');
    }
  });

  it('measured reference data cites its source', () => {
    for (const body of Object.values(BODIES)) {
      expect(body.gm.provenance).toBe('measured');
      expect(body.gm.source).toBeTruthy();
      expect(body.radius.source).toBeTruthy();
    }
    for (const destination of DESTINATIONS) {
      for (const distance of Object.values(destination.earthDistance ?? {})) {
        expect(distance.provenance).toBe('measured');
        expect(distance.source).toBeTruthy();
      }
    }
  });
});

describe('catalog physical plausibility', () => {
  it('solar arrays have realistic efficiency and areal mass', () => {
    for (const array of SOLAR_ARRAYS) {
      const efficiency = toBase(array.efficiency);
      expect(efficiency, array.id).toBeGreaterThan(0.15);
      expect(efficiency, array.id).toBeLessThan(0.35);
      const arealMass = toBase(array.mass) / toBase(array.area);
      expect(arealMass, array.id).toBeGreaterThan(1.5);
      expect(arealMass, array.id).toBeLessThan(4);
      expect(toBase(array.degradationPerYear), array.id).toBeLessThan(0.05);
    }
  });

  it('batteries have a realistic specific energy and a sane depth of discharge', () => {
    for (const battery of BATTERIES) {
      const specificEnergy = valueIn(battery.capacity, 'Wh') / toBase(battery.mass);
      expect(specificEnergy, battery.id).toBeGreaterThan(80);
      expect(specificEnergy, battery.id).toBeLessThan(250);
      expect(toBase(battery.depthOfDischarge), battery.id).toBeGreaterThan(0);
      expect(toBase(battery.depthOfDischarge), battery.id).toBeLessThanOrEqual(0.8);
    }
  });

  it('specific impulse matches the technology class', () => {
    const ranges = { 'cold-gas': [30, 100], monopropellant: [180, 250], bipropellant: [280, 340], electric: [1000, 3500] } as const;
    for (const engine of PROPULSION) {
      const [low, high] = ranges[engine.technology];
      expect(toBase(engine.isp), engine.id).toBeGreaterThanOrEqual(low);
      expect(toBase(engine.isp), engine.id).toBeLessThanOrEqual(high);
      expect(engine.thrustClass, engine.id).toBe(engine.technology === 'electric' ? 'low-thrust' : 'impulsive');
    }
  });

  it('radio bands match their frequencies', () => {
    const bands = { uhf: [0.3, 1], s: [2, 4], x: [8, 12], ka: [26, 40] } as const;
    for (const radio of COMMS) {
      const [low, high] = bands[radio.band];
      const ghz = valueIn(radio.frequency, 'GHz');
      expect(ghz, radio.id).toBeGreaterThanOrEqual(low);
      expect(ghz, radio.id).toBeLessThanOrEqual(high);
    }
  });

  it('launcher capacity falls as the target gets more energetic', () => {
    const order = ['leo', 'sso', 'gto', 'tli', 'tmi'] as const;
    for (const launcher of LAUNCHERS) {
      const masses = order.flatMap((target) => {
        const capacity = launcher.capacity[target];
        return capacity ? [toBase(capacity)] : [];
      });
      for (let index = 1; index < masses.length; index += 1) {
        expect(masses[index], launcher.id).toBeLessThan(masses[index - 1] as number);
      }
    }
    // The catalog lists launchers from smallest to largest, and price rises with size.
    const prices = LAUNCHERS.map((launcher) => toBase(launcher.cost));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('each bus carries at least the smallest instrument it is allowed to fly', () => {
    for (const bus of BUSES) {
      const lightest = Math.min(
        ...INSTRUMENTS.filter((instrument) => instrument.destinations.some((id) => bus.destinations.includes(id))).map((instrument) =>
          toBase(instrument.mass),
        ),
      );
      expect(toBase(bus.payloadMassLimit), bus.id).toBeGreaterThanOrEqual(lightest);
    }
  });

  it('instrument duty cycles and ratios are valid fractions', () => {
    for (const instrument of INSTRUMENTS) {
      expect(toBase(instrument.dutyCycle), instrument.id).toBeGreaterThan(0);
      expect(toBase(instrument.dutyCycle), instrument.id).toBeLessThanOrEqual(1);
    }
    for (const launcher of LAUNCHERS) expect(toBase(launcher.reliability), launcher.id).toBeLessThan(1);
  });
});

describe('catalog values re-derived from the physical constants', () => {
  const earthGm = valueIn(BODIES.earth.gm, 'm^3/s^2');
  const earthRadiusM = valueIn(BODIES.earth.radius, 'm');

  it('the geostationary altitude matches the sidereal day', () => {
    const period = toBase(EARTH_SIDEREAL_DAY);
    const radius = Math.cbrt((earthGm * period * period) / (4 * Math.PI ** 2));
    const altitudeKm = (radius - earthRadiusM) / 1000;
    expect(Math.abs(altitudeKm - 35_786)).toBeLessThan(2);

    const geo = getDestination('geo');
    expect(geo?.defaultOrbit.apoapsisAltKm).toBe(35_786);
    const gto = getLaunchTarget('gto');
    expect(gto?.kind === 'orbit' && Math.abs(gto.apoapsisAltKm - altitudeKm) < 2).toBe(true);
  });

  it('the sun-synchronous inclination follows from J2 and the tropical year', () => {
    for (const destinationId of ['sso'] as const) {
      const destination = getDestination(destinationId);
      const altitudeM = (destination?.defaultOrbit.periapsisAltKm ?? 0) * 1000;
      const a = earthRadiusM + altitudeM;
      const meanMotion = Math.sqrt(earthGm / a ** 3);
      const requiredRate = (2 * Math.PI) / toBase(TROPICAL_YEAR);
      const cosInclination = -requiredRate / (1.5 * toBase(EARTH_J2) * (earthRadiusM / a) ** 2 * meanMotion);
      const inclinationDeg = (Math.acos(cosInclination) * 180) / Math.PI;
      expect(inclinationDeg).toBeCloseTo(destination?.defaultOrbit.inclinationDeg ?? 0, 0);
      expect(Math.abs(inclinationDeg - (destination?.defaultOrbit.inclinationDeg ?? 0))).toBeLessThan(0.1);
    }
    const target = getLaunchTarget('sso');
    expect(target?.kind === 'orbit' && target.inclinationDeg).toBe(getDestination('sso')?.defaultOrbit.inclinationDeg);
  });

  it('the translunar and trans-Mars departure energies are consistent with a Hohmann transfer', () => {
    const sunGm = valueIn(BODIES.sun.gm, 'm^3/s^2');
    const earthA = valueIn(BODIES.earth.orbit?.semiMajorAxis ?? BODIES.earth.radius, 'm');
    const marsA = valueIn(BODIES.mars.orbit?.semiMajorAxis ?? BODIES.mars.radius, 'm');
    const vEarth = Math.sqrt(sunGm / earthA);
    const vInf = vEarth * (Math.sqrt((2 * marsA) / (earthA + marsA)) - 1);
    const hohmannC3 = (vInf * vInf) / 1e6; // km²/s²
    expect(hohmannC3).toBeGreaterThan(8);
    expect(hohmannC3).toBeLessThan(9.5);

    const tmi = getLaunchTarget('tmi');
    const tli = getLaunchTarget('tli');
    expect(tmi?.kind === 'escape' && valueIn(tmi.c3, 'km^2/s^2')).toBeGreaterThan(hohmannC3);
    expect(tli?.kind === 'escape' && valueIn(tli.c3, 'km^2/s^2')).toBeLessThan(0);
  });

  it('the Mars transfer time is close to half the Hohmann period', () => {
    const sunGm = valueIn(BODIES.sun.gm, 'm^3/s^2');
    const a = (valueIn(BODIES.earth.orbit?.semiMajorAxis ?? BODIES.earth.radius, 'm') + valueIn(BODIES.mars.orbit?.semiMajorAxis ?? BODIES.mars.radius, 'm')) / 2;
    const halfPeriodDays = (Math.PI * Math.sqrt(a ** 3 / sunGm)) / 86_400;
    const mars = getDestination('mars');
    expect(Math.abs(valueIn(mars?.cruiseDuration ?? { value: 0, unit: 'd' }, 'd') - halfPeriodDays)).toBeLessThan(5);
  });

  it('default orbits lie inside their own limits', () => {
    for (const destination of DESTINATIONS) {
      const { defaultOrbit, orbitLimits } = destination;
      expect(defaultOrbit.periapsisAltKm, destination.id).toBeGreaterThanOrEqual(orbitLimits.altitudeKm.min);
      expect(defaultOrbit.apoapsisAltKm, destination.id).toBeLessThanOrEqual(orbitLimits.altitudeKm.max);
      expect(defaultOrbit.inclinationDeg, destination.id).toBeGreaterThanOrEqual(orbitLimits.inclinationDeg.min);
      expect(defaultOrbit.inclinationDeg, destination.id).toBeLessThanOrEqual(orbitLimits.inclinationDeg.max);
    }
  });

  it('deep-space destinations carry an Earth distance range and Earth orbits do not', () => {
    for (const destination of DESTINATIONS) {
      const deepSpace = destination.id === 'moon' || destination.id === 'mars';
      expect(destination.earthDistance !== undefined, destination.id).toBe(deepSpace);
      if (destination.earthDistance) {
        expect(toBase(destination.earthDistance.max)).toBeGreaterThan(toBase(destination.earthDistance.min));
      }
    }
  });
});
