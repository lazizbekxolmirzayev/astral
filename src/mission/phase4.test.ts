import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { keplerPeriod } from '@/physics/orbits';
import { BODIES, SI_EXACT } from './constants';
import { DESTINATIONS, LAUNCHERS, LAUNCH_SITES, getLaunchSite } from './catalog';
import { setDestination, setLauncher, setLaunchSite, setOrbit, setPropellantMass, setRequirement, setSunSynchronousInclination, setPartQuantity } from './edit';
import { ENGINE_ISSUE_CODES, evaluateMission, sunSynchronousInclinationDeg, type CheckId, type Evaluation } from './engine';
import { CHECK_IDS, CHECK_OF_ENGINE_ISSUE, CHECK_OF_REFERENCE_ISSUE, CHECK_OF_REQUIREMENT } from './engine/readiness';
import { DESTINATION_IDS, type DestinationId } from './models/catalog';
import { REQUIREMENT_KINDS } from './models/mission';
import { createBlankMission } from './templates/blank';
import { createDefaultMission } from './templates/defaults';
import { compareLaunchers, compareSites, formatCoordinate } from './launchView';
import { layoutOrbit } from './orbitLayout';
import { durationParts, orbitChange, orbitInputs } from './orbitView';
import { valueIn } from './units';
import type { MissionIssueCode } from './validation';

const NOW = '2026-05-05T00:00:00.000Z';
const make = (id: DestinationId) => createDefaultMission(id, { id: `p4-${id}`, now: NOW, title: 'P4' });
const status = (evaluation: Evaluation, id: CheckId) => evaluation.readiness.groups.flatMap((group) => group.checks).find((check) => check.id === id)?.status;
const check = (evaluation: Evaluation, id: CheckId) => evaluation.readiness.groups.flatMap((group) => group.checks).find((entry) => entry.id === id);
const AU = SI_EXACT.astronomicalUnitM;

describe('orbit types', () => {
  it('all six destinations exist: LEO, SSO, GEO, Moon, Mars and heliocentric', () => {
    expect([...DESTINATION_IDS]).toEqual(['leo', 'sso', 'geo', 'moon', 'mars', 'helio']);
    expect(DESTINATIONS.map((destination) => destination.id)).toEqual([...DESTINATION_IDS]);
  });

  it.each(DESTINATION_IDS)('%s: the default mission closes and the orbit report is complete and finite', (id) => {
    const evaluation = evaluateMission(make(id));
    expect(evaluation.feasible, JSON.stringify(evaluation.issues.map((i) => i.code))).toBe(true);
    expect(evaluation.readiness.launchReady).toBe(true);
    const orbit = evaluation.details!.orbit;
    for (const value of [orbit.period, orbit.speedAtPeriapsis, orbit.speedAtApoapsis, orbit.circularSpeed, orbit.semiMajorAxis, orbit.eccentricity]) {
      expect(Number.isFinite(value.value) && value.value >= 0, id).toBe(true);
    }
    expect(orbit.periapsisRadius.value).toBeLessThanOrEqual(orbit.apoapsisRadius.value);
    expect(orbit.speedAtPeriapsis.value).toBeGreaterThanOrEqual(orbit.speedAtApoapsis.value);
  });

  it('the periods match textbook values', () => {
    const period = (id: DestinationId) => evaluateMission(make(id)).details!.orbit.period.value;
    expect(period('leo') / 60).toBeCloseTo(94.6, 0); // 500 km
    expect(period('sso') / 60).toBeCloseTo(96.7, 0); // 600 km
    expect(period('geo')).toBeCloseTo(86_164, -1); // one sidereal day
    expect(period('moon') / 60).toBeCloseTo(118, 0); // 100 km above the Moon
    expect(period('mars') / 3600).toBeCloseTo(1.99, 1); // 400 km above Mars
    expect(period('helio') / 86_400).toBeGreaterThan(330);
    expect(period('helio') / 86_400).toBeLessThan(400);
  });

  it('speeds: ~7.6 km/s in LEO, ~3.07 km/s at geostationary height, ~30 km/s heliocentric', () => {
    expect(evaluateMission(make('leo')).details!.orbit.circularSpeed.value / 1e3).toBeCloseTo(7.61, 1);
    expect(evaluateMission(make('geo')).details!.orbit.circularSpeed.value / 1e3).toBeCloseTo(3.075, 2);
    expect(evaluateMission(make('helio')).details!.orbit.circularSpeed.value / 1e3).toBeCloseTo(29.5, 0);
  });

  it('agrees with the existing physics Kepler code (AU, day units)', () => {
    const gmAuDay = valueIn(BODIES.earth.gm, 'm^3/s^2') / (AU ** 3 / 86_400 ** 2);
    for (const id of ['leo', 'sso', 'geo'] as const) {
      const orbit = evaluateMission(make(id)).details!.orbit;
      const fromPhysics = keplerPeriod(gmAuDay, orbit.semiMajorAxis.value / AU) * 86_400;
      expect(orbit.period.value / fromPhysics, id).toBeCloseTo(1, 9);
    }
  });

  it('eccentricity follows the apsides', () => {
    const base = make('leo');
    const eccentric = setOrbit(base, { periapsisAltKm: 400, apoapsisAltKm: 1200 }).mission;
    const orbit = evaluateMission(eccentric).details!.orbit;
    const rp = 6378.137 + 400;
    const ra = 6378.137 + 1200;
    expect(orbit.eccentricity.value).toBeCloseTo((ra - rp) / (ra + rp), 9);
    expect(orbit.speedAtPeriapsis.value).toBeGreaterThan(orbit.speedAtApoapsis.value);
    expect(evaluateMission(base).details!.orbit.eccentricity.value).toBeCloseTo(0, 12);
  });
});

