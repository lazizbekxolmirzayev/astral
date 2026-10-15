/**
 * Conservation diagnostics — pure TypeScript, no React, no Three.js.
 *
 * Everything here is expressed in the simulation's own units (AU, days, `gm` in
 * AU³/day², so G = 1 and "mass" means `gm`). Absolute energies are meaningless
 * outside that unit system, which is why the UI shows *drift* against the value
 * captured at t = 0 rather than the raw numbers.
 *
 * The softening term is included in the potential so energy stays consistent
 * with the force law actually integrated in `gravity.ts`.
 */

import { type NBodyState, MAX_COORDINATE_AU, PhysicsInputError, distanceBetween } from './gravity';

/**
 * Below this magnitude a baseline carries no relative information: dividing any
 * realistic value by it overflows, so `driftPercent` reports 0 instead of an
 * `Infinity %` that would look like a measurement.
 */
export const MIN_DRIFT_REFERENCE = 1e-250;

export type Energy = {
  /** Σ ½·gm·v²  (AU²/day² · AU³/day²). */
  kinetic: number;
  /** −Σ_{i<j} gm_i·gm_j / √(r² + ε²). */
  potential: number;
  total: number;
};

export function totalEnergy(state: NBodyState, softening = 0): Energy {
  if (!Number.isFinite(softening) || softening < 0) {
    throw new PhysicsInputError(`softening must be a finite number ≥ 0, got ${String(softening)}`);
  }
  const { positions, velocities, gm } = state;
  const softeningSquared = softening * softening;

  let kinetic = 0;
  for (let i = 0; i < gm.length; i += 1) {
    const vx = velocities[i * 3] as number;
    const vy = velocities[i * 3 + 1] as number;
    const vz = velocities[i * 3 + 2] as number;
    kinetic += 0.5 * gm[i] * (vx * vx + vy * vy + vz * vz);
  }

  let potential = 0;
  for (let a = 0; a < gm.length; a += 1) {
    for (let b = a + 1; b < gm.length; b += 1) {
      const dx = positions[b * 3] as number - (positions[a * 3] as number);
      const dy = positions[b * 3 + 1] as number - (positions[a * 3 + 1] as number);
      const dz = positions[b * 3 + 2] as number - (positions[a * 3 + 2] as number);
      potential -= (gm[a] * gm[b]) / Math.sqrt(dx * dx + dy * dy + dz * dz + softeningSquared);
    }
  }

  return { kinetic, potential, total: kinetic + potential };
}

/**
 * Total angular momentum, measured about the system centre of mass so the value
 * does not depend on how the whole system happens to drift through the frame.
 */
export function angularMomentum(state: NBodyState): { x: number; y: number; z: number; magnitude: number } {
  const { positions, velocities, gm } = state;
  let mass = 0;
  const center = [0, 0, 0];
  const velocity = [0, 0, 0];
  for (let i = 0; i < gm.length; i += 1) {
    mass += gm[i];
    for (let axis = 0; axis < 3; axis += 1) {
      center[axis] += gm[i] * (positions[i * 3 + axis] as number);
      velocity[axis] += gm[i] * (velocities[i * 3 + axis] as number);
    }
  }
  if (mass <= 0) throw new PhysicsInputError('angular momentum needs positive total mass');
  for (let axis = 0; axis < 3; axis += 1) {
    center[axis] /= mass;
    velocity[axis] /= mass;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < gm.length; i += 1) {
    const rx = (positions[i * 3] as number) - center[0];
    const ry = (positions[i * 3 + 1] as number) - center[1];
    const rz = (positions[i * 3 + 2] as number) - center[2];
    const vx = (velocities[i * 3] as number) - velocity[0];
    const vy = (velocities[i * 3 + 1] as number) - velocity[1];
    const vz = (velocities[i * 3 + 2] as number) - velocity[2];
    x += gm[i] * (ry * vz - rz * vy);
    y += gm[i] * (rz * vx - rx * vz);
    z += gm[i] * (rx * vy - ry * vx);
  }
  return { x, y, z, magnitude: Math.sqrt(x * x + y * y + z * z) };
}

/**
 * Relative drift as a percentage of the starting value. Returns 0 when the
 * reference carries no relative information — an exactly-zero baseline (an
 * unbound or stationary system) or one so tiny that dividing by it would report
 * `Infinity %` rather than a measurement.
 */
