import { describe, expect, it } from 'vitest';
import { keplerPeriod } from '@/physics/orbits';
import { DEFAULT_CATALOG, type CatalogLookup } from '../catalog';
import { BODIES, SI_EXACT } from '../constants';
import { DESTINATION_IDS, type Part } from '../models/catalog';
import type { Mission } from '../models/mission';
import { RESOURCE_KEYS } from '../models/resources';
import { createDefaultMission } from '../templates/defaults';
import { convert, dbToRatio, toBase } from '../units';
import { ASSUMPTIONS, createAssumptionReader } from './assumptions';
import { captureBurn, hohmannWithPlaneChange, propellantForDeltaV, rocketDeltaV } from './deltaV';
import { weakestProvenance } from './derived';
import { evaluateMission, type Evaluation } from './evaluate';
import { circularSpeed, describeOrbit, eclipseFraction, orbitPeriod, slantRange } from './orbit';
import { q } from '../models/quantity';

const NOW = '2026-01-01T00:00:00.000Z';
const mission = (id: (typeof DESTINATION_IDS)[number]): Mission => createDefaultMission(id, { id: `test-${id}`, now: NOW, title: 'Test' });
const withSpacecraft = (base: Mission, change: Partial<Mission['spacecraft']>): Mission => ({ ...base, spacecraft: { ...base.spacecraft, ...change } });
const without = (base: Mission, prefix: string): Mission => withSpacecraft(base, { parts: base.spacecraft.parts.filter((part) => !part.itemId.startsWith(prefix)) });
const codes = (evaluation: Evaluation) => evaluation.issues.map((issue) => issue.code);
const km = (value: number) => value * 1000;

describe('orbit helpers', () => {
  it('give textbook values for low Earth orbit', () => {
    const earth = describeOrbit('earth', { periapsisAltKm: 500, apoapsisAltKm: 500, inclinationDeg: 51.6 });
    expect(circularSpeed(earth.gm, earth.radius + km(500))).toBeCloseTo(7612.6, 0);
    expect(earth.period / 60).toBeCloseTo(94.6, 1);
    expect(eclipseFraction(earth.radius, earth.semiMajorAxis)).toBeCloseTo(0.3777, 3);
  });

  it('agree with the existing physics core (Kepler period)', () => {
    const earth = describeOrbit('earth', { periapsisAltKm: 800, apoapsisAltKm: 800, inclinationDeg: 0 });
    const au = SI_EXACT.astronomicalUnitM;
    const gmAuDay = (earth.gm * 86_400 ** 2) / au ** 3;
    const periodDays = keplerPeriod(gmAuDay, earth.semiMajorAxis / au);
    expect(periodDays * 86_400).toBeCloseTo(orbitPeriod(earth.gm, earth.semiMajorAxis), 3);
  });

  it('puts a ground station within sight of a geostationary satellite', () => {
    const range = slantRange(km(6378.137), km(35_786), (10 * Math.PI) / 180);
    expect(range / 1e3).toBeGreaterThan(36_000);
    expect(range / 1e3).toBeLessThan(41_500);
    expect(slantRange(km(6378.137), km(500), Math.PI / 2)).toBeCloseTo(km(500), 3);
  });
});

describe('rocket equation and manoeuvres', () => {
  it('Tsiolkovsky: mass ratio e gives Isp·g0', () => {
    expect(rocketDeltaV(300, Math.E * 100, 100)).toBeCloseTo(300 * SI_EXACT.standardGravityMS2, 6);
  });
  it('is inverted by the propellant formula', () => {
    for (const dv of [50, 500, 3000]) {
      const propellant = propellantForDeltaV(320, 1000, dv);
      expect(rocketDeltaV(320, 1000 + propellant, 1000)).toBeCloseTo(dv, 6);
    }
  });
  it('gives zero for no propellant or a nonsensical mass pair', () => {
    expect(rocketDeltaV(300, 100, 100)).toBe(0);
    expect(rocketDeltaV(300, 50, 100)).toBe(0);
    expect(rocketDeltaV(300, 100, 0)).toBe(0);
  });
  it('Hohmann LEO (300 km) to GEO radius is about 3.9 km/s (Curtis)', () => {
    const gm = toBase(BODIES.earth.gm);
    const dv = hohmannWithPlaneChange(gm, km(6378.137 + 300), km(42_164), 0);
    expect(dv / 1e3).toBeGreaterThan(3.85);
    expect(dv / 1e3).toBeLessThan(3.95);
  });
  it('a pure plane change costs 2·v·sin(Δi/2)', () => {
    const gm = toBase(BODIES.earth.gm);
    const r = km(7000);
    const di = (20 * Math.PI) / 180;
    expect(hohmannWithPlaneChange(gm, r, r, di)).toBeCloseTo(2 * circularSpeed(gm, r) * Math.sin(di / 2), 6);
  });
  it('capture into a circular orbit matches the closed form', () => {
    const gm = toBase(BODIES.moon.gm);
    const r = km(1837.4);
    const dv = captureBurn(gm, r, r, 800);
    expect(dv).toBeCloseTo(Math.sqrt(800 ** 2 + (2 * gm) / r) - Math.sqrt(gm / r), 6);
    expect(dv).toBeGreaterThan(780);
    expect(dv).toBeLessThan(850);
  });
});

