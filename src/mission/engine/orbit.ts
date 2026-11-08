import { BODIES, type BodyId } from '../constants';
import type { OrbitSpec } from '../models/catalog';
import { valueIn } from '../units';

/**
 * Orbit helpers in SI units (metres, seconds, m³/s²). Pure functions with no
 * catalog or mission knowledge, so they can be checked against textbook values and
 * against the existing `src/physics` Kepler code (see orbit.test.ts).
 */

export type OrbitGeometry = {
  body: BodyId;
  /** μ of the central body, m³/s². */
  gm: number;
  /** Body radius, m. */
  radius: number;
  periapsisRadius: number;
  apoapsisRadius: number;
  /** Mean of periapsis and apoapsis radius, m. Eccentric orbits are approximated by this circle. */
  semiMajorAxis: number;
  /** Mean altitude above the surface, m. */
  meanAltitude: number;
  period: number;
};

export function circularSpeed(gm: number, radius: number): number {
  return Math.sqrt(gm / radius);
}

/** Vis-viva: speed at `radius` on an orbit of semi-major axis `a`. */
export function visViva(gm: number, radius: number, a: number): number {
  return Math.sqrt(gm * (2 / radius - 1 / a));
}

export function orbitPeriod(gm: number, a: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / gm);
}

/**
 * Fraction of each orbit spent in the central body's shadow, for a circular orbit
 * of radius `a` with the Sun in the orbital plane (the longest eclipse) and a
 * cylindrical shadow.
 */
export function eclipseFraction(bodyRadius: number, a: number): number {
  if (a <= bodyRadius) return 0.5;
  return Math.asin(bodyRadius / a) / Math.PI;
}

/** Distance from a ground station to a satellite at altitude `h`, seen at elevation `elevation` (radians). */
export function slantRange(bodyRadius: number, altitude: number, elevation: number): number {
  const rSin = bodyRadius * Math.sin(elevation);
  return -rSin + Math.sqrt(rSin * rSin + 2 * bodyRadius * altitude + altitude * altitude);
}

export function describeOrbit(body: BodyId, orbit: OrbitSpec): OrbitGeometry {
  const data = BODIES[body];
  const gm = valueIn(data.gm, 'm^3/s^2');
  const radius = valueIn(data.radius, 'm');
  const periapsisRadius = radius + orbit.periapsisAltKm * 1000;
  const apoapsisRadius = radius + orbit.apoapsisAltKm * 1000;
  const semiMajorAxis = (periapsisRadius + apoapsisRadius) / 2;
  return {
    body,
    gm,
    radius,
    periapsisRadius,
    apoapsisRadius,
    semiMajorAxis,
    meanAltitude: semiMajorAxis - radius,
    period: orbitPeriod(gm, semiMajorAxis),
  };
}
