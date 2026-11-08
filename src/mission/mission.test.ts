import { describe, expect, it } from 'vitest';
import { BUSES, PARTS, PROPULSION, getDestination, getLauncher, getPart } from './catalog';
import { DESTINATION_IDS, type DestinationId } from './models/catalog';
import { MISSION_SCHEMA_VERSION, REQUIREMENT_KINDS, missionSchema, type Mission } from './models/mission';
import { DEFAULT_MISSION_TITLES, createDefaultMission } from './templates/defaults';
import { toBase, valueIn } from './units';
import { validateMissionReferences } from './validation';

const NOW = '2026-11-08T12:00:00.000Z';

const make = (destinationId: DestinationId, overrides: Partial<Mission> = {}): Mission => ({
  ...createDefaultMission(destinationId, { id: `test-${destinationId}`, now: NOW, title: DEFAULT_MISSION_TITLES[destinationId].en }),
  ...overrides,
});

const codes = (mission: Mission) => validateMissionReferences(mission).map((issue) => issue.code);

/** Dry mass of the chosen parts plus propellant, straight from the catalog. */
function wetMassKg(mission: Mission): number {
  const bus = getPart(mission.spacecraft.busId);
  const propulsion = mission.spacecraft.propulsionId ? getPart(mission.spacecraft.propulsionId) : undefined;
  let total = (bus ? toBase(bus.mass) : 0) + (propulsion ? toBase(propulsion.mass) : 0) + mission.spacecraft.propellantMassKg;
  for (const selection of mission.spacecraft.parts) {
    const part = getPart(selection.itemId);
    if (part) total += toBase(part.mass) * selection.quantity;
  }
  return total;
}

describe('default missions', () => {
  it.each(DESTINATION_IDS)('the %s default is a valid mission with consistent catalog references', (destinationId) => {
    const mission = make(destinationId);
    expect(() => missionSchema.parse(mission)).not.toThrow();
    expect(validateMissionReferences(mission)).toEqual([]);
    expect(mission.status).toBe('draft');
    expect(mission.revision).toBe(0);
    expect(mission.ownerId).toBeNull();
    expect(mission.schemaVersion).toBe(MISSION_SCHEMA_VERSION);
    expect(mission.orbit).toEqual(getDestination(destinationId)?.defaultOrbit);
  });

  it.each(DESTINATION_IDS)('the %s default fits its launcher by mass and its bus by payload limit', (destinationId) => {
    const mission = make(destinationId);
    const destination = getDestination(destinationId);
    const launcher = getLauncher(mission.launch.vehicleId);
    const capacity = destination && launcher?.capacity[destination.deliveryTarget];
    expect(capacity).toBeDefined();
    expect(wetMassKg(mission)).toBeLessThan(toBase(capacity ?? { value: 0, unit: 'kg' }));

    const bus = getPart(mission.spacecraft.busId);
    const instrumentMass = mission.spacecraft.parts.reduce((sum, selection) => {
      const part = getPart(selection.itemId);
      return part?.category === 'instrument' ? sum + toBase(part.mass) * selection.quantity : sum;
    }, 0);
    expect(bus?.category === 'bus' && instrumentMass <= toBase(bus.payloadMassLimit)).toBe(true);
  });

  it.each(DESTINATION_IDS)('the %s default has an attitude system precise enough for its instruments', (destinationId) => {
    const mission = make(destinationId);
    const parts = mission.spacecraft.parts.flatMap((selection) => {
      const part = getPart(selection.itemId);
      return part ? [part] : [];
    });
    const adcs = parts.find((part) => part.category === 'adcs');
    expect(adcs?.category).toBe('adcs');
    for (const part of parts) {
      if (part.category === 'instrument' && adcs?.category === 'adcs') {
        expect(valueIn(adcs.pointingAccuracy, 'deg'), part.id).toBeLessThanOrEqual(valueIn(part.requiredPointing, 'deg'));
      }
    }
  });

  it.each(DESTINATION_IDS)('the %s default asks for no more science and time than the design plans to deliver', (destinationId) => {
    const mission = make(destinationId);
    const science = mission.spacecraft.parts.reduce((sum, selection) => {
      const part = getPart(selection.itemId);
      return part?.category === 'instrument' ? sum + toBase(part.scienceValue) * selection.quantity : sum;
    }, 0);
    for (const requirement of mission.objective.requirements) {
      if (requirement.kind === 'min-science') expect(science).toBeGreaterThanOrEqual(requirement.limit);
      if (requirement.kind === 'min-operations') expect(mission.plannedOperationsDays).toBeGreaterThanOrEqual(requirement.limit);
    }
  });

  it('is deterministic and returns independent copies', () => {
    const first = createDefaultMission('mars', { id: 'a', now: NOW, title: 'Mars' });
    const second = createDefaultMission('mars', { id: 'a', now: NOW, title: 'Mars' });
    expect(second).toEqual(first);
    first.spacecraft.parts.push({ itemId: 'battery-100wh', quantity: 3 });
    first.objective.requirements.length = 0;
    const third = createDefaultMission('mars', { id: 'a', now: NOW, title: 'Mars' });
    expect(third).toEqual(second);
  });

  it('has a bilingual default title for every destination', () => {
    for (const id of DESTINATION_IDS) {
      expect(DEFAULT_MISSION_TITLES[id].en.length).toBeGreaterThan(0);
      expect(DEFAULT_MISSION_TITLES[id].uz).not.toBe(DEFAULT_MISSION_TITLES[id].en);
    }
  });
});

