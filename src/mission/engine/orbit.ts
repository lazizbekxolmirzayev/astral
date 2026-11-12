import { BODIES, EARTH_J2, TROPICAL_YEAR, type BodyId } from '../constants';
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

/**
 * Nodal precession rate of the orbit plane caused by the central body's oblateness
 * (J2), rad/s: Ω̇ = −(3/2) · J2 · (R/p)² · n · cos(i), with p = a(1 − e²) and n = √(μ/a³).
 * Negative for prograde orbits (the plane regresses westward).
 */
export function nodalPrecessionRate(gm: number, radius: number, j2: number, a: number, eccentricity: number, inclination: number): number {
  const p = a * (1 - eccentricity ** 2);
  const n = Math.sqrt(gm / (a * a * a));
  return -1.5 * j2 * (radius / p) ** 2 * n * Math.cos(inclination);
}

/** Rate at which the Sun moves along the ecliptic as seen from Earth, rad/s: 2π per tropical year. */
export const SUN_NODAL_RATE = (2 * Math.PI) / valueIn(TROPICAL_YEAR, 's');

/**
 * Inclination (radians) at which the orbit plane precesses with the Sun, so the orbit
 * keeps the same local solar time at every crossing: cos i = −Ω̇_sun · p² / (3/2 · J2 · R² · n).
 * Null when no inclination does it (the orbit is too high: about 5,975 km for a circular orbit).
 */
export function sunSynchronousInclination(gm: number, radius: number, j2: number, a: number, eccentricity: number): number | null {
  const p = a * (1 - eccentricity ** 2);
  const n = Math.sqrt(gm / (a * a * a));
  const cosine = -(SUN_NODAL_RATE * p * p) / (1.5 * j2 * radius * radius * n);
  if (!Number.isFinite(cosine) || Math.abs(cosine) > 1) return null;
  return Math.acos(cosine);
}

export type EarthOrbitFacts = { a: number; eccentricity: number };

/** Sun-synchronous inclination in degrees for an Earth orbit with these apsis altitudes, or null if none exists. */
export function sunSynchronousInclinationDeg(periapsisAltKm: number, apoapsisAltKm: number): number | null {
  const geometry = describeOrbit('earth', { periapsisAltKm, apoapsisAltKm, inclinationDeg: 0 });
  const eccentricity = (geometry.apoapsisRadius - geometry.periapsisRadius) / (geometry.apoapsisRadius + geometry.periapsisRadius);
  const inclination = sunSynchronousInclination(geometry.gm, geometry.radius, valueIn(EARTH_J2, '1'), geometry.semiMajorAxis, eccentricity);
  return inclination === null ? null : (inclination * 180) / Math.PI;
}