describe('transfer requirements of the default missions', () => {
  it('GEO: circularising from GTO and removing 28.5° costs about 1.8 km/s', () => {
    const step = evaluateMission(mission('geo')).details!.deltaV.steps[0]!.value.value;
    expect(step / 1e3).toBeGreaterThan(1.78);
    expect(step / 1e3).toBeLessThan(1.88);
  });
  it('Mars: Hohmann departure needs about 8.7 km²/s² and capture about 2 km/s', () => {
    const { deltaV } = evaluateMission(mission('mars')).details!;
    expect(convert(deltaV.departureC3!.required.value, 'm^2/s^2', 'km^2/s^2')).toBeGreaterThan(8.5);
    expect(convert(deltaV.departureC3!.required.value, 'm^2/s^2', 'km^2/s^2')).toBeLessThan(8.9);
    expect(deltaV.steps[0]!.value.value / 1e3).toBeGreaterThan(1.9);
    expect(deltaV.steps[0]!.value.value / 1e3).toBeLessThan(2.3);
  });
  it('Moon: capture is about 0.8 km/s', () => {
    const step = evaluateMission(mission('moon')).details!.deltaV.steps[0]!.value.value;
    expect(step).toBeGreaterThan(750);
    expect(step).toBeLessThan(900);
  });
  it('a launch straight into the target orbit needs no insertion burn', () => {
    expect(evaluateMission(mission('leo')).details!.deltaV.steps[0]!.value.value).toBeCloseTo(0, 6);
    expect(evaluateMission(mission('sso')).details!.deltaV.steps[0]!.value.value).toBeCloseTo(0, 3);
  });
  it('a higher target orbit costs more Δv', () => {
    const base = mission('leo');
    const high = { ...base, orbit: { ...base.orbit, periapsisAltKm: 1200, apoapsisAltKm: 1200 } };
    expect(evaluateMission(high).details!.deltaV.steps[0]!.value.value).toBeGreaterThan(300);
  });
});

