/**
 * Kepler two-body orbit math — pure, no React and no Three.js (project rule).
 *
 * This module is the *analytic reference*, not the live motion: the simulation
 * integrates Newton's equations in `integrator.ts`, and these closed-form
 * solutions are what the tests compare it against, and what the orbit guide
 * lines are drawn from.
 *
 * Time unit: whatever unit the caller uses for `period` — days in the live
 * simulation. Distances are AU there, scene units in the preview.
 *
 * Geometry: ellipse with the primary at the focus, so
 *   x = a (cos E − e),  z = a √(1 − e²) sin E
 * with E the eccentric anomaly obtained by solving Kepler's equation
 *   M = E − e sin E
 * for M, the mean anomaly (which grows linearly with time).
 */

export type OrbitElements = {
  /** Semi-major axis in the caller's distance unit. */
  semiMajorAxis: number;
  /** Dimensionless, 0 ≤ e < 1. */
  eccentricity: number;
  /** One full revolution, in the caller's time unit. Must be finite and > 0. */
  period: number;
  /** Mean anomaly at time zero, radians. */
  phase: number;
};

export type PlanePosition = { x: number; z: number };

/** A 3-vector as a plain tuple, so this module stays free of Three.js. */
export type Vec3 = readonly [number, number, number];

const TWO_PI = Math.PI * 2;
const NEWTON_ITERATIONS = 8;
const NEWTON_TOLERANCE = 1e-12;

export function meanAnomaly(elements: OrbitElements, time: number): number {
  return elements.phase + (TWO_PI * time) / elements.period;
}

/**
 * Solves Kepler's equation by Newton-Raphson. Converges in a few steps for the
 * eccentricities in this system (max 0.206, Mercury).
 */
export function eccentricAnomaly(M: number, eccentricity: number): number {
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
    const step = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < NEWTON_TOLERANCE) break;
  }
  return E;
}

export function orbitPosition(elements: OrbitElements, time: number): PlanePosition {
  const { semiMajorAxis: a, eccentricity: e } = elements;
  const E = eccentricAnomaly(meanAnomaly(elements, time), e);
  return {
    x: a * (Math.cos(E) - e),
    z: a * Math.sqrt(1 - e * e) * Math.sin(E),
  };
}

/**
 * Closed orbit polyline in the XZ plane. `segments + 1` points, the last equal
 * to the first, so the drawn line joins up.
 */
export function orbitPath(elements: OrbitElements, segments: number): PlanePosition[] {
  const points: PlanePosition[] = [];
  for (let i = 0; i <= segments; i += 1) {
    // Sweep the mean anomaly over exactly one revolution.
    points.push(orbitPosition({ ...elements, phase: 0 }, (elements.period * i) / segments));
  }
  return points;
}

/**
 * Kepler's third law. With `gm` in AU³/day² and `semiMajorAxis` in AU this
 * returns days; the relation is the definition of the unit system, not a
 * measured number.
 */
export function keplerPeriod(gm: number, semiMajorAxis: number): number {
  if (!Number.isFinite(gm) || gm <= 0) throw new Error(`gm must be positive, got ${String(gm)}`);
  if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) {
    throw new Error(`semi-major axis must be positive, got ${String(semiMajorAxis)}`);
  }
  return TWO_PI * Math.sqrt(semiMajorAxis ** 3 / gm);
}

/** Planar elements for a test orbit around a body with parameter `gm`. */
export function orbitElementsFromGm(
  semiMajorAxis: number,
  eccentricity: number,
  gm: number,
  phase = 0,
): OrbitElements {
  return { semiMajorAxis, eccentricity, phase, period: keplerPeriod(gm, semiMajorAxis) };
}

/** Orientation of an orbit in 3D: two orthonormal vectors spanning its plane. */
export type OrbitPlane = {
  /** Unit vector from the focus toward perihelion. */
  towardPerihelion: Vec3;
  /** Unit vector 90° ahead of the body along its path. */
  quarterTurnAhead: Vec3;
};

export type SpatialOrbitElements = OrbitElements & { plane: OrbitPlane };

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function unit(a: Vec3): Vec3 {
  const magnitude = length(a);
  if (magnitude === 0) throw new Error('cannot normalise a zero vector');
  return scale(a, 1 / magnitude);
}

/**
 * The osculating Keplerian ellipse of a state vector — the orbit a body would
 * follow under a pure two-body force from its current position and velocity.
 *
 * Standard relations (see any orbital mechanics text):
 *   a = 1 / (2/r − v²/μ)                                (vis-viva)
 *   e⃗ = ((v² − μ/r)·r⃗ − (r⃗·v⃗)·v⃗) / μ                  (eccentricity vector)
 *   h⃗ = r⃗ × v⃗                                          (specific angular momentum)
 *
 * Returns null for a path that is not closed (e ≥ 1, or a ≤ 0), i.e. an
 * unbound body. Callers must not draw an ellipse for those.
 */
export function osculatingElements(
  position: Vec3,
  velocity: Vec3,
  gmCentral: number,
): SpatialOrbitElements | null {
  if (!Number.isFinite(gmCentral) || gmCentral <= 0) {
    throw new Error(`central gm must be positive, got ${String(gmCentral)}`);
  }
  for (const vector of [position, velocity]) {
    if (vector.some((value) => !Number.isFinite(value))) return null;
  }

  const r = length(position);
  const speedSquared = dot(velocity, velocity);
  if (r === 0) return null;

  const semiMajorAxis = 1 / (2 / r - speedSquared / gmCentral);
  if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) return null;

  const radialSpeed = dot(position, velocity);
  const eccentricityVector: Vec3 = [
    ((speedSquared - gmCentral / r) * position[0] - radialSpeed * velocity[0]) / gmCentral,
    ((speedSquared - gmCentral / r) * position[1] - radialSpeed * velocity[1]) / gmCentral,
    ((speedSquared - gmCentral / r) * position[2] - radialSpeed * velocity[2]) / gmCentral,
  ];
  const eccentricity = length(eccentricityVector);
  if (!Number.isFinite(eccentricity) || eccentricity >= 1) return null;

  const angularMomentumVector = cross(position, velocity);
  if (length(angularMomentumVector) === 0) return null;
  const normal = unit(angularMomentumVector);
  // A circular orbit has no perihelion; any in-plane direction works.
  const towardPerihelion = eccentricity > 1e-9 ? unit(eccentricityVector) : unit(position);
  const plane: OrbitPlane = {
    towardPerihelion,
    quarterTurnAhead: cross(normal, towardPerihelion),
  };

  return {
    semiMajorAxis,
    eccentricity,
    period: keplerPeriod(gmCentral, semiMajorAxis),
    phase: 0,
    plane,
  };
}

/** Point on a spatial orbit at `time`. */
export function spatialOrbitPosition(elements: SpatialOrbitElements, time: number): Vec3 {
  const E = eccentricAnomaly(meanAnomaly(elements, time), elements.eccentricity);
  const x = elements.semiMajorAxis * (Math.cos(E) - elements.eccentricity);
  const z = elements.semiMajorAxis * Math.sqrt(1 - elements.eccentricity ** 2) * Math.sin(E);
  const { towardPerihelion: u, quarterTurnAhead: w } = elements.plane;
  return [x * u[0] + z * w[0], x * u[1] + z * w[1], x * u[2] + z * w[2]];
}

/** Closed polyline of `segments + 1` points for one full revolution. */
export function spatialOrbitPath(elements: SpatialOrbitElements, segments: number): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    points.push(spatialOrbitPosition(elements, (elements.period * i) / segments));
  }
  return points;
}