describe('changing orbit parameters recomputes everything', () => {
  it('a higher LEO has a longer period, a slower speed and needs more Δv', () => {
    const low = evaluateMission(make('leo')).details!;
    const high = evaluateMission(setOrbit(make('leo'), { periapsisAltKm: 1200, apoapsisAltKm: 1200 }).mission).details!;
    expect(high.orbit.period.value).toBeGreaterThan(low.orbit.period.value);
    expect(high.orbit.circularSpeed.value).toBeLessThan(low.orbit.circularSpeed.value);
    expect(high.deltaV.required.value).toBeGreaterThan(low.deltaV.required.value);
    expect(high.power.eclipseDuration.value).not.toBe(low.power.eclipseDuration.value);
  });

  it('the inclination change from the site reference is priced in the Δv', () => {
    const base = make('leo');
    const dv = (deg: number) => evaluateMission(setOrbit(base, { inclinationDeg: deg }).mission).details!.deltaV.required.value;
    expect(dv(51.6)).toBeLessThan(dv(40) + 1); // inside the Cape corridor: both direct
    const outside = evaluateMission(setOrbit(base, { inclinationDeg: 20 }).mission).details!.deltaV;
    expect(outside.site!.shortfallDeg).toBeCloseTo(8.5, 6);
    expect(outside.site!.extra.value).toBeGreaterThan(900);
    expect(evaluateMission(setOrbit(base, { inclinationDeg: 40 }).mission).details!.deltaV.site!.shortfallDeg).toBe(0);
  });

  it('a heliocentric orbit that crosses 1 AU needs no insertion burn; one wholly inside needs one', () => {
    const base = make('helio');
    const alt = (au: number) => Math.round(au * 149_597_870.7 - 695_700);
    const crossing = evaluateMission(base).details!.deltaV;
    expect(crossing.steps[0]!.value.value).toBe(0);
    const inside = evaluateMission(setOrbit(base, { periapsisAltKm: alt(0.7), apoapsisAltKm: alt(0.8) }).mission).details!.deltaV;
    expect(inside.steps[0]!.value.value).toBeGreaterThan(100);
    expect(inside.departureC3!.required.value / 1e6).toBeCloseTo(7.6, 0); // Hohmann out to 0.7 AU
    expect(inside.departureC3!.required.value).toBeGreaterThan(crossing.departureC3!.required.value);
  });

  it('an orbit that just touches 1 AU is continuous with the crossing case (no jump in C3 or burn)', () => {
    const alt = (au: number) => Math.round(au * 149_597_870.7 - 695_700);
    const touching = evaluateMission(setOrbit(make('helio'), { periapsisAltKm: alt(0.7), apoapsisAltKm: alt(1.0) }).mission).details!.deltaV;
    const crossing = evaluateMission(setOrbit(make('helio'), { periapsisAltKm: alt(0.7), apoapsisAltKm: alt(1.0) + 1_000_000 }).mission).details!.deltaV;
    expect(touching.departureC3!.required.value / 1e6).toBeGreaterThan(7);
    expect(touching.departureC3!.required.value / 1e6).toBeLessThan(8.3);
    expect(touching.steps[0]!.value.value).toBeLessThan(150);
    expect(Math.abs(touching.departureC3!.required.value - crossing.departureC3!.required.value) / 1e6).toBeLessThan(3); // a crossing at an angle adds a radial component to v∞
  });

  it('a very close heliocentric perihelion cannot be reached with this launch energy', () => {
    const alt = (au: number) => Math.round(au * 149_597_870.7 - 695_700);
    const evaluation = evaluateMission(setOrbit(make('helio'), { periapsisAltKm: alt(0.5), apoapsisAltKm: alt(1.0) }).mission);
    expect(evaluation.issues.map((i) => i.code)).toContain('departure-energy-insufficient');
    expect(status(evaluation, 'departure-energy')).toBe('fail');
    expect(evaluation.readiness.launchReady).toBe(false);
  });

  it('there is no eclipse and no spurious battery warning on a heliocentric orbit', () => {
    const evaluation = evaluateMission(make('helio'));
    expect(evaluation.details!.power.eclipseDuration.value).toBe(0);
    expect(evaluation.issues.map((i) => i.code)).not.toContain('battery-margin-tight');
  });
});

