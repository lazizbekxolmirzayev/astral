import { DEFAULT_CATALOG, type CatalogLookup } from './catalog';
import type { Mission } from './models/mission';
import { toBase } from './units';

/**
 * Referential and compatibility checks on a mission document: do the ids exist,
 * do the parts belong to the right category, and are they allowed at the chosen
 * destination. These are facts about the catalog, not engineering judgements.
 *
 * Whether the design actually closes (mass, power, Δv, link, cost) is the job of
 * the resource engine in Phase 2.
 *
 * Messages are developer diagnostics in English; the UI shows text keyed by `code`.
 */

export type MissionIssueCode =
  | 'unknown-bus'
  | 'unknown-propulsion'
  | 'unknown-part'
  | 'unknown-launcher'
  | 'wrong-category'
  | 'duplicate-part'
  | 'bus-not-for-destination'
  | 'instrument-not-for-destination'
  | 'propellant-without-propulsion'
  | 'propellant-exceeds-capacity'
  | 'launcher-cannot-reach-target'
  | 'orbit-out-of-limits';

export type MissionIssue = { code: MissionIssueCode; path: string; message: string };

/** Issues after which the design cannot be resolved to catalog items, so nothing can be computed. */
export const FATAL_ISSUE_CODES: readonly MissionIssueCode[] = ['unknown-bus', 'unknown-propulsion', 'unknown-part', 'unknown-launcher', 'wrong-category'];

const EPSILON = 1e-6;

export function validateMissionReferences(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): MissionIssue[] {
  const { getDestination, getLauncher, getPart } = catalog;
  const issues: MissionIssue[] = [];
  const add = (code: MissionIssueCode, path: string, message: string) => issues.push({ code, path, message });

  const destinationId = mission.objective.destinationId;
  const destination = getDestination(destinationId);
  if (!destination) throw new Error(`catalog has no destination "${destinationId}"`);

  // Bus
  const bus = getPart(mission.spacecraft.busId);
  if (!bus) add('unknown-bus', 'spacecraft.busId', `no part "${mission.spacecraft.busId}"`);
  else if (bus.category !== 'bus') add('wrong-category', 'spacecraft.busId', `"${bus.id}" is a ${bus.category}, not a bus`);
  else if (!bus.destinations.includes(destinationId)) {
    add('bus-not-for-destination', 'spacecraft.busId', `bus "${bus.id}" cannot fly to ${destinationId}`);
  }

  // Propulsion and propellant
  const { propulsionId, propellantMassKg } = mission.spacecraft;
  if (propulsionId === null) {
    if (propellantMassKg > 0) add('propellant-without-propulsion', 'spacecraft.propellantMassKg', 'propellant is loaded but no propulsion system is chosen');
  } else {
    const propulsion = getPart(propulsionId);
    if (!propulsion) add('unknown-propulsion', 'spacecraft.propulsionId', `no part "${propulsionId}"`);
    else if (propulsion.category !== 'propulsion') {
      add('wrong-category', 'spacecraft.propulsionId', `"${propulsion.id}" is a ${propulsion.category}, not a propulsion system`);
    } else if (propellantMassKg > toBase(propulsion.propellantCapacity) + EPSILON) {
      add('propellant-exceeds-capacity', 'spacecraft.propellantMassKg', `${propellantMassKg} kg exceeds the ${toBase(propulsion.propellantCapacity)} kg the tanks hold`);
    }
  }

  // Other parts
  const seen = new Set<string>();
  mission.spacecraft.parts.forEach((selection, index) => {
    const path = `spacecraft.parts[${index}].itemId`;
    if (seen.has(selection.itemId)) add('duplicate-part', path, `"${selection.itemId}" is listed twice; use the quantity instead`);
    seen.add(selection.itemId);

    const part = getPart(selection.itemId);
    if (!part) return add('unknown-part', path, `no part "${selection.itemId}"`);
    if (part.category === 'bus' || part.category === 'propulsion') {
      return add('wrong-category', path, `"${part.id}" is a ${part.category}; choose it in its own field`);
    }
    if (part.category === 'instrument' && !part.destinations.includes(destinationId)) {
      add('instrument-not-for-destination', path, `instrument "${part.id}" is not available at ${destinationId}`);
    }
  });

  // Launcher
  const launcher = getLauncher(mission.launch.vehicleId);
  if (!launcher) add('unknown-launcher', 'launch.vehicleId', `no launcher "${mission.launch.vehicleId}"`);
  else if (launcher.capacity[destination.deliveryTarget] === undefined) {
    add('launcher-cannot-reach-target', 'launch.vehicleId', `"${launcher.id}" cannot deliver to ${destination.deliveryTarget}`);
  }

  // Orbit limits
  const { altitudeKm, inclinationDeg } = destination.orbitLimits;
  const { periapsisAltKm, apoapsisAltKm, inclinationDeg: inclination } = mission.orbit;
  if (periapsisAltKm < altitudeKm.min - EPSILON || apoapsisAltKm > altitudeKm.max + EPSILON) {
    add('orbit-out-of-limits', 'orbit', `altitude must stay within ${altitudeKm.min}–${altitudeKm.max} km at ${destinationId}`);
  } else if (inclination < inclinationDeg.min - EPSILON || inclination > inclinationDeg.max + EPSILON) {
    add('orbit-out-of-limits', 'orbit.inclinationDeg', `inclination must stay within ${inclinationDeg.min}–${inclinationDeg.max}° at ${destinationId}`);
  }

  return issues;
}
