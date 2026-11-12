import { BODIES, EARTH_J2 } from '../constants';
import type { Quantity } from '../models/quantity';
import { valueIn } from '../units';
import { derive, type Derived } from './derived';
import { describeOrbit, nodalPrecessionRate, orbitPeriod, SUN_NODAL_RATE, sunSynchronousInclination, visViva } from './orbit';
import type { ResolvedDesign } from './resolve';

export type SunSynchronousFacts = {
  /** Inclination (degrees) that makes this orbit sun-synchronous; null when none exists at this altitude. */
  requiredInclinationDeg: number | null;
  /** Precession of the orbit plane at the chosen inclination, degrees per day (east positive). */
  precessionDegPerDay: number;
  /** Rate the Sun moves along the ecliptic, degrees per day (about 0.9856). */
  sunRateDegPerDay: number;
  /** Chosen inclination minus the required one, degrees; null when no sun-synchronous inclination exists. */
  inclinationErrorDeg: number | null;
  /** How fast the local solar time of the crossings drifts, minutes of clock time per day (4 min per degree). */
  localTimeDriftMinPerDay: number;
};

export type OrbitReport = {
  /** The orbit editor works in altitudes; heliocentric orbits are read as distances from the Sun in AU. */
  heliocentric: boolean;
  periapsisRadius: Derived;
  apoapsisRadius: Derived;
  semiMajorAxis: Derived;
  eccentricity: Derived;
  period: Derived;
  speedAtPeriapsis: Derived;
  speedAtApoapsis: Derived;
  /** Speed on a circular orbit at the mean radius; for a circular orbit this is the orbital speed. */
  circularSpeed: Derived;
  inclinationDeg: number;
  sunSynchronous: SunSynchronousFacts | null;
};

const RAD_TO_DEG = 180 / Math.PI;

/** Geometry of the chosen orbit around its central body. Pure; every value carries its unit and provenance. */
export function computeOrbitReport(design: ResolvedDesign): OrbitReport {
  const { mission, destination } = design;
  const model = 'orbit-geometry' as const;
  const geometry = describeOrbit(destination.centralBody, mission.orbit);
  const body = BODIES[destination.centralBody];
  const inputs: Quantity[] = [body.gm, body.radius];
  const e = (geometry.apoapsisRadius - geometry.periapsisRadius) / (geometry.apoapsisRadius + geometry.periapsisRadius);
  const a = geometry.semiMajorAxis;

  let sunSynchronous: SunSynchronousFacts | null = null;
  if (destination.centralBody === 'earth') {
    const j2 = valueIn(EARTH_J2, '1');
    const inclination = (mission.orbit.inclinationDeg * Math.PI) / 180;
    const required = sunSynchronousInclination(geometry.gm, geometry.radius, j2, a, e);
    // Ω̇ is signed (prograde orbits regress, retrograde ones advance); compare with the Sun's +0.9856°/day.
    const precessionDegPerDay = nodalPrecessionRate(geometry.gm, geometry.radius, j2, a, e, inclination) * 86_400 * RAD_TO_DEG;
    const sunRateDegPerDay = SUN_NODAL_RATE * 86_400 * RAD_TO_DEG;
    const requiredDeg = required === null ? null : required * RAD_TO_DEG;
    sunSynchronous = {
      requiredInclinationDeg: requiredDeg,
      precessionDegPerDay,
      sunRateDegPerDay,
      inclinationErrorDeg: requiredDeg === null ? null : mission.orbit.inclinationDeg - requiredDeg,
      localTimeDriftMinPerDay: (precessionDegPerDay - sunRateDegPerDay) * 4,
    };
  }

  return {
    heliocentric: destination.centralBody === 'sun',
    periapsisRadius: derive(geometry.periapsisRadius, 'm', model, 'R + periapsis altitude', inputs),
    apoapsisRadius: derive(geometry.apoapsisRadius, 'm', model, 'R + apoapsis altitude', inputs),
    semiMajorAxis: derive(a, 'm', model, 'a = (r_p + r_a) / 2', inputs),
    eccentricity: derive(e, '1', model, 'e = (r_a − r_p) / (r_a + r_p)', inputs),
    period: derive(orbitPeriod(geometry.gm, a), 's', model, 'T = 2π · √(a³ / μ)', inputs),
    speedAtPeriapsis: derive(visViva(geometry.gm, geometry.periapsisRadius, a), 'm/s', model, 'v = √(μ · (2 / r − 1 / a)) at periapsis', inputs),
    speedAtApoapsis: derive(visViva(geometry.gm, geometry.apoapsisRadius, a), 'm/s', model, 'v = √(μ · (2 / r − 1 / a)) at apoapsis', inputs),
    circularSpeed: derive(Math.sqrt(geometry.gm / a), 'm/s', model, 'v = √(μ / a)', inputs),
    inclinationDeg: mission.orbit.inclinationDeg,
    sunSynchronous,
  };
}