describe('sun-synchronous inclination', () => {
  it('matches the known values', () => {
    expect(sunSynchronousInclinationDeg(600, 600)).toBeCloseTo(97.79, 2);
    expect(sunSynchronousInclinationDeg(800, 800)).toBeCloseTo(98.6, 1);
    expect(sunSynchronousInclinationDeg(500, 500)).toBeCloseTo(97.4, 1);
  });
  it('exists only below about 6,000 km', () => {
    expect(sunSynchronousInclinationDeg(5000, 5000)).not.toBeNull();
    expect(sunSynchronousInclinationDeg(6500, 6500)).toBeNull();
  });
  it('the orbit precesses with the Sun at that inclination (drift ≈ 0) and not at others', () => {
    const exact = setSunSynchronousInclination(setOrbit(make('sso'), { periapsisAltKm: 700, apoapsisAltKm: 700 }).mission).mission;
    const facts = evaluateMission(exact).details!.orbit.sunSynchronous!;
    expect(Math.abs(facts.localTimeDriftMinPerDay)).toBeLessThan(0.05);
    expect(facts.sunRateDegPerDay).toBeCloseTo(0.9856, 3);
    const off = evaluateMission(setOrbit(exact, { inclinationDeg: exact.orbit.inclinationDeg + 1 }).mission).details!.orbit.sunSynchronous!;
    expect(Math.abs(off.localTimeDriftMinPerDay)).toBeGreaterThan(0.3);
  });
  it('the default SSO mission is sun-synchronous and passes; a 90° orbit fails; the button repairs it', () => {
    const base = make('sso');
    expect(status(evaluateMission(base), 'orbit-purpose')).toBe('pass');
    const wrong = setOrbit(base, { inclinationDeg: 98.9 }).mission; // 600 km needs 97.79°: 1.1° off
    expect(status(evaluateMission(wrong), 'orbit-purpose')).toBe('warning');
    const bad = setOrbit(base, { inclinationDeg: 99.5 }).mission;
    const badEvaluation = evaluateMission(bad);
    expect(status(badEvaluation, 'orbit-purpose')).toBe('fail');
    expect(badEvaluation.readiness.launchReady).toBe(false);
    expect(check(badEvaluation, 'orbit-purpose')!.fix!.en).toMatch(/sun-synchronous/i);
    const repaired = setSunSynchronousInclination(bad);
    expect(repaired.error).toBeUndefined();
    expect(status(evaluateMission(repaired.mission), 'orbit-purpose')).toBe('pass');
  });
  it('is refused for non-Earth destinations', () => {
    expect(setSunSynchronousInclination(make('mars')).error).toBe('invalid-value');
  });
});

