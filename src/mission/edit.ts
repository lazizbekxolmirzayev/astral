import { DEFAULT_CATALOG, type CatalogLookup } from './catalog';
import { sunSynchronousInclinationDeg } from './engine/orbit';
import type { DestinationId, OrbitSpec } from './models/catalog';
import { MAX_PART_QUANTITY, REQUIREMENT_KINDS, type Mission, type RequirementKind } from './models/mission';

/**
 * Pure editing operations on the mission document. Each one returns a new document
 * (the input is never modified) with `revision` increased by one and `updatedAt`
 * set, or the same document and an `error` when the edit is refused.
 *
 * Edits refuse only what cannot be represented (an unknown id, a full parts list,
 * a mission that is no longer a draft). Whether the resulting design is sensible is
 * not decided here: the resource engine reports it, so a questionable choice is
 * visible rather than silently blocked or corrected.
 */

export type EditError = 'not-draft' | 'unknown-part' | 'wrong-category' | 'unknown-launcher' | 'unknown-site' | 'invalid-value' | 'too-many-parts' | 'not-installed';
export type EditResult = { mission: Mission; error?: EditError };

export const MAX_PART_LINES = 40;
export const MAX_REQUIREMENTS = 12;
export const MAX_OPERATIONS_DAYS = 10_000;

type Context = { now?: string; catalog?: CatalogLookup };

const refuse = (mission: Mission, error: EditError): EditResult => ({ mission, error });

function commit(mission: Mission, change: (draft: Mission) => Mission, context: Context): EditResult {
  if (mission.status !== 'draft') return refuse(mission, 'not-draft');
  const next = change(mission);
  return { mission: { ...next, revision: mission.revision + 1, updatedAt: context.now ?? new Date().toISOString() } };
}

const withSpacecraft = (mission: Mission, spacecraft: Partial<Mission['spacecraft']>): Mission => ({ ...mission, spacecraft: { ...mission.spacecraft, ...spacecraft } });

export function renameMission(mission: Mission, title: string, context: Context = {}): EditResult {
  const trimmed = title.trim().slice(0, 120);
  if (trimmed.length === 0) return refuse(mission, 'invalid-value');
  if (trimmed === mission.title) return { mission };
  return commit(mission, (m) => ({ ...m, title: trimmed }), context);
}

export function setBus(mission: Mission, busId: string, context: Context = {}): EditResult {
  const part = (context.catalog ?? DEFAULT_CATALOG).getPart(busId);
  if (!part) return refuse(mission, 'unknown-part');
  if (part.category !== 'bus') return refuse(mission, 'wrong-category');
  return commit(mission, (m) => withSpacecraft(m, { busId }), context);
}

/** Choosing no propulsion also empties the tanks, because propellant without a tank is meaningless. */
export function setPropulsion(mission: Mission, propulsionId: string | null, context: Context = {}): EditResult {
  if (propulsionId !== null) {
    const part = (context.catalog ?? DEFAULT_CATALOG).getPart(propulsionId);
    if (!part) return refuse(mission, 'unknown-part');
    if (part.category !== 'propulsion') return refuse(mission, 'wrong-category');
  }
  return commit(mission, (m) => withSpacecraft(m, propulsionId === null ? { propulsionId, propellantMassKg: 0 } : { propulsionId }), context);
}

export function setPropellantMass(mission: Mission, kilograms: number, context: Context = {}): EditResult {
  if (!Number.isFinite(kilograms) || kilograms < 0) return refuse(mission, 'invalid-value');
  return commit(mission, (m) => withSpacecraft(m, { propellantMassKg: kilograms }), context);
}

/** Adds one unit of a solar array, battery, radio, computer, attitude system or instrument. */
export function addPart(mission: Mission, itemId: string, context: Context = {}): EditResult {
  const part = (context.catalog ?? DEFAULT_CATALOG).getPart(itemId);
  if (!part) return refuse(mission, 'unknown-part');
  if (part.category === 'bus' || part.category === 'propulsion') return refuse(mission, 'wrong-category');
  const existing = mission.spacecraft.parts.find((line) => line.itemId === itemId);
  if (existing) {
    if (existing.quantity >= MAX_PART_QUANTITY) return refuse(mission, 'too-many-parts');
    return commit(mission, (m) => withSpacecraft(m, { parts: m.spacecraft.parts.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + 1 } : line)) }), context);
  }
  if (mission.spacecraft.parts.length >= MAX_PART_LINES) return refuse(mission, 'too-many-parts');
  return commit(mission, (m) => withSpacecraft(m, { parts: [...m.spacecraft.parts, { itemId, quantity: 1 }] }), context);
}

/** Removes one unit; the line disappears when the last unit goes. */
export function removePart(mission: Mission, itemId: string, context: Context = {}): EditResult {
  const existing = mission.spacecraft.parts.find((line) => line.itemId === itemId);
  if (!existing) return refuse(mission, 'not-installed');
  return setPartQuantity(mission, itemId, existing.quantity - 1, context);
}

export function setPartQuantity(mission: Mission, itemId: string, quantity: number, context: Context = {}): EditResult {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_PART_QUANTITY) return refuse(mission, 'invalid-value');
  const existing = mission.spacecraft.parts.find((line) => line.itemId === itemId);
  if (!existing) return quantity === 0 ? { mission } : addPartWithQuantity(mission, itemId, quantity, context);
  return commit(
    mission,
    (m) => withSpacecraft(m, { parts: quantity === 0 ? m.spacecraft.parts.filter((line) => line.itemId !== itemId) : m.spacecraft.parts.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)) }),
    context,
  );
}

