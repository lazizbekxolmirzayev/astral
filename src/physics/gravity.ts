/**
 * Pairwise Newtonian gravity — pure TypeScript, no React and no Three.js.
 *
 * Units: distances in AU, time in days, mass expressed as the gravitational
 * parameter `gm` in AU³/day². Setting G = 1 in these units means "mass" *is*
 * `gm`, so accelerations, energies and momenta below are all consistent without
 * ever introducing G itself.
 *
 * Input policy: bad numbers are rejected loudly, never silently clamped into a
 * wrong answer. `createState` and `accelerations` throw `PhysicsInputError` on
 * NaN, infinity, negative gravity and absurd magnitudes, because a simulation
 * that quietly returns NaN is worse than one that refuses to start.
 */

/** Bodies beyond this radius are treated as input errors, not physics. */
export const MAX_COORDINATE_AU = 1e6;
/** Speeds beyond this (≈3% of the speed of light in AU/day) are rejected. */
export const MAX_SPEED_AU_PER_DAY = 2500;
/** A `gm` of zero means "no gravity", which is not a body we can integrate. */
export const MIN_GM = 0;

export class PhysicsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhysicsInputError';
  }
}

export type BodyDefinition = {
  id: string;
  /** Gravitational parameter in AU³/day². */
  gm: number;
  /** [x, y, z] in AU. */
  position: readonly [number, number, number];
  /** [vx, vy, vz] in AU/day. */
  velocity: readonly [number, number, number];
};

/**
 * Structure-of-arrays state. The numeric arrays are mutated in place by the
 * integrator; `ids` and `gm` never change after creation, which is what makes a
 * reset a plain array copy.
 */
export type NBodyState = {
  readonly ids: readonly string[];
  readonly gm: Float64Array;
  /** Length 3n: x0,y0,z0,x1,… in AU. */
  readonly positions: Float64Array;
  /** Length 3n: vx0,vy0,vz0,… in AU/day. */
  readonly velocities: Float64Array;
};

export function bodyCount(state: NBodyState): number {
  return state.ids.length;
}

function requireFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new PhysicsInputError(`${label} must be a finite number, got ${String(value)}`);
  }
}

function requireBounded(label: string, value: number, limit: number): void {
  requireFinite(label, value);
  if (Math.abs(value) > limit) {
    throw new PhysicsInputError(`${label} is ${String(value)}, outside the supported range ±${String(limit)}`);
  }
}

/** Rejects anything that would make the integrator produce NaN or spin off. */
export function validateBody(body: BodyDefinition): void {
  if (!body.id) throw new PhysicsInputError('body id must be a non-empty string');
  requireFinite(`body "${body.id}" gm`, body.gm);
  if (body.gm <= MIN_GM) {
    throw new PhysicsInputError(`body "${body.id}" has gm = ${String(body.gm)}; a body needs positive gravity (AU³/day²)`);
  }
  for (const [name, vector, limit] of [
    ['position', body.position, MAX_COORDINATE_AU],
    ['velocity', body.velocity, MAX_SPEED_AU_PER_DAY],
  ] as const) {
    for (let axis = 0; axis < 3; axis += 1) {
      requireBounded(`body "${body.id}" ${name}[${'xyz'[axis]}] (${name} in AU or AU/day)`, vector[axis] as number, limit);
    }
  }
}

export function createState(bodies: readonly BodyDefinition[]): NBodyState {
  if (bodies.length === 0) throw new PhysicsInputError('need at least one body');
  const seen = new Set<string>();
  for (const body of bodies) {
    validateBody(body);
    if (seen.has(body.id)) throw new PhysicsInputError(`duplicate body id "${body.id}"`);
    seen.add(body.id);
  }

  const count = bodies.length;
  const state: NBodyState = {
    ids: bodies.map((body) => body.id),
    gm: new Float64Array(count),
    positions: new Float64Array(count * 3),
    velocities: new Float64Array(count * 3),
  };
  bodies.forEach((body, index) => {
    state.gm[index] = body.gm;
    state.positions.set(body.position, index * 3);
    state.velocities.set(body.velocity, index * 3);
  });
  return state;
}