describe('launch vehicles', () => {
  it('the catalog keeps the four generic classes with provenance on every number', () => {
    expect(LAUNCHERS).toHaveLength(4);
    for (const launcher of LAUNCHERS) {
      expect(['estimated', 'fictional']).toContain(launcher.cost.provenance);
      expect(launcher.reliability.provenance).toBe('estimated');
      for (const capacity of Object.values(launcher.capacity)) expect(capacity?.provenance).toBe('estimated');
    }
  });

  it('capacity: a spacecraft above the vehicle capacity fails the launch-mass check', () => {
    const base = make('sso');
    expect(status(evaluateMission(base), 'launch-mass')).toBe('pass');
    const heavy = setPropellantMass(base, 25).mission;
    const tooSmall = setLauncher(base, 'launcher-small').mission;
    expect(tooSmall.launch.vehicleId).toBe('launcher-small');
    // Add mass until the small launcher (200 kg to SSO) is exceeded.
    const loaded = setPartQuantity(setPartQuantity(heavy, 'battery-1000wh', 6).mission, 'solar-wing-4', 4).mission;
    const evaluation = evaluateMission(loaded);
    expect(evaluation.details!.mass.launch.value).toBeGreaterThan(200);
    expect(status(evaluation, 'launch-mass')).toBe('fail');
    expect(evaluation.readiness.launchReady).toBe(false);
    expect(check(evaluation, 'launch-mass')!.fix!.en).toMatch(/launch vehicle/i);
  });

  it('a larger vehicle fixes it', () => {
    const base = setPartQuantity(setPartQuantity(make('sso'), 'battery-1000wh', 6).mission, 'solar-wing-4', 4).mission;
    const fixed = setLauncher(base, 'launcher-medium').mission;
    expect(status(evaluateMission(fixed), 'launch-mass')).toBe('pass');
  });

  it('a thin capacity margin is a warning', () => {
    const base = make('sso');
    const capacity = valueIn(LAUNCHERS.find((l) => l.id === 'launcher-small')!.capacity.sso!, 'kg');
    const used = evaluateMission(base).details!.mass.launch.value;
    expect(used).toBeLessThan(capacity);
    const tight = setPropellantMass(base, Math.max(0, capacity * 0.95 - (used - base.spacecraft.propellantMassKg))).mission;
    const evaluation = evaluateMission(tight);
    expect(['warning', 'fail']).toContain(status(evaluation, 'launch-mass'));
  });

  it('a vehicle that cannot reach the target fails, and unknown vehicles make the mission unresolvable', () => {
    const geoOnSmall = setLauncher(make('geo'), 'launcher-small').mission;
    expect(status(evaluateMission(geoOnSmall), 'launcher-reaches-target')).toBe('fail');
    const unknown = { ...make('leo'), launch: { vehicleId: 'nope', siteId: 'site-cape-canaveral' } };
    const evaluation = evaluateMission(unknown);
    expect(evaluation.status).toBe('unresolvable');
    expect(evaluation.readiness.unresolvable).toBe(true);
    expect(evaluation.readiness.launchReady).toBe(false);
    expect(evaluation.readiness.overall).toBe('fail');
  });

  it('Moon, Mars and heliocentric missions are served by the escape targets', () => {
    for (const id of ['moon', 'mars', 'helio'] as const) {
      const evaluation = evaluateMission(make(id));
      expect(evaluation.details!.mass.launcherCapacity!.value, id).toBeGreaterThan(1000);
    }
  });
});

describe('launch sites', () => {
  it('the catalog has five sites with sourced coordinates and a corridor starting at the latitude', () => {
    expect(LAUNCH_SITES).toHaveLength(5);
    for (const site of LAUNCH_SITES) {
      expect(['measured', 'estimated']).toContain(site.latitude.provenance);
      expect(site.latitude.source?.length ?? 0).toBeGreaterThan(10);
      expect(site.longitude.source?.length ?? 0).toBeGreaterThan(10);
      expect(valueIn(site.inclinationRange.min, 'deg')).toBeGreaterThanOrEqual(Math.abs(valueIn(site.latitude, 'deg')) - 0.5);
      expect(valueIn(site.inclinationRange.max, 'deg')).toBeGreaterThan(valueIn(site.inclinationRange.min, 'deg'));
      expect(site.inclinationRange.min.provenance).toBe('estimated');
      for (const id of site.launcherIds) expect(LAUNCHERS.some((l) => l.id === id), id).toBe(true);
      expect(site.restrictions.length).toBeGreaterThan(0);
    }
    expect(getLaunchSite('site-kourou')).toBeDefined();
    expect(getLaunchSite('nope')).toBeUndefined();
  });

  it('every launcher flies from at least one site', () => {
    for (const launcher of LAUNCHERS) expect(LAUNCH_SITES.some((site) => site.launcherIds.includes(launcher.id)), launcher.id).toBe(true);
  });

  it('a site that does not host the vehicle fails', () => {
    const wrong = setLaunchSite(make('geo'), 'site-mahia').mission; // small-lift only
    const evaluation = evaluateMission(wrong);
    expect(status(evaluation, 'site-hosts-launcher')).toBe('fail');
    expect(evaluation.issues.map((i) => i.code)).toContain('launcher-not-at-site');
    expect(check(evaluation, 'site-hosts-launcher')!.fix).not.toBeNull();
    expect(evaluation.readiness.launchReady).toBe(false);
  });

  it('SSO from Cape Canaveral cannot be flown (no polar launches); from Vandenberg it can', () => {
    const cape = evaluateMission(setLaunchSite(make('sso'), 'site-cape-canaveral').mission);
    expect(status(cape, 'site-inclination')).toBe('fail');
    expect(cape.issues.map((i) => i.code)).toContain('site-cannot-reach-inclination');
    expect(cape.readiness.launchReady).toBe(false);
    expect(status(evaluateMission(make('sso')), 'site-inclination')).toBe('pass');
  });

  it('a modest corridor miss is a warning with its Δv cost, not a failure', () => {
    // LEO at 28.5° from Vandenberg (corridor 70–105): 41.5° short — too far, so fail; at 62° it is 8° short.
    const base = setLaunchSite(make('leo'), 'site-vandenberg').mission;
    const near = evaluateMission(setOrbit(base, { inclinationDeg: 62 }).mission);
    expect(status(near, 'site-inclination')).toBe('warning');
    expect(near.issues.find((i) => i.code === 'site-inclination-penalty')!.values.extraDeltaVMS).toBeGreaterThan(500);
    expect(status(evaluateMission(setOrbit(base, { inclinationDeg: 30 }).mission), 'site-inclination')).toBe('fail');
  });

  it('Kourou saves Δv for a geostationary mission compared with Cape Canaveral', () => {
    const cape = evaluateMission(make('geo')).details!.deltaV.required.value;
    const kourou = evaluateMission(setLaunchSite(make('geo'), 'site-kourou').mission).details!.deltaV.required.value;
    expect(kourou).toBeLessThan(cape);
    expect(status(evaluateMission(make('geo')), 'site-inclination')).toBe('pass');
  });

  it('for escape trajectories the site inclination does not enter the model', () => {
    const a = evaluateMission(make('moon')).details!.deltaV.required.value;
    const b = evaluateMission(setLaunchSite(make('moon'), 'site-baikonur').mission).details!.deltaV.required.value;
    expect(b).toBe(a);
    expect(evaluateMission(make('moon')).details!.deltaV.site).toBeNull();
  });

  it('an unknown site makes the mission unresolvable', () => {
    const evaluation = evaluateMission({ ...make('leo'), launch: { vehicleId: 'launcher-small', siteId: 'nope' } });
    expect(evaluation.status).toBe('unresolvable');
    expect(setLaunchSite(make('leo'), 'nope').error).toBe('unknown-site');
  });
});