function addPartWithQuantity(mission: Mission, itemId: string, quantity: number, context: Context): EditResult {
  const part = (context.catalog ?? DEFAULT_CATALOG).getPart(itemId);
  if (!part) return refuse(mission, 'unknown-part');
  if (part.category === 'bus' || part.category === 'propulsion') return refuse(mission, 'wrong-category');
  if (mission.spacecraft.parts.length >= MAX_PART_LINES) return refuse(mission, 'too-many-parts');
  return commit(mission, (m) => withSpacecraft(m, { parts: [...m.spacecraft.parts, { itemId, quantity }] }), context);
}

export function setLauncher(mission: Mission, vehicleId: string, context: Context = {}): EditResult {
  if (!(context.catalog ?? DEFAULT_CATALOG).getLauncher(vehicleId)) return refuse(mission, 'unknown-launcher');
  return commit(mission, (m) => ({ ...m, launch: { ...m.launch, vehicleId } }), context);
}

/** Chooses where the vehicle launches from. Whether the site hosts the vehicle and reaches the orbit is reported by the engine, not refused here. */
export function setLaunchSite(mission: Mission, siteId: string, context: Context = {}): EditResult {
  if (!(context.catalog ?? DEFAULT_CATALOG).getLaunchSite(siteId)) return refuse(mission, 'unknown-site');
  if (siteId === mission.launch.siteId) return { mission };
  return commit(mission, (m) => ({ ...m, launch: { ...m.launch, siteId } }), context);
}

/**
 * Changing the destination resets the orbit to that destination's default. Parts
 * and requirements are kept, so anything that no longer fits shows up as an issue.
 */
export function setDestination(mission: Mission, destinationId: DestinationId, context: Context = {}): EditResult {
  const destination = (context.catalog ?? DEFAULT_CATALOG).getDestination(destinationId);
  if (!destination) return refuse(mission, 'invalid-value');
  if (destinationId === mission.objective.destinationId) return { mission };
  return commit(mission, (m) => ({ ...m, objective: { ...m.objective, destinationId }, orbit: { ...destination.defaultOrbit } }), context);
}

export function setOrbit(mission: Mission, orbit: Partial<OrbitSpec>, context: Context = {}): EditResult {
  const next = { ...mission.orbit, ...orbit };
  const finite = [next.periapsisAltKm, next.apoapsisAltKm, next.inclinationDeg].every(Number.isFinite);
  if (!finite || next.periapsisAltKm < 0 || next.apoapsisAltKm < next.periapsisAltKm || next.inclinationDeg < 0 || next.inclinationDeg > 180) return refuse(mission, 'invalid-value');
  return commit(mission, (m) => ({ ...m, orbit: next }), context);
}

/**
 * Sets the inclination to the sun-synchronous value for the current apsis altitudes.
 * Refused for destinations that are not Earth orbits and for altitudes where no
 * sun-synchronous inclination exists (above about 6,000 km).
 */
export function setSunSynchronousInclination(mission: Mission, context: Context = {}): EditResult {
  const destination = (context.catalog ?? DEFAULT_CATALOG).getDestination(mission.objective.destinationId);
  if (!destination || destination.centralBody !== 'earth') return refuse(mission, 'invalid-value');
  const inclination = sunSynchronousInclinationDeg(mission.orbit.periapsisAltKm, mission.orbit.apoapsisAltKm);
  if (inclination === null) return refuse(mission, 'invalid-value');
  return setOrbit(mission, { inclinationDeg: Math.round(inclination * 100) / 100 }, context);
}

export function setOperationsDays(mission: Mission, days: number, context: Context = {}): EditResult {
  if (!Number.isInteger(days) || days < 1 || days > MAX_OPERATIONS_DAYS) return refuse(mission, 'invalid-value');
  return commit(mission, (m) => ({ ...m, plannedOperationsDays: days }), context);
}

/** One requirement per kind: sets its limit, or removes it when `limit` is null. */
export function setRequirement(mission: Mission, kind: RequirementKind, limit: number | null, context: Context = {}): EditResult {
  if (!(kind in REQUIREMENT_KINDS)) return refuse(mission, 'invalid-value');
  const requirements = mission.objective.requirements;
  const existing = requirements.find((requirement) => requirement.kind === kind);
  if (limit === null) {
    if (!existing) return { mission };
    return commit(mission, (m) => ({ ...m, objective: { ...m.objective, requirements: requirements.filter((requirement) => requirement.kind !== kind) } }), context);
  }
  if (!Number.isFinite(limit) || limit <= 0 || (kind === 'min-launch-success' && limit > 1)) return refuse(mission, 'invalid-value');
  if (!existing && requirements.length >= MAX_REQUIREMENTS) return refuse(mission, 'too-many-parts');
  const next = existing ? requirements.map((requirement) => (requirement.kind === kind ? { ...requirement, limit } : requirement)) : [...requirements, { id: `req-${kind}`, kind, limit }];
  return commit(mission, (m) => ({ ...m, objective: { ...m.objective, requirements: next } }), context);
}