describe('all default mission templates', () => {
  for (const id of DESTINATION_IDS) {
    describe(id, () => {
      const evaluation = evaluateMission(mission(id));

      it('closes: no reference issues, no errors', () => {
        expect(evaluation.referenceIssues).toEqual([]);
        expect(evaluation.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
        expect(evaluation.feasible).toBe(true);
        expect(['feasible', 'marginal']).toContain(evaluation.status);
      });
      it('meets every requirement of the template', () => {
        expect(evaluation.requirements.length).toBeGreaterThan(0);
        for (const requirement of evaluation.requirements) expect(requirement.met, `${requirement.id}: ${requirement.actual} vs ${requirement.limit}`).toBe(true);
      });
      it('reports all six resources with a unit, provenance and model, never as measured', () => {
        for (const key of RESOURCE_KEYS) {
          const resource = evaluation.resources![key];
          expect(Number.isFinite(resource.used), key).toBe(true);
          expect(resource.unit.length, key).toBeGreaterThan(0);
          expect(resource.basis.length, key).toBeGreaterThan(10);
          expect(['derived', 'estimated', 'fictional'], key).toContain(resource.provenance);
        }
      });
      it('keeps a positive Δv margin and lists the assumptions it used', () => {
        expect(evaluation.details!.deltaV.margin).toBeGreaterThan(0);
        expect(evaluation.assumptionsUsed.length).toBeGreaterThan(5);
      });
    });
  }
});

describe('resource calculations', () => {
  it('mass: dry + propellant = launch mass, and the payload is the instruments only', () => {
    const m = mission('moon');
    const { mass } = evaluateMission(m).details!;
    expect(mass.launch.value).toBeCloseTo(mass.dry.value + m.spacecraft.propellantMassKg, 9);
    const instruments = m.spacecraft.parts.filter((part) => part.itemId.startsWith('inst-'));
    const expected = instruments.reduce((sum, part) => {
      const item = DEFAULT_CATALOG.getPart(part.itemId)!;
      return sum + toBase(item.mass) * part.quantity;
    }, 0);
    expect(mass.payload.value).toBeCloseTo(expected, 9);
  });

  it('power: irradiance follows the inverse square law at the aphelion of the host planet', () => {
    const earth = evaluateMission(mission('leo')).details!.power.irradiance.value;
    const mars = evaluateMission(mission('mars')).details!.power.irradiance.value;
    const rEarth = 1.0167 * (149.598e6 * 1000) / SI_EXACT.astronomicalUnitM;
    const rMars = 1.0 * (1 + 0.0935) * (227.956e6 * 1000) / SI_EXACT.astronomicalUnitM;
    expect(earth).toBeCloseTo(1360.8 / rEarth ** 2, 3);
    expect(mars).toBeCloseTo(1360.8 / rMars ** 2, 3);
    expect(mars).toBeLessThan(earth / 2);
    // the Moon shares Earth's distance from the Sun
    expect(evaluateMission(mission('moon')).details!.power.irradiance.value).toBeCloseTo(earth, 6);
  });

  it('power: required generation covers the loads plus recharging with round-trip losses', () => {
    const { power } = evaluateMission(mission('sso')).details!;
    const f = power.eclipseDuration.value / power.orbitPeriod.value;
    expect(power.requiredGeneration.value).toBeCloseTo(power.averageLoad.value * (1 + f / ((1 - f) * 0.9)), 9);
    expect(power.generationEol.value).toBeLessThan(power.generationBol.value);
    expect(power.peakLoad.value).toBeGreaterThanOrEqual(power.averageLoad.value);
  });

  it('cost: total is hardware + launch + operations, and always fictional', () => {
    const { cost } = evaluateMission(mission('sso')).details!;
    expect(cost.total.value).toBeCloseTo(cost.spacecraft.value + cost.launch.value + cost.operations.value, 6);
    expect(cost.total.provenance).toBe('fictional');
    expect(cost.chargedDays).toBe(730);
  });

  it('link: matches an independent evaluation of the link equation', () => {
    const m = mission('mars');
    const { link } = evaluateMission(m).details!;
    const assume = createAssumptionReader();
    const radio = DEFAULT_CATALOG.getPart('comms-x-band-hga');
    if (radio?.category !== 'comms') throw new Error('catalog changed');
    const lambda = SI_EXACT.speedOfLightMS / toBase(radio.frequency);
    const d = toBase(DEFAULT_CATALOG.getDestination('mars')!.earthDistance!.max);
    const gr = assume.value('ground-efficiency-deep-space') * ((Math.PI * 34) / lambda) ** 2;
    const lfs = ((4 * Math.PI * d) / lambda) ** 2;
    const need = dbToRatio(3 + 3 + 2);
    const rate = (toBase(radio.txPower) * dbToRatio(43) * gr) / (lfs * SI_EXACT.boltzmannJPerK * 25 * need);
    expect(link.budgetRate.value / rate).toBeCloseTo(1, 6);
    expect(link.usableRate.value).toBeLessThanOrEqual(link.hardwareRate.value);
  });

  it('link: halving the distance quadruples the supported rate', () => {
    const base = mission('moon');
    const near: CatalogLookup = {
      ...DEFAULT_CATALOG,
      getDestination: (id) => {
        const destination = DEFAULT_CATALOG.getDestination(id)!;
        if (id !== 'moon' || !destination.earthDistance) return destination;
        return { ...destination, earthDistance: { ...destination.earthDistance, max: q(toBase(destination.earthDistance.max) / 2, 'm', 'measured', 'test') } };
      },
    };
    const far = evaluateMission(base).details!.link.budgetRate.value;
    expect(evaluateMission(base, near).details!.link.budgetRate.value / far).toBeCloseTo(4, 6);
  });

  it('data: relay instruments produce no stored data', () => {
    const { data } = evaluateMission(mission('geo')).details!;
    expect(data.dailyGenerated.value).toBe(0);
    expect(data.returnFraction).toBe(1);
  });

  it('data: a daily surplus builds a backlog, then overflows the storage; the loss is reported', () => {
    const base = mission('sso');
    const triple = withSpacecraft(base, { parts: base.spacecraft.parts.map((part) => (part.itemId === 'inst-eo-multispectral' ? { ...part, quantity: 3 } : part)) });
    const evaluation = evaluateMission(triple);
    const { data } = evaluation.details!;
    expect(data.dailyGenerated.value).toBeGreaterThan(data.dailyCapacity.value);
    expect(data.firstOverflowDay).not.toBeNull();
    expect(data.lost.value).toBeGreaterThan(0);
    expect(data.returnFraction).toBeLessThan(1);
    expect(codes(evaluation)).toContain('data-storage-overflow');
    expect(evaluation.resources!.data.status).toBe('over');
    expect(evaluation.feasible).toBe(false);
  });

  it('data: bookkeeping balances (generated = returned + lost + backlog)', () => {
    const base = mission('sso');
    const triple = withSpacecraft(base, { parts: base.spacecraft.parts.map((part) => (part.itemId === 'inst-eo-multispectral' ? { ...part, quantity: 3 } : part)) });
    const { data } = evaluateMission(triple).details!;
    expect(data.generatedTotal.value).toBeCloseTo(data.returnedTotal.value + data.lost.value + data.endBacklog.value, -3);
  });

  it('science: scales with the share of data that reaches Earth, and is zero when pointing is too coarse', () => {
    const base = mission('sso');
    const full = evaluateMission(base).details!.science.total.value;
    const coarse = { ...base, spacecraft: { ...base.spacecraft, parts: base.spacecraft.parts.map((part) => (part.itemId === 'adcs-3axis-fine' ? { ...part, itemId: 'adcs-cubesat' } : part)) } };
    const result = evaluateMission(coarse);
    expect(result.details!.science.total.value).toBeLessThan(full);
    expect(codes(result)).toContain('pointing-insufficient');
  });
});

describe('invalid and insufficient configurations are reported, not hidden', () => {
  it('unknown part: unresolvable, nothing computed, the reference issue is listed', () => {
    const base = mission('leo');
    const broken = withSpacecraft(base, { parts: [...base.spacecraft.parts, { itemId: 'no-such-part', quantity: 1 }] });
    const evaluation = evaluateMission(broken);
    expect(evaluation.status).toBe('unresolvable');
    expect(evaluation.feasible).toBe(false);
    expect(evaluation.resources).toBeNull();
    expect(evaluation.details).toBeNull();
    expect(evaluation.referenceIssues.map((issue) => issue.code)).toContain('unknown-part');
  });

  it('too heavy for the launcher', () => {
    const base = mission('leo');
    const heavy = withSpacecraft(base, { parts: [...base.spacecraft.parts, { itemId: 'battery-5000wh', quantity: 50 }] });
    const evaluation = evaluateMission(heavy);
    expect(codes(evaluation)).toContain('mass-over-launcher-capacity');
    expect(evaluation.resources!.mass.status).toBe('over');
    expect(evaluation.resources!.mass.margin).toBeLessThan(0);
  });

  it('a launcher that cannot reach the target is a reference error with zero capacity', () => {
    const evaluation = evaluateMission({ ...mission('moon'), launch: { vehicleId: 'launcher-small' } });
    expect(evaluation.referenceIssues.map((issue) => issue.code)).toContain('launcher-cannot-reach-target');
    expect(evaluation.resources!.mass.limit).toBe(0);
    expect(evaluation.feasible).toBe(false);
  });

  it('no solar array, no battery, no radio, no computer, no attitude control', () => {
    const base = mission('sso');
    expect(codes(evaluateMission(without(base, 'solar-')))).toContain('no-power-source');
    expect(codes(evaluateMission(without(base, 'battery-')))).toContain('battery-too-small');
    expect(codes(evaluateMission(without(base, 'comms-')))).toContain('no-radio');
    expect(codes(evaluateMission(without(base, 'obc-')))).toContain('no-flight-computer');
    expect(codes(evaluateMission(without(base, 'adcs-')))).toContain('no-attitude-control');
    for (const prefix of ['solar-', 'battery-', 'comms-', 'obc-', 'adcs-']) expect(evaluateMission(without(base, prefix)).feasible, prefix).toBe(false);
  });

  it('too little power', () => {
    const base = mission('sso');
    const weak = withSpacecraft(base, { parts: base.spacecraft.parts.map((part) => (part.itemId === 'solar-wing-4' ? { ...part, itemId: 'solar-body-025' } : part)) });
    const evaluation = evaluateMission(weak);
    expect(codes(evaluation)).toContain('power-deficit');
    expect(evaluation.resources!.power.status).toBe('over');
  });

  it('no propellant for GEO: Δv is insufficient', () => {
    const evaluation = evaluateMission(withSpacecraft(mission('geo'), { propellantMassKg: 0 }));
    expect(evaluation.details!.deltaV.available.value).toBe(0);
    expect(codes(evaluation)).toContain('delta-v-insufficient');
    expect(evaluation.details!.deltaV.requiredPropellant!.value).toBeGreaterThan(1000);
  });

  it('propellant above the tank capacity is a reference issue', () => {
    const evaluation = evaluateMission(withSpacecraft(mission('geo'), { propellantMassKg: 99_999 }));
    expect(evaluation.referenceIssues.map((issue) => issue.code)).toContain('propellant-exceeds-capacity');
    expect(evaluation.feasible).toBe(false);
  });

  it('electric propulsion cannot make the lunar capture burn', () => {
    const evaluation = evaluateMission(withSpacecraft(mission('moon'), { propulsionId: 'prop-hall-electric', propellantMassKg: 100 }));
    expect(codes(evaluation)).toContain('low-thrust-cannot-insert');
    expect(evaluation.feasible).toBe(false);
  });

  it('a mission longer than the bus design life', () => {
    const base = mission('leo');
    const evaluation = evaluateMission({ ...base, plannedOperationsDays: 9000 });
    expect(codes(evaluation)).toContain('exceeds-design-life');
    expect(evaluation.resources!.time.status).toBe('over');
  });

  it('a failed requirement is an error naming the requirement', () => {
    const base = mission('leo');
    const evaluation = evaluateMission({ ...base, objective: { ...base.objective, requirements: [{ id: 'req-cheap', kind: 'max-cost', limit: 1e6 }] } });
    const issue = evaluation.issues.find((entry) => entry.code === 'requirement-not-met');
    expect(issue?.values.requirementId).toBe('req-cheap');
    expect(evaluation.requirements[0]!.met).toBe(false);
    expect(evaluation.resources!.budget.status).toBe('over');
  });

  it('without a cost requirement the budget has no limit and cannot be over', () => {
    const base = mission('leo');
    const evaluation = evaluateMission({ ...base, objective: { ...base.objective, requirements: [] } });
    expect(evaluation.resources!.budget.limit).toBeNull();
    expect(evaluation.resources!.budget.margin).toBeNull();
    expect(evaluation.resources!.budget.status).toBe('ok');
  });

  it('thin margins are warnings, not errors', () => {
    const base = mission('geo');
    const evaluation = evaluateMission(withSpacecraft(base, { propellantMassKg: 2500 }));
    const warning = evaluation.issues.find((issue) => issue.code === 'delta-v-margin-tight');
    expect(warning?.severity).toBe('warning');
    expect(evaluation.status).toBe('marginal');
    expect(evaluation.feasible).toBe(true);
  });

  it('every issue has text in both languages, no Cyrillic', () => {
    const broken = evaluateMission(withSpacecraft(without(mission('sso'), 'comms-'), { propellantMassKg: 0 }));
    expect(broken.issues.length).toBeGreaterThan(2);
    for (const issue of broken.issues) {
      expect(issue.message.en.length).toBeGreaterThan(0);
      expect(issue.message.uz.length).toBeGreaterThan(0);
      expect(issue.message.uz).not.toMatch(/[Ѐ-ӿ]/);
    }
  });
});

describe('units and provenance', () => {
  /** Rewrites every catalog quantity into another unit of the same dimension. */
  const REWRITE: Record<string, [string, number]> = { kg: ['g', 1000], W: ['kW', 1e-3], Wh: ['J', 3600], s: ['min', 1 / 60], USD: ['kUSD', 1e-3], 'm^2': ['m^2', 1], 'bit/s': ['kbit/s', 1e-3], GB: ['Mbit', 8000] };
  const rewrite = <T,>(value: T): T => {
    if (Array.isArray(value)) return value.map(rewrite) as T;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.value === 'number' && typeof record.unit === 'string' && REWRITE[record.unit]) {
        const [unit, factor] = REWRITE[record.unit]!;
        return { ...record, value: record.value * factor, unit } as T;
      }
      return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, rewrite(entry)])) as T;
    }
    return value;
  };
  const converted: CatalogLookup = {
    getPart: (id) => rewrite(DEFAULT_CATALOG.getPart(id)) as Part | undefined,
    getLauncher: (id) => rewrite(DEFAULT_CATALOG.getLauncher(id)),
    getDestination: (id) => rewrite(DEFAULT_CATALOG.getDestination(id)),
    getLaunchTarget: (id) => rewrite(DEFAULT_CATALOG.getLaunchTarget(id)),
  };

  for (const id of DESTINATION_IDS) {
    it(`${id}: results do not depend on the units the catalog is written in`, () => {
      const a = evaluateMission(mission(id));
      const b = evaluateMission(mission(id), converted);
      for (const key of RESOURCE_KEYS) {
        expect(b.resources![key].used / a.resources![key].used || 1, `${key} used`).toBeCloseTo(1, 9);
        if (a.resources![key].limit) expect(b.resources![key].limit! / a.resources![key].limit!, `${key} limit`).toBeCloseTo(1, 9);
      }
      expect(b.details!.deltaV.required.value).toBeCloseTo(a.details!.deltaV.required.value, 6);
      expect(b.details!.deltaV.available.value).toBeCloseTo(a.details!.deltaV.available.value, 6);
      expect(codes(b)).toEqual(codes(a));
    });
  }

  it('a result is never more certain than its weakest input', () => {
    const measured = q(1, 'kg', 'measured', 'x');
    const estimated = q(1, 'kg', 'estimated', 'x');
    const fictional = q(1, 'kg', 'fictional', 'x');
    expect(weakestProvenance([measured, measured])).toBe('derived');
    expect(weakestProvenance([measured, estimated])).toBe('estimated');
    expect(weakestProvenance([estimated, fictional, measured])).toBe('fictional');
    expect(weakestProvenance([])).toBe('derived');
  });

  it('propagates through the engine: cost is fictional, power and mass estimated', () => {
    const { details } = evaluateMission(mission('leo'));
    expect(details!.cost.total.provenance).toBe('fictional');
    expect(details!.power.generationEol.provenance).toBe('estimated');
    expect(details!.mass.launch.provenance).toBe('estimated');
    expect(details!.power.irradiance.provenance).toBe('derived');
    for (const value of [details!.mass.launch, details!.power.generationEol, details!.deltaV.required, details!.link.budgetRate]) {
      expect(value.source?.length ?? 0).toBeGreaterThan(5);
      expect(value.model).toBeTruthy();
    }
  });

  it('every engine assumption has a unit, a provenance other than measured, and text in both languages', () => {
    const ids = new Set<string>();
    for (const assumption of ASSUMPTIONS) {
      expect(ids.has(assumption.id), assumption.id).toBe(false);
      ids.add(assumption.id);
      expect(['estimated', 'fictional']).toContain(assumption.quantity.provenance);
      expect(assumption.quantity.source?.length ?? 0).toBeGreaterThan(10);
      expect(assumption.description.uz).not.toMatch(/[Ѐ-ӿ]/);
      expect(assumption.description.en).not.toBe(assumption.description.uz);
    }
  });

  it('refuses unknown assumptions', () => {
    expect(() => createAssumptionReader().value('nope')).toThrow(/unknown engine assumption/);
  });
});

describe('purity', () => {
  it('gives identical results for identical input and does not modify the mission', () => {
    const m = mission('mars');
    const snapshot = JSON.stringify(m);
    const first = evaluateMission(m);
    const second = evaluateMission(m);
    expect(JSON.stringify(m)).toBe(snapshot);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
  it('depends only on the mission document: the seed and title change nothing', () => {
    const a = evaluateMission(mission('moon'));
    const b = evaluateMission({ ...mission('moon'), seed: 12345, title: 'Another', id: 'other' });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