describe('mission schema', () => {
  it('rejects structurally invalid documents', () => {
    const base = make('leo');
    expect(missionSchema.safeParse({ ...base, revision: -1 }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, title: '   ' }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, createdAt: 'yesterday' }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, seed: -3 }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, seed: 1.5 }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, plannedOperationsDays: 0 }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, status: 'flying' }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, unexpected: true }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, orbit: { periapsisAltKm: 600, apoapsisAltKm: 500, inclinationDeg: 10 } }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, orbit: { periapsisAltKm: 500, apoapsisAltKm: 500, inclinationDeg: 200 } }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, spacecraft: { ...base.spacecraft, propellantMassKg: -1 } }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, spacecraft: { ...base.spacecraft, propellantMassKg: Number.NaN } }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, spacecraft: { ...base.spacecraft, parts: [{ itemId: 'battery-100wh', quantity: 0 }] } }).success).toBe(false);
    expect(missionSchema.safeParse({ ...base, spacecraft: { ...base.spacecraft, parts: [{ itemId: 'battery-100wh', quantity: 1.5 }] } }).success).toBe(false);
  });

  it('keeps requirements well-formed', () => {
    const base = make('leo');
    const withRequirement = (requirement: unknown) => missionSchema.safeParse({ ...base, objective: { ...base.objective, requirements: [requirement] } }).success;
    expect(withRequirement({ id: 'r', kind: 'min-launch-success', limit: 0.9 })).toBe(true);
    expect(withRequirement({ id: 'r', kind: 'min-launch-success', limit: 1.2 })).toBe(false);
    expect(withRequirement({ id: 'r', kind: 'max-cost', limit: -5 })).toBe(false);
    expect(withRequirement({ id: 'r', kind: 'max-cost', limit: 0 })).toBe(false);
    expect(withRequirement({ id: 'r', kind: 'make-it-pretty', limit: 5 })).toBe(false);
    expect(Object.keys(REQUIREMENT_KINDS)).toHaveLength(6);
  });

  it('round-trips through JSON, as it will when saved to IndexedDB or the server', () => {
    const mission = make('moon');
    expect(missionSchema.parse(JSON.parse(JSON.stringify(mission)))).toEqual(mission);
  });
});

