import { describe, expect, it } from 'vitest';
import { evaluateMission } from './engine';
import { addPart, removePart, renameMission, setBus, setDestination, setLauncher, setOperationsDays, setOrbit, setPartQuantity, setPropellantMass, setPropulsion, setRequirement, MAX_PART_LINES } from './edit';
import { DESTINATION_IDS, missionSchema } from './index';
import { createBlankMission } from './templates/blank';
import { createDefaultMission } from './templates/defaults';

const NOW = '2026-02-02T00:00:00.000Z';
const LATER = '2026-03-03T00:00:00.000Z';
const base = () => createDefaultMission('sso', { id: 'm1', now: NOW, title: 'SSO' });
const ctx = { now: LATER };
const lines = (mission: ReturnType<typeof base>) => Object.fromEntries(mission.spacecraft.parts.map((line) => [line.itemId, line.quantity]));

describe('blank missions', () => {
  for (const id of DESTINATION_IDS) {
    it(`${id}: valid, empty, and the engine says what is missing`, () => {
      const mission = createBlankMission(id, { id: `b-${id}`, now: NOW, title: 'Blank' });
      expect(missionSchema.safeParse(mission).success).toBe(true);
      expect(mission.spacecraft.parts).toEqual([]);
      const evaluation = evaluateMission(mission);
      expect(evaluation.referenceIssues).toEqual([]);
      expect(evaluation.feasible).toBe(false);
      const codes = evaluation.issues.map((issue) => issue.code);
      expect(codes).toContain('no-power-source');
      expect(codes).toContain('no-radio');
    });
  }
});