export function cloneState(state: NBodyState): NBodyState {
  return {
    ids: [...state.ids],
    gm: Float64Array.from(state.gm),
    positions: Float64Array.from(state.positions),
    velocities: Float64Array.from(state.velocities),
  };
}

/** In-place copy, so "reset" does not allocate or swap object identities. */
export function copyState(source: NBodyState, target: NBodyState): void {
  if (source.ids.length !== target.ids.length || source.ids.some((id, i) => id !== target.ids[i])) {
    throw new PhysicsInputError('cannot copy a state onto a different body set');
  }
  target.gm.set(source.gm);
  target.positions.set(source.positions);
  target.velocities.set(source.velocities);
}

/**
 * Softening length in AU. Keeps a close encounter finite: the denominator is
 * (r² + ε²)^{3/2} instead of r³. Zero means pure point-mass gravity.
 */
export function validateSoftening(softening: number): void {
  requireFinite('softening (AU)', softening);
  if (softening < 0) throw new PhysicsInputError(`softening must be ≥ 0 AU, got ${String(softening)}`);
}

/**
 * Writes the Newtonian acceleration of every body into `out` (length 3n) and
 * returns it. Newton's third law is applied pairwise, so the cost is n(n−1)/2
 * and the total momentum stays exactly constant.
 */
export function accelerations(
  state: NBodyState,
  softening: number,
  out: Float64Array = new Float64Array(state.positions.length),
): Float64Array {
  validateSoftening(softening);
  if (out.length !== state.positions.length) {
    throw new PhysicsInputError(`acceleration buffer must hold ${String(state.positions.length)} numbers, got ${String(out.length)}`);
  }
  out.fill(0);

  const { positions, velocities, gm } = state;
  for (let i = 0; i < positions.length; i += 1) {
    requireFinite(`position[${String(i)}] (AU)`, positions[i] as number);
  }
  for (let i = 0; i < velocities.length; i += 1) {
    requireFinite(`velocity[${String(i)}] (AU/day)`, velocities[i] as number);
  }

  const softeningSquared = softening * softening;
  for (let a = 0; a < gm.length; a += 1) {
    for (let b = a + 1; b < gm.length; b += 1) {
      const dx = positions[b * 3] as number - (positions[a * 3] as number);
      const dy = positions[b * 3 + 1] as number - (positions[a * 3 + 1] as number);
      const dz = positions[b * 3 + 2] as number - (positions[a * 3 + 2] as number);
      const distanceSquared = dx * dx + dy * dy + dz * dz + softeningSquared;
      // invDistanceCubed folds the /r from the unit vector into the 1/r² law.
      const invDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
      const pairFactorA = gm[b] * invDistanceCubed;
      const pairFactorB = gm[a] * invDistanceCubed;
      out[a * 3] += pairFactorA * dx;
      out[a * 3 + 1] += pairFactorA * dy;
      out[a * 3 + 2] += pairFactorA * dz;
      out[b * 3] -= pairFactorB * dx;
      out[b * 3 + 1] -= pairFactorB * dy;
      out[b * 3 + 2] -= pairFactorB * dz;
    }
  }
  return out;
}

/** Distance of body `index` from body `centerIndex`, in AU. */
export function distanceBetween(state: NBodyState, index: number, centerIndex: number): number {
  const dx = state.positions[index * 3] as number - (state.positions[centerIndex * 3] as number);
  const dy = state.positions[index * 3 + 1] as number - (state.positions[centerIndex * 3 + 1] as number);
  const dz = state.positions[index * 3 + 2] as number - (state.positions[centerIndex * 3 + 2] as number);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Speed of body `index` relative to body `centerIndex`, in AU/day. */
export function relativeSpeed(state: NBodyState, index: number, centerIndex: number): number {
  const dx = state.velocities[index * 3] as number - (state.velocities[centerIndex * 3] as number);
  const dy = state.velocities[index * 3 + 1] as number - (state.velocities[centerIndex * 3 + 1] as number);
  const dz = state.velocities[index * 3 + 2] as number - (state.velocities[centerIndex * 3 + 2] as number);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