describe('Δv, budget and statuses', () => {
  it('Δv: no propellant fails, a thin margin warns, plenty passes', () => {
    const base = make('geo');
    expect(status(evaluateMission(base), 'delta-v')).toBe('warning'); // the GEO template is deliberately thin
    expect(status(evaluateMission(setPropellantMass(base, 0).mission), 'delta-v')).toBe('fail');
    expect(status(evaluateMission(make('sso')), 'delta-v')).toBe('pass');
    expect(check(evaluateMission(setPropellantMass(base, 0).mission), 'delta-v')!.fix!.en).toMatch(/propellant/i);
  });

  it('budget: over the limit fails, no limit passes with a note, within passes', () => {
    const base = make('moon');
    expect(status(evaluateMission(base), 'budget')).toBe('pass');
    const over = setRequirement(base, 'max-cost', 50e6).mission;
    expect(status(evaluateMission(over), 'budget')).toBe('fail');
    expect(check(evaluateMission(over), 'budget')!.fix!.en).toMatch(/budget|cheaper/i);
    const none = setRequirement(base, 'max-cost', null).mission;
    expect(check(evaluateMission(none), 'budget')!.reason.en).toMatch(/no budget limit/i);
    const evaluation = evaluateMission(none);
    expect(status(evaluation, 'budget')).toBe('pass');
  });

  it('every check carries English and Uzbek text, and a fix unless it passes', () => {
    const broken = setLaunchSite(setPropellantMass(setRequirement(make('sso'), 'max-cost', 1e6).mission, 0).mission, 'site-cape-canaveral').mission;
    const evaluation = evaluateMission(broken);
    let failing = 0;
    for (const group of evaluation.readiness.groups) {
      for (const entry of group.checks) {
        expect(entry.reason.en.length, entry.id).toBeGreaterThan(5);
        expect(entry.reason.uz.length, entry.id).toBeGreaterThan(5);
        expect(entry.reason.uz, entry.id).not.toMatch(/[Ѐ-ӿ]/);
        if (entry.status === 'pass') expect(entry.fix).toBeNull();
        else {
          failing += 1;
          expect(entry.fix!.en.length, entry.id).toBeGreaterThan(10);
          expect(entry.fix!.uz.length, entry.id).toBeGreaterThan(10);
        }
      }
    }
    expect(failing).toBeGreaterThan(2);
  });
});