describe('pure edits', () => {
  it('add: a new line, then the quantity grows; the input is never modified', () => {
    const mission = base();
    const snapshot = JSON.stringify(mission);
    const first = addPart(mission, 'battery-100wh', ctx);
    expect(first.error).toBeUndefined();
    expect(lines(first.mission)['battery-100wh']).toBe(1);
    const second = addPart(first.mission, 'battery-100wh', ctx);
    expect(lines(second.mission)['battery-100wh']).toBe(2);
    expect(JSON.stringify(mission)).toBe(snapshot);
  });

  it('every edit bumps the revision and updatedAt, and the result stays schema-valid', () => {
    const mission = base();
    const edited = addPart(mission, 'battery-100wh', ctx).mission;
    expect(edited.revision).toBe(mission.revision + 1);
    expect(edited.updatedAt).toBe(LATER);
    expect(edited.createdAt).toBe(NOW);
    expect(missionSchema.safeParse(edited).success).toBe(true);
  });

  it('remove: one unit at a time, the line goes with the last unit', () => {
    let mission = addPart(addPart(base(), 'battery-100wh', ctx).mission, 'battery-100wh', ctx).mission;
    mission = removePart(mission, 'battery-100wh', ctx).mission;
    expect(lines(mission)['battery-100wh']).toBe(1);
    mission = removePart(mission, 'battery-100wh', ctx).mission;
    expect(lines(mission)['battery-100wh']).toBeUndefined();
    expect(removePart(mission, 'battery-100wh', ctx).error).toBe('not-installed');
  });

  it('setPartQuantity: sets, removes at zero, adds missing, rejects nonsense', () => {
    const mission = base();
    expect(lines(setPartQuantity(mission, 'solar-wing-4', 3, ctx).mission)['solar-wing-4']).toBe(3);
    expect(lines(setPartQuantity(mission, 'solar-wing-4', 0, ctx).mission)['solar-wing-4']).toBeUndefined();
    expect(lines(setPartQuantity(mission, 'battery-100wh', 2, ctx).mission)['battery-100wh']).toBe(2);
    for (const bad of [-1, 1.5, 51, Number.NaN]) expect(setPartQuantity(mission, 'solar-wing-4', bad, ctx).error).toBe('invalid-value');
  });

  it('refuses unknown ids and wrong categories', () => {
    const mission = base();
    expect(addPart(mission, 'nope', ctx).error).toBe('unknown-part');
    expect(addPart(mission, 'bus-cubesat-6u', ctx).error).toBe('wrong-category');
    expect(addPart(mission, 'prop-monoprop', ctx).error).toBe('wrong-category');
    expect(setBus(mission, 'battery-100wh', ctx).error).toBe('wrong-category');
    expect(setPropulsion(mission, 'solar-wing-4', ctx).error).toBe('wrong-category');
    expect(setLauncher(mission, 'nope', ctx).error).toBe('unknown-launcher');
    for (const refused of [addPart(mission, 'nope', ctx), setLauncher(mission, 'nope', ctx)]) expect(refused.mission).toBe(mission);
  });

  it('refuses edits to a mission that is no longer a draft', () => {
    const launched = { ...base(), status: 'launched' as const };
    expect(addPart(launched, 'battery-100wh', ctx).error).toBe('not-draft');
    expect(renameMission(launched, 'x', ctx).error).toBe('not-draft');
  });

  it('limits the number of part lines', () => {
    let mission = createBlankMission('sso', { id: 'b', now: NOW, title: 'B' });
    const ids = ['solar-wing-1', 'solar-wing-4', 'solar-wing-16', 'solar-wing-40', 'solar-body-025', 'battery-100wh', 'battery-1000wh', 'battery-5000wh', 'comms-uhf', 'comms-s-band', 'comms-x-band-medium', 'comms-x-band-hga', 'comms-ka-band-large', 'obc-small', 'obc-standard', 'obc-rad-hard', 'adcs-cubesat', 'adcs-3axis-fine', 'adcs-precision', 'inst-eo-cube-imager', 'inst-eo-multispectral', 'inst-eo-thermal', 'inst-eo-sar', 'inst-geo-transponder', 'inst-moon-neutron', 'inst-moon-camera', 'inst-moon-radar-sounder', 'inst-mars-camera', 'inst-mars-spectrometer', 'inst-mars-radar-sounder', 'inst-particle-suite'];
    for (const id of ids) mission = addPart(mission, id, ctx).mission;
    expect(mission.spacecraft.parts.length).toBeLessThanOrEqual(MAX_PART_LINES);
    expect(addPart(setPartQuantity(mission, 'solar-wing-1', 50, ctx).mission, 'solar-wing-1', ctx).error).toBe('too-many-parts');
  });

  it('propulsion: none empties the tanks; a smaller tank keeps the value and the validator flags it', () => {
    const geo = createDefaultMission('geo', { id: 'g', now: NOW, title: 'G' });
    expect(setPropulsion(geo, null, ctx).mission.spacecraft.propellantMassKg).toBe(0);
    const small = setPropulsion(geo, 'prop-monoprop', ctx).mission;
    expect(small.spacecraft.propellantMassKg).toBe(geo.spacecraft.propellantMassKg);
    expect(evaluateMission(small).referenceIssues.map((issue) => issue.code)).toContain('propellant-exceeds-capacity');
  });

  it('propellant, operations days, orbit and rename validate their input', () => {
    const mission = base();
    expect(setPropellantMass(mission, -1, ctx).error).toBe('invalid-value');
    expect(setPropellantMass(mission, Number.NaN, ctx).error).toBe('invalid-value');
    expect(setPropellantMass(mission, 10, ctx).mission.spacecraft.propellantMassKg).toBe(10);
    expect(setOperationsDays(mission, 0, ctx).error).toBe('invalid-value');
    expect(setOperationsDays(mission, 10_001, ctx).error).toBe('invalid-value');
    expect(setOperationsDays(mission, 100, ctx).mission.plannedOperationsDays).toBe(100);
    expect(setOrbit(mission, { periapsisAltKm: 800, apoapsisAltKm: 700 }, ctx).error).toBe('invalid-value');
    expect(setOrbit(mission, { inclinationDeg: 181 }, ctx).error).toBe('invalid-value');
    expect(setOrbit(mission, { periapsisAltKm: 700, apoapsisAltKm: 700 }, ctx).mission.orbit.periapsisAltKm).toBe(700);
    expect(renameMission(mission, '   ', ctx).error).toBe('invalid-value');
    expect(renameMission(mission, '  New name ', ctx).mission.title).toBe('New name');
    expect(renameMission(mission, mission.title, ctx).mission).toBe(mission);
  });

  it('requirements: one per kind, set, update, remove', () => {
    const mission = base();
    const added = setRequirement(mission, 'min-data-return', 500, ctx).mission;
    expect(added.objective.requirements.find((r) => r.kind === 'min-data-return')?.limit).toBe(500);
    const updated = setRequirement(added, 'min-data-return', 900, ctx).mission;
    expect(updated.objective.requirements.filter((r) => r.kind === 'min-data-return')).toHaveLength(1);
    expect(setRequirement(updated, 'min-data-return', null, ctx).mission.objective.requirements.some((r) => r.kind === 'min-data-return')).toBe(false);
    expect(setRequirement(mission, 'min-launch-success', 1.5, ctx).error).toBe('invalid-value');
    expect(setRequirement(mission, 'max-cost', 0, ctx).error).toBe('invalid-value');
    expect(missionSchema.safeParse(added).success).toBe(true);
  });

  it('destination change resets the orbit and leaves incompatible parts visible as issues', () => {
    const moved = setDestination(base(), 'moon', ctx).mission;
    expect(moved.objective.destinationId).toBe('moon');
    expect(moved.orbit.inclinationDeg).toBe(90);
    const evaluation = evaluateMission(moved);
    expect(evaluation.referenceIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['bus-not-for-destination', 'instrument-not-for-destination']));
    expect(evaluation.feasible).toBe(false);
  });

  it('the engine sees an edit immediately: removing the radio breaks the mission, adding it back fixes it', () => {
    const mission = base();
    expect(evaluateMission(mission).feasible).toBe(true);
    const broken = setPartQuantity(mission, 'comms-x-band-medium', 0, ctx).mission;
    expect(evaluateMission(broken).issues.map((issue) => issue.code)).toContain('no-radio');
    expect(evaluateMission(addPart(broken, 'comms-x-band-medium', ctx).mission).feasible).toBe(true);
  });
});