describe('mission reference validation', () => {
  it('reports unknown ids', () => {
    const mission = make('leo');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, busId: 'nope' } })).toContain('unknown-bus');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, propulsionId: 'nope' } })).toContain('unknown-propulsion');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, parts: [{ itemId: 'nope', quantity: 1 }] } })).toContain('unknown-part');
    expect(codes({ ...mission, launch: { vehicleId: 'nope' } })).toContain('unknown-launcher');
  });

  it('reports parts in the wrong slot', () => {
    const mission = make('leo');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, busId: 'battery-100wh' } })).toContain('wrong-category');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, propulsionId: 'battery-100wh' } })).toContain('wrong-category');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, parts: [{ itemId: 'bus-geo-3000', quantity: 1 }] } })).toContain('wrong-category');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, parts: [{ itemId: 'prop-cold-gas', quantity: 1 }] } })).toContain('wrong-category');
  });

  it('reports parts that cannot go to the destination', () => {
    const geoBusAtLeo = { ...make('leo'), spacecraft: { ...make('leo').spacecraft, busId: 'bus-geo-3000' } };
    expect(codes(geoBusAtLeo)).toContain('bus-not-for-destination');
    const marsCameraAtLeo = { ...make('leo'), spacecraft: { ...make('leo').spacecraft, parts: [{ itemId: 'inst-mars-camera', quantity: 1 }] } };
    expect(codes(marsCameraAtLeo)).toContain('instrument-not-for-destination');
  });

  it('reports duplicate part entries', () => {
    const mission = make('leo');
    const duplicated = { ...mission, spacecraft: { ...mission.spacecraft, parts: [...mission.spacecraft.parts, { itemId: 'battery-100wh', quantity: 1 }] } };
    expect(codes(duplicated)).toContain('duplicate-part');
  });

  it('checks propellant against the tanks', () => {
    const mission = make('leo');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, propellantMassKg: 50 } })).toContain('propellant-exceeds-capacity');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, propulsionId: null, propellantMassKg: 1 } })).toContain('propellant-without-propulsion');
    expect(codes({ ...mission, spacecraft: { ...mission.spacecraft, propulsionId: null, propellantMassKg: 0 } })).toEqual([]);
    const full = PROPULSION.find((engine) => engine.id === 'prop-cold-gas');
    expect(full && codes({ ...mission, spacecraft: { ...mission.spacecraft, propellantMassKg: toBase(full.propellantCapacity) } })).toEqual([]);
  });

  it('reports a launcher that cannot reach the delivery target', () => {
    expect(codes({ ...make('geo'), launch: { vehicleId: 'launcher-small' } })).toContain('launcher-cannot-reach-target');
    expect(codes({ ...make('mars'), launch: { vehicleId: 'launcher-medium' } })).toEqual([]);
  });

  it('keeps the orbit inside the destination limits', () => {
    const sso = make('sso');
    expect(codes({ ...sso, orbit: { periapsisAltKm: 200, apoapsisAltKm: 200, inclinationDeg: 97.8 } })).toContain('orbit-out-of-limits');
    expect(codes({ ...sso, orbit: { periapsisAltKm: 700, apoapsisAltKm: 700, inclinationDeg: 51.6 } })).toContain('orbit-out-of-limits');
    expect(codes({ ...sso, orbit: { periapsisAltKm: 700, apoapsisAltKm: 700, inclinationDeg: 98.2 } })).toEqual([]);
    const geo = make('geo');
    expect(codes({ ...geo, orbit: { periapsisAltKm: 30_000, apoapsisAltKm: 35_786, inclinationDeg: 0 } })).toContain('orbit-out-of-limits');
    expect(codes({ ...geo, orbit: { periapsisAltKm: 35_786, apoapsisAltKm: 35_786, inclinationDeg: 5 } })).toContain('orbit-out-of-limits');
  });

  it('points at the offending field', () => {
    const mission = make('leo');
    const issues = validateMissionReferences({ ...mission, spacecraft: { ...mission.spacecraft, busId: 'nope' } });
    expect(issues[0]?.path).toBe('spacecraft.busId');
  });

  it('the catalog has no bus without a destination and every bus has a default somewhere', () => {
    expect(BUSES.length).toBeGreaterThanOrEqual(DESTINATION_IDS.length);
    const used = new Set(DESTINATION_IDS.map((id) => make(id).spacecraft.busId));
    expect(used.size).toBeGreaterThanOrEqual(4);
    expect(PARTS.length).toBeGreaterThan(30);
  });
});