describe('mission readiness report', () => {
  it('all seven groups appear for a resolvable mission, in order', () => {
    const report = evaluateMission(make('sso')).readiness;
    expect(report.groups.map((group) => group.group)).toEqual(['spacecraft', 'payload', 'resources', 'orbit', 'launch-vehicle', 'launch-site', 'budget']);
    expect(report.overall).toBe('pass');
    expect(report.launchReady).toBe(true);
    expect(report.counts.fail).toBe(0);
  });

  it('launch-ready exactly when the engine finds no error, for every default and many edits', () => {
    const edits = [
      (m: ReturnType<typeof make>) => m,
      (m: ReturnType<typeof make>) => setPropellantMass(m, 0).mission,
      (m: ReturnType<typeof make>) => setLauncher(m, 'launcher-small').mission,
      (m: ReturnType<typeof make>) => setLaunchSite(m, 'site-mahia').mission,
      (m: ReturnType<typeof make>) => setRequirement(m, 'max-cost', 1e6).mission,
      (m: ReturnType<typeof make>) => setPartQuantity(m, 'comms-x-band-medium', 0).mission,
      (m: ReturnType<typeof make>) => setOrbit(m, { inclinationDeg: 12 }).mission,
    ];
    for (const id of DESTINATION_IDS) {
      for (const edit of edits) {
        const evaluation = evaluateMission(edit(make(id)));
        expect(evaluation.readiness.launchReady, id).toBe(evaluation.feasible);
        expect(evaluation.readiness.overall === 'fail', id).toBe(!evaluation.feasible);
        const failing = evaluation.readiness.groups.flatMap((group) => group.checks).filter((entry) => entry.status === 'fail');
        expect(failing.length > 0, id).toBe(!evaluation.feasible);
        expect(evaluation.readiness.counts.fail).toBe(failing.length);
      }
    }
  });

  it('no FAIL is hidden: every engine error appears in a failing check', () => {
    const evaluation = evaluateMission(setLaunchSite(setPropellantMass(make('sso'), 0).mission, 'site-cape-canaveral').mission);
    const failing = evaluation.readiness.groups.flatMap((group) => group.checks).filter((entry) => entry.status === 'fail');
    for (const issue of evaluation.issues.filter((entry) => entry.severity === 'error')) {
      expect(failing.some((entry) => entry.reason.en.includes(issue.message.en)), issue.code).toBe(true);
    }
  });

  it('a group takes the worst status of its checks and the overall the worst of the groups', () => {
    const evaluation = evaluateMission(setLaunchSite(make('geo'), 'site-mahia').mission);
    for (const group of evaluation.readiness.groups) {
      const order = { pass: 0, warning: 1, fail: 2 } as const;
      expect(group.status).toBe(group.checks.reduce((worst, entry) => (order[entry.status] > order[worst] ? entry.status : worst), 'pass' as 'pass' | 'warning' | 'fail'));
    }
    expect(evaluation.readiness.groups.find((group) => group.group === 'launch-site')!.status).toBe('fail');
    expect(evaluation.readiness.overall).toBe('fail');
  });

  it('warnings alone do not block launch but are listed', () => {
    const evaluation = evaluateMission(make('geo'));
    expect(evaluation.readiness.counts.warning).toBeGreaterThan(0);
    expect(evaluation.readiness.counts.fail).toBe(0);
    expect(evaluation.readiness.overall).toBe('warning');
    expect(evaluation.readiness.launchReady).toBe(true);
  });

  it('an empty mission is never launch-ready', () => {
    const blank = evaluateMission(createBlankMission('mars', { id: 'b', now: NOW, title: 'B' }));
    expect(blank.readiness.launchReady).toBe(false);
    expect(blank.readiness.counts.fail).toBeGreaterThan(3);
  });

  it('changing the destination keeps the design but re-evaluates it honestly', () => {
    const moved = setDestination(make('leo'), 'sso').mission;
    const evaluation = evaluateMission(moved);
    expect(evaluation.readiness.launchReady).toBe(evaluation.feasible);
  });
});