export function driftPercent(current: number, reference: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(reference)) {
    throw new PhysicsInputError(`drift needs finite values, got ${String(current)} and ${String(reference)}`);
  }
  if (Math.abs(reference) < MIN_DRIFT_REFERENCE) return 0;
  return ((current - reference) / Math.abs(reference)) * 100;
}

/**
 * Upper bound on a gravity parameter this module will reason about, in
 * AU³/day². The Sun is 2.96e-4, so 1 is already ~3,000x anything real here;
 * beyond it the products below overflow to Infinity.
 */
export const MAX_GM_AU3_PER_DAY2 = 1;

/**
 * Escape speed at distance `r` from a body of parameter `gm`: √(2·gm/r).
 *
 * Units: `gm` in AU³/day², `r` in AU, result in AU/day. 1 AU/day = 1731.5 km/s
 * (from the IAU astronomical unit and the SI second), so the UI can convert.
 */
export function escapeSpeed(gmCentral: number, distanceAu: number): number {
  if (!Number.isFinite(gmCentral) || gmCentral <= 0) {
    throw new PhysicsInputError(`central gm must be positive, got ${String(gmCentral)}`);
  }
  if (gmCentral > MAX_GM_AU3_PER_DAY2) {
    throw new PhysicsInputError(
      `central gm ${String(gmCentral)} AU³/day² exceeds the supported maximum of ${String(MAX_GM_AU3_PER_DAY2)}`,
    );
  }
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) {
    throw new PhysicsInputError(`distance must be a positive number of AU, got ${String(distanceAu)}`);
  }
  if (distanceAu > MAX_COORDINATE_AU) {
    throw new PhysicsInputError(`distance ${String(distanceAu)} AU exceeds the supported maximum of ${String(MAX_COORDINATE_AU)}`);
  }
  return Math.sqrt((2 * gmCentral) / distanceAu);
}

/** AU/day → km/s. 1 AU = 149 597 870.7 km (IAU 2012), 1 day = 86 400 s. */
export const KILOMETRES_PER_SECOND_PER_AU_PER_DAY = 149597870.7 / 86400;

export function toKilometresPerSecond(speedAuPerDay: number): number {
  return speedAuPerDay * KILOMETRES_PER_SECOND_PER_AU_PER_DAY;
}

/** AU → km, for the same reason. */
export function toKilometres(distanceAu: number): number {
  return distanceAu * 149597870.7;
}

/** Per-body view used by the warning system and the diagnostics table. */
export type BodyKinematics = {
  id: string;
  /** Distance from the central body, AU. */
  distanceAu: number;
  /** Speed relative to the central body, AU/day. */
  speedAuPerDay: number;
  /** Parabolic escape speed at that distance, AU/day. */
  escapeSpeedAuPerDay: number;
  /** speed / escape speed. ≥ 1 means the body is unbound from the centre. */
  boundRatio: number;
};

/**
 * Kinematics of every body relative to `centerIndex` (the Sun by convention).
 * The centre itself is skipped: its own distance and speed are 0 by definition.
 */
export function kinematicsRelativeTo(state: NBodyState, centerIndex: number): BodyKinematics[] {
  const gmCentral = state.gm[centerIndex] as number;
  if (!Number.isFinite(gmCentral) || gmCentral <= 0) {
    throw new PhysicsInputError(`centre body must have positive gm, got ${String(gmCentral)}`);
  }
  const rows: BodyKinematics[] = [];
  for (let i = 0; i < state.ids.length; i += 1) {
    if (i === centerIndex) continue;
    const distanceAu = distanceBetween(state, i, centerIndex);
    const dx = state.velocities[i * 3] as number - (state.velocities[centerIndex * 3] as number);
    const dy = state.velocities[i * 3 + 1] as number - (state.velocities[centerIndex * 3 + 1] as number);
    const dz = state.velocities[i * 3 + 2] as number - (state.velocities[centerIndex * 3 + 2] as number);
    const speedAuPerDay = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const escape = distanceAu > 0 ? escapeSpeed(gmCentral, distanceAu) : Number.POSITIVE_INFINITY;
    rows.push({
      id: state.ids[i] as string,
      distanceAu,
      speedAuPerDay,
      escapeSpeedAuPerDay: escape,
      boundRatio: escape > 0 ? speedAuPerDay / escape : 0,
    });
  }
  return rows;
}
