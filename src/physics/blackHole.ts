import { PhysicsInputError } from './gravity';

/** CODATA 2022 value, in m^3 kg^-1 s^-2. */
export const NEWTONIAN_GRAVITATIONAL_CONSTANT = 6.6743e-11;
/** Exact SI value, in m s^-1. */
export const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

export type BlackHoleModelCard = {
  title: string;
  scope: string;
  geometry: string;
  tidalRadius: string;
  particleMotion: string;
  validity: string;
  omissions: readonly string[];
};

/** Describes the limits of the quantities and motion exposed by this module. */
export const BLACK_HOLE_MODEL_CARD: BlackHoleModelCard = {
  title: 'Black-hole model card',
  scope: 'Non-rotating, uncharged, isolated black hole and a much lighter test particle.',
  geometry: 'Schwarzschild radius, photon sphere, and ISCO use the exact spherical, non-rotating solution.',
  tidalRadius: 'Order-of-magnitude Newtonian estimate for a spherical self-gravitating body; structure and orbit are not modelled.',
  particleMotion: 'Newtonian point-mass gravity, intended for distances far outside the horizon.',
  validity: 'Heuristic: valid at or beyond 10 Schwarzschild radii, caution between 3 and 10, invalid at or inside 3.',
  omissions: [
    'No relativistic trajectory or light propagation',
    'No black-hole spin or charge',
    'No particle back-reaction, extended-body effects, or tidal evolution',
  ],
};

export type Vec3 = readonly [number, number, number];

export type TestParticleState = {
  positionM: Vec3;
  velocityMPerS: Vec3;
};

export type NewtonianValidity = {
  status: 'valid' | 'caution' | 'invalid';
  distanceM: number;
  schwarzschildRadiusM: number;
  distanceInSchwarzschildRadii: number;
  minimumRecommendedDistanceM: number;
};

function requirePositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PhysicsInputError(`${name} must be a finite positive number`);
  }
}

function requireFiniteVector(name: string, vector: Vec3): void {
  for (let axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(vector[axis])) {
      throw new PhysicsInputError(`${name}[${'xyz'[axis]}] must be finite`);
    }
  }
}

/** Schwarzschild radius in metres for a non-rotating, uncharged black hole. */
export function schwarzschildRadiusM(massKg: number): number {
  requirePositiveFinite('black-hole mass (kg)', massKg);
  return (2 * NEWTONIAN_GRAVITATIONAL_CONSTANT * massKg) / SPEED_OF_LIGHT_M_PER_S ** 2;
}

/** Photon-sphere radius in metres: 1.5 times the Schwarzschild radius. */
export function photonSphereRadiusM(massKg: number): number {
  return 1.5 * schwarzschildRadiusM(massKg);
}

/** Innermost stable circular orbit radius in metres: 3 times the Schwarzschild radius. */
export function iscoRadiusM(massKg: number): number {
  return 3 * schwarzschildRadiusM(massKg);
}

/**
 * Approximate tidal-disruption distance in metres:
 * R_body * (M_blackHole / m_body)^(1/3).
 * This is a scale estimate, not a disruption boundary for every body or orbit.
 */
export function approximateTidalRadiusM(
  blackHoleMassKg: number,
  bodyMassKg: number,
  bodyRadiusM: number,
): number {
  requirePositiveFinite('black-hole mass (kg)', blackHoleMassKg);
  requirePositiveFinite('body mass (kg)', bodyMassKg);
  requirePositiveFinite('body radius (m)', bodyRadiusM);
  return bodyRadiusM * Math.cbrt(blackHoleMassKg / bodyMassKg);
}

/**
 * A conservative validity gauge for the Newtonian point-mass motion below.
 * It is marked valid only at >= 10 r_s, caution from 3–10 r_s, and invalid
 * at or inside 3 r_s (which includes the photon sphere at 1.5 r_s).
 */
export function assessNewtonianValidity(
  blackHoleMassKg: number,
  distanceFromCenterM: number,
): NewtonianValidity {
  const radius = schwarzschildRadiusM(blackHoleMassKg);
  if (!Number.isFinite(distanceFromCenterM) || distanceFromCenterM < 0) {
    throw new PhysicsInputError('particle distance (m) must be finite and non-negative');
  }
  const ratio = distanceFromCenterM / radius;
  return {
    status: ratio <= 3 ? 'invalid' : ratio < 10 ? 'caution' : 'valid',
    distanceM: distanceFromCenterM,
    schwarzschildRadiusM: radius,
    distanceInSchwarzschildRadii: ratio,
    minimumRecommendedDistanceM: 10 * radius,
  };
}

/**
 * Newtonian test-particle acceleration due to a point black-hole mass.
 * SI input/output units: position in metres, acceleration in m/s^2.
 */
export function newtonianTestParticleAccelerationMPerS2(
  blackHoleMassKg: number,
  positionM: Vec3,
): [number, number, number] {
  requirePositiveFinite('black-hole mass (kg)', blackHoleMassKg);
  requireFiniteVector('particle position (m)', positionM);
  const distanceSquared =
    positionM[0] ** 2 + positionM[1] ** 2 + positionM[2] ** 2;
  if (!Number.isFinite(distanceSquared) || distanceSquared === 0) {
    throw new PhysicsInputError('particle position must be a finite, non-zero vector');
  }
  const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
  const factor = -NEWTONIAN_GRAVITATIONAL_CONSTANT * blackHoleMassKg * inverseDistanceCubed;
  return [factor * positionM[0], factor * positionM[1], factor * positionM[2]];
}

/**
 * Advance one test particle by a Newtonian velocity-Verlet step.
 * This is intended only in the gauge's far-field valid range; it does not
 * switch to a relativistic model near the horizon.
 */
export function stepNewtonianTestParticle(
  blackHoleMassKg: number,
  state: TestParticleState,
  deltaSeconds: number,
): TestParticleState {
  requirePositiveFinite('black-hole mass (kg)', blackHoleMassKg);
  requirePositiveFinite('timestep (s)', deltaSeconds);
  requireFiniteVector('particle position (m)', state.positionM);
  requireFiniteVector('particle velocity (m/s)', state.velocityMPerS);

  const accelerationBefore = newtonianTestParticleAccelerationMPerS2(blackHoleMassKg, state.positionM);
  const halfDeltaSquared = 0.5 * deltaSeconds * deltaSeconds;
  const positionM: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    positionM[axis] =
      state.positionM[axis] + state.velocityMPerS[axis] * deltaSeconds +
      accelerationBefore[axis] * halfDeltaSquared;
  }

  const accelerationAfter = newtonianTestParticleAccelerationMPerS2(blackHoleMassKg, positionM);
  const velocityMPerS: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    velocityMPerS[axis] = state.velocityMPerS[axis] +
      0.5 * (accelerationBefore[axis] + accelerationAfter[axis]) * deltaSeconds;
  }

  return { positionM, velocityMPerS };
}