describe('exhaustive issue mapping', () => {
  it('every engine issue code, catalog issue code and requirement kind belongs to a check that exists', () => {
    for (const code of ENGINE_ISSUE_CODES) expect(CHECK_IDS, code).toContain(CHECK_OF_ENGINE_ISSUE[code]);
    const referenceCodes = Object.keys(CHECK_OF_REFERENCE_ISSUE) as MissionIssueCode[];
    for (const code of referenceCodes) expect(CHECK_IDS, code).toContain(CHECK_OF_REFERENCE_ISSUE[code]);
    for (const kind of Object.keys(REQUIREMENT_KINDS) as (keyof typeof REQUIREMENT_KINDS)[]) expect(CHECK_IDS, kind).toContain(CHECK_OF_REQUIREMENT[kind]);
  });

  it('property: any combination of edits yields a consistent report', () => {
    const edit = fc.constantFrom(
      ...(['leo', 'sso', 'geo', 'moon', 'mars', 'helio'] as const),
    );
    fc.assert(
      fc.property(edit, fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 120 }), fc.double({ min: 0, max: 3000, noNaN: true }), (id, siteIndex, inclination, propellant) => {
        const site = LAUNCH_SITES[siteIndex]!;
        let mission = setLaunchSite(make(id), site.id).mission;
        mission = setOrbit(mission, { inclinationDeg: inclination }).mission;
        mission = setPropellantMass(mission, propellant).mission;
        const evaluation = evaluateMission(mission);
        expect(evaluation.readiness.launchReady).toBe(evaluation.feasible);
        const counts = evaluation.readiness.groups.flatMap((group) => group.checks).reduce((sum, entry) => ({ ...sum, [entry.status]: sum[entry.status] + 1 }), { pass: 0, warning: 0, fail: 0 });
        expect(counts).toEqual(evaluation.readiness.counts);
      }),
      { numRuns: 120 },
    );
  });
});

describe('orbit editor conversions', () => {
  it('Earth orbits are edited in km, heliocentric ones in AU, and the round trip is exact', () => {
    const leo = orbitInputs(make('leo'));
    expect(leo.heliocentric).toBe(false);
    expect(leo.periapsis.unit).toBe('km');
    expect(leo.periapsis.value).toBe(500);
    const helio = orbitInputs(make('helio'));
    expect(helio.heliocentric).toBe(true);
    expect(helio.periapsis.unit).toBe('AU');
    expect(helio.periapsis.value).toBeCloseTo(0.95, 3);
    expect(helio.apoapsis.value).toBeCloseTo(1.1, 3);
    const edited = setOrbit(make('helio'), orbitChange(make('helio'), 'periapsis', 0.8)).mission;
    expect(orbitInputs(edited).periapsis.value).toBeCloseTo(0.8, 3);
  });

  it('the allowed range follows the destination, and a fixed orbit is marked locked', () => {
    expect(orbitInputs(make('sso')).periapsis.min).toBe(500);
    expect(orbitInputs(make('sso')).inclination.min).toBe(96.5);
    expect(orbitInputs(make('geo')).periapsis.locked).toBe(true);
    expect(orbitInputs(make('geo')).inclination.locked).toBe(true);
    expect(orbitInputs(make('leo')).periapsis.locked).toBe(false);
  });

  it('typing a periapsis above the apoapsis lifts the apoapsis; typing an apoapsis below lowers the periapsis (never a refused edit)', () => {
    const base = make('leo');
    const raise = setOrbit(base, orbitChange(base, 'periapsis', 900));
    expect(raise.error).toBeUndefined();
    expect(raise.mission.orbit.apoapsisAltKm).toBe(900);
    const lower = setOrbit(base, orbitChange(base, 'apoapsis', 400));
    expect(lower.error).toBeUndefined();
    expect(lower.mission.orbit.periapsisAltKm).toBe(400);
    expect(setOrbit(base, orbitChange(base, 'inclination', 60)).mission.orbit.inclinationDeg).toBe(60);
  });

  it('durations pick a readable unit', () => {
    expect(durationParts(5_700).unit).toBe('min');
    expect(durationParts(86_164).unit).toBe('h');
    expect(durationParts(3.2e7).unit).toBe('d');
  });
});

