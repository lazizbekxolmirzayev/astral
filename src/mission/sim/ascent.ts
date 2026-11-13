/**
 * The shape of the climb to orbit, as fractions of the launch stage (tau = 0..1) and of the final altitude and speed.
 * The knots follow the published timeline of medium-lift ascents (Atlas V / Falcon 9 / Space Shuttle class, as in NASA
 * launch press kits): about 10 km at one minute, about 100 km (the Kármán line) at three minutes, nearly all of the
 * speed gained in the last third. Real flights differ by vehicle, so this is a typical profile, not one rocket's
 * trajectory. Times are scaled to the stage length (540 s).
 */
type Knot = readonly [tau: number, value: number];

const ALTITUDE: readonly Knot[] = [[0, 0], [0.056, 0.01], [0.111, 0.04], [0.167, 0.125], [0.222, 0.25], [0.278, 0.4], [0.333, 0.5], [0.444, 0.65], [0.556, 0.8], [0.667, 0.9], [0.778, 0.975], [0.889, 0.998], [1, 1]];
const SPEED: readonly Knot[] = [[0, 0], [0.056, 0.02], [0.111, 0.054], [0.167, 0.108], [0.222, 0.176], [0.278, 0.27], [0.333, 0.38], [0.444, 0.57], [0.556, 0.7], [0.667, 0.81], [0.778, 0.92], [0.889, 0.98], [1, 1]];
/** Angle of the flight path from the vertical, radians: straight up for the first seconds, then the gravity turn toward the horizon. */
const PITCH: readonly Knot[] = [[0, 0], [0.03, 0.02], [0.11, 0.25], [0.22, 0.8], [0.33, 1.15], [0.55, 1.4], [1, 1.52]];

/** Monotone cubic (Fritsch–Carlson) interpolation: smooth, never overshoots the knots. */
function interpolator(knots: readonly Knot[]): (x: number) => number {
  const n = knots.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) { h.push(knots[i + 1]![0] - knots[i]![0]); d.push((knots[i + 1]![1] - knots[i]![1]) / h[i]!); }
  const m: number[] = [d[0]!];
  for (let i = 1; i < n - 1; i += 1) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]!; m[i + 1] = k * b * d[i]!; }
  }
  return (x) => {
    const t = Math.min(1, Math.max(0, x));
    let i = 0;
    while (i < n - 2 && t > knots[i + 1]![0]) i += 1;
    const x0 = knots[i]![0];
    const u = (t - x0) / h[i]!;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * knots[i]![1] + (u3 - 2 * u2 + u) * h[i]! * m[i]! + (-2 * u3 + 3 * u2) * knots[i + 1]![1] + (u3 - u2) * h[i]! * m[i + 1]!;
  };
}

/** Fraction of the final altitude reached at `tau`. */
export const ascentAltitudeFraction = interpolator(ALTITUDE);
/** Fraction of the final (orbital) speed reached at `tau`. */
export const ascentSpeedFraction = interpolator(SPEED);
/** Flight-path angle from the vertical, radians. */
export const ascentPitch = interpolator(PITCH);
