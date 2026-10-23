import { KILOMETRES_PER_SECOND_PER_AU_PER_DAY } from './diagnostics';
import type { NBodyState } from './gravity';

export type OrbitReadout = {
  /** Separation, AU. */
  distanceAu: number;
  /** Relative speed, km/s. */
  speedKmS: number;
  /** Specific orbital energy v²/2 − μ/r, AU²/day². Negative ⇒ bound. */
  specificEnergy: number;
  bound: boolean;
  /** Semi-major axis, AU. Only for bound orbits. */
  semiMajorAxisAu: number | null;
  eccentricity: number;
  /** Orbital period, days. Only for bound orbits. */
  periodDays: number | null;
  periapsisAu: number;
  /** Only for bound orbits. */
  apoapsisAu: number | null;
};

/**
 * Osculating two-body readout of body `i` relative to `c`, with μ = GM_c + GM_i.
 * This is the orbit the body would follow if only these two bodies existed;
 * with other bodies present it is an instantaneous description, not a promise.
 */
export function orbitReadout(state: NBodyState, i: number, c: number): OrbitReadout | null {
  if (i === c || i < 0 || c < 0 || i >= state.ids.length || c >= state.ids.length) return null;
  const mu = (state.gm[c] as number) + (state.gm[i] as number);
  if (!Number.isFinite(mu) || mu <= 0) return null;
  const rx = (state.positions[i * 3] as number) - (state.positions[c * 3] as number);
  const ry = (state.positions[i * 3 + 1] as number) - (state.positions[c * 3 + 1] as number);
  const rz = (state.positions[i * 3 + 2] as number) - (state.positions[c * 3 + 2] as number);
  const vx = (state.velocities[i * 3] as number) - (state.velocities[c * 3] as number);
  const vy = (state.velocities[i * 3 + 1] as number) - (state.velocities[c * 3 + 1] as number);
  const vz = (state.velocities[i * 3 + 2] as number) - (state.velocities[c * 3 + 2] as number);
  const r = Math.hypot(rx, ry, rz);
  const v2 = vx * vx + vy * vy + vz * vz;
  if (!(r > 0) || !Number.isFinite(v2)) return null;

  const rv = rx * vx + ry * vy + rz * vz;
  const k = v2 - mu / r;
  const ex = (k * rx - rv * vx) / mu;
  const ey = (k * ry - rv * vy) / mu;
  const ez = (k * rz - rv * vz) / mu;
  const eccentricity = Math.hypot(ex, ey, ez);
  const energy = v2 / 2 - mu / r;
  const bound = energy < 0 && eccentricity < 1;
  const a = bound ? -mu / (2 * energy) : null;
  return {
    distanceAu: r,
    speedKmS: Math.sqrt(v2) * KILOMETRES_PER_SECOND_PER_AU_PER_DAY,
    specificEnergy: energy,
    bound,
    semiMajorAxisAu: a,
    eccentricity,
    periodDays: a === null ? null : 2 * Math.PI * Math.sqrt((a * a * a) / mu),
    periapsisAu: a === null ? (eccentricity === 0 ? r : (r * r * v2) / (mu * (1 + eccentricity))) : a * (1 - eccentricity),
    apoapsisAu: a === null ? null : a * (1 + eccentricity),
  };
}