describe('orbit layout (3D picture data)', () => {
  it.each(DESTINATION_IDS)('%s: a closed, finite ellipse with the right apsides and tilt', (id) => {
    const mission = make(id);
    const layout = layoutOrbit(mission);
    expect(layout.path.length).toBeGreaterThan(100);
    for (const point of layout.path) expect(point.every(Number.isFinite)).toBe(true);
    const radii = layout.path.map((point) => Math.hypot(...point));
    const unit = layout.unit === 'AU' ? 1 : 1;
    expect(Math.min(...radii) * unit).toBeCloseTo(Math.hypot(...layout.periapsis), 6);
    expect(Math.max(...radii) * unit).toBeCloseTo(Math.hypot(...layout.apoapsis), 3);
    const first = layout.path[0]!;
    const last = layout.path[layout.path.length - 1]!;
    expect(Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2])).toBeLessThan(1e-6);
    expect(layout.extent).toBeGreaterThanOrEqual(Math.hypot(...layout.apoapsis) - 1e-9);
  });

  it('the picture follows the parameters: higher orbit is bigger, inclination tilts the plane, eccentricity stretches it', () => {
    const low = layoutOrbit(make('leo'));
    const high = layoutOrbit(setOrbit(make('leo'), { periapsisAltKm: 1400, apoapsisAltKm: 1400 }).mission);
    expect(Math.hypot(...high.periapsis)).toBeGreaterThan(Math.hypot(...low.periapsis));
    const flat = layoutOrbit(setOrbit(make('leo'), { inclinationDeg: 0 }).mission);
    expect(Math.max(...flat.path.map((point) => Math.abs(point[1])))).toBeLessThan(1e-9);
    const polar = layoutOrbit(setOrbit(make('leo'), { inclinationDeg: 90 }).mission);
    expect(Math.max(...polar.path.map((point) => Math.abs(point[1])))).toBeGreaterThan(1);
    const eccentric = layoutOrbit(setOrbit(make('leo'), { periapsisAltKm: 400, apoapsisAltKm: 4000 }).mission);
    expect(Math.hypot(...eccentric.apoapsis)).toBeGreaterThan(Math.hypot(...eccentric.periapsis) * 1.4);
    expect(eccentric.eccentricity).toBeGreaterThan(0.1);
  });

  it('the Earth-sized body is true to scale; the Sun is flagged as enlarged', () => {
    expect(layoutOrbit(make('leo')).bodyRadius).toBe(1);
    expect(layoutOrbit(make('leo')).bodyScaled).toBe(false);
    expect(layoutOrbit(make('helio')).bodyScaled).toBe(true);
    expect(layoutOrbit(make('helio')).references[0]!.kind).toBe('earth-orbit');
    expect(layoutOrbit(make('helio')).references[0]!.radius).toBeCloseTo(1, 3);
  });
});

describe('launch comparison tables', () => {
  it('launcher rows: capacity, margin, fit and hosting for the current design', () => {
    const mission = make('sso');
    const rows = compareLaunchers(mission, evaluateMission(mission));
    expect(rows.map((row) => row.launcher.id)).toEqual(LAUNCHERS.map((l) => l.id));
    expect(rows.filter((row) => row.selected)).toHaveLength(1);
    const small = rows.find((row) => row.launcher.id === 'launcher-small')!;
    expect(small.capacityKg).toBe(200);
    expect(small.fits).toBe(true);
    expect(small.hostedAtSite).toBe(true); // Vandenberg hosts small
    const superHeavy = rows.find((row) => row.launcher.id === 'launcher-super-heavy')!;
    expect(superHeavy.hostedAtSite).toBe(false);
    expect(superHeavy.capacityKg).toBe(40_000);
    expect(superHeavy.margin!).toBeGreaterThan(0.9);
    const geo = compareLaunchers(make('geo'), evaluateMission(make('geo')));
    expect(geo.find((row) => row.launcher.id === 'launcher-small')!.capacityKg).toBeNull();
    expect(geo.find((row) => row.launcher.id === 'launcher-small')!.fits).toBe(false);
  });

  it('the rows agree with the readiness report', () => {
    for (const id of DESTINATION_IDS) {
      const evaluation = evaluateMission(make(id));
      const selected = compareLaunchers(make(id), evaluation).find((row) => row.selected)!;
      expect(selected.fits, id).toBe(status(evaluation, 'launch-mass') !== 'fail');
    }
  });

  it('site rows agree with the engine for the chosen site', () => {
    for (const siteId of LAUNCH_SITES.map((site) => site.id)) {
      for (const id of ['leo', 'sso', 'geo', 'moon'] as const) {
        const mission = setLaunchSite(make(id), siteId).mission;
        const evaluation = evaluateMission(mission);
        const row = compareSites(mission).find((entry) => entry.selected)!;
        expect(row.site.id).toBe(siteId);
        if (row.reach.kind === 'orbit') expect(row.reach.status, `${id}@${siteId}`).toBe(status(evaluation, 'site-inclination'));
        expect(row.hostsLauncher, `${id}@${siteId}`).toBe(status(evaluation, 'site-hosts-launcher') === 'pass');
        if (row.reach.kind === 'orbit') expect(row.reach.deliveryDeg).toBeCloseTo(evaluation.details!.deltaV.site!.deliveryInclinationDeg, 9);
      }
    }
  });

  it('formats coordinates with hemisphere letters', () => {
    expect(formatCoordinate(28.56, 'lat')).toBe('28.56° N');
    expect(formatCoordinate(-39.26, 'lat')).toBe('39.26° S');
    expect(formatCoordinate(-80.58, 'lon')).toBe('80.58° W');
    expect(formatCoordinate(177.87, 'lon')).toBe('177.87° E');
  });
});
