/**
 * The drawn ascent: a pure function of how far through the launch stage the simulation is (0..1).
 * It is a picture of the climb (altitude grows slowly at first, the rocket then pitches over), not a
 * trajectory computation. Units are scene units.
 */
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

import { ascentAltitudeFraction, ascentPitch, ascentSpeedFraction } from '@/mission/sim/ascent';

/** Scene units of the parking-orbit altitude (about 300 km). The Earth under the pad is drawn at the same scale. */
export const ASCENT_DISTANCE = 240;
/** Real parking altitude and Earth radius (km) that the scene scale stands for. */
export const PARKING_KM = 300;
export const EARTH_RADIUS_KM = 6378.137;
/** Earth radius in scene units, so the gap between the ground and the orbit is in true proportion. */
export const EARTH_SCENE_RADIUS = (ASCENT_DISTANCE * EARTH_RADIUS_KM) / PARKING_KM;
/** Downrange distance at orbit, in scene units (a real ascent covers roughly 8x its altitude; compressed so the view stays usable). */
const DOWNRANGE = ASCENT_DISTANCE * 3;

export type AscentPose = { x: number; y: number; pitch: number; distance: number };

/** Cumulative downrange (0..1) along the climb: the horizontal part of the speed, integrated over the gravity turn. */
const DOWNRANGE_TABLE: number[] = (() => {
  const steps = 400;
  const table = [0];
  for (let i = 1; i <= steps; i += 1) {
    const tau = (i - 0.5) / steps;
    table.push(table[i - 1]! + ascentSpeedFraction(tau) * Math.sin(ascentPitch(tau)) / steps);
  }
  const total = table[steps]!;
  return table.map((value) => value / total);
})();

function downrangeFraction(tau: number): number {
  const position = Math.min(1, Math.max(0, tau)) * (DOWNRANGE_TABLE.length - 1);
  const low = Math.floor(position);
  const high = Math.min(DOWNRANGE_TABLE.length - 1, low + 1);
  return DOWNRANGE_TABLE[low]! + (DOWNRANGE_TABLE[high]! - DOWNRANGE_TABLE[low]!) * (position - low);
}

/**
 * The drawn climb: altitude and speed follow the typical ascent profile (`ascent.ts`), the path bends over in a gravity
 * turn, and the ground falls away with the curve of the Earth (drawn at its true size). The downrange distance is compressed.
 */
export function ascentPose(tau: number): AscentPose {
  const clamped = Math.min(1, Math.max(0, tau));
  const altitude = ASCENT_DISTANCE * ascentAltitudeFraction(clamped);
  const x = DOWNRANGE * downrangeFraction(clamped);
  // the rocket stays at its altitude above the *curved* ground
  const y = altitude + (x * x) / (2 * EARTH_SCENE_RADIUS);
  const pitch = ascentPitch(clamped);
  return { x, y, pitch, distance: Math.hypot(x, y) };
}

/** Whole seconds left on the countdown, from the progress of the pre-launch stage; 0 means ignition/liftoff. */
export function countdownSeconds(progress: number, totalSeconds = 10): number {
  return Math.max(0, Math.ceil(totalSeconds * (1 - Math.min(1, Math.max(0, progress)))));
}

/** Engine power while on the pad: idle, then spooling up for the last seconds of the countdown. */
export function padThrottle(progress: number): number {
  return smooth((progress - 0.72) / 0.28) * 0.65;
}

/** Sky amount 1 (day) .. 0 (space) at a point in the ascent. */
export function skyAmount(tau: number): number {
  return 1 - smooth(tau * 1.35);
}

/**
 * When the vehicle drops its pieces, as a fraction of the launch stage. This is the drawn story of the ascent
 * (the catalog does not model staging events), so it is the same for every launch.
 */
export const SEPARATION = { boosters: 0.24, stage1: 0.3, fairing: 0.39 } as const;
/** Max-Q (the greatest air pressure) comes about 70 s after liftoff on typical ascents: 70 / 540. */
export const MAX_Q_TAU = 0.13;

/** Camera for the `auto` mode: a broadcast-style schedule that shows each separation from a good angle. */
export function autoCameraAt(tau: number): 'side' | 'track' | 'chase' | 'rear' | 'onboard' | 'crew' {
  if (tau < 0.06) return 'side';
  if (tau < 0.16) return 'track';
  if (tau < 0.34) return 'chase';
  if (tau < 0.44) return 'rear';
  if (tau < 0.6) return 'crew';
  if (tau < 0.85) return 'chase';
  return 'onboard';
}

/**
 * How hard the vehicle shakes at a point in the climb (0..1): engine rumble through the pad and lift-off,
 * the peak of dynamic pressure (max-Q), and a jolt that decays after each separation. Drawn, not computed.
 */
export function shakeAmount(tau: number, secondsSinceSeparation: number): number {
  // the shake is strongest while the engines roar next to the pad and at max-Q; it fades as the air thins and
  // the engine settles, and each separation adds a short jolt
  const lift = tau < 0.05 ? 0.5 + (tau / 0.05) * 0.2 : 0.7 * Math.exp(-((tau - 0.05) / 0.04));
  const maxQ = Math.exp(-(((tau - MAX_Q_TAU) / 0.04) ** 2)) * 0.7;
  const cruise = tau >= 0.05 ? 0.12 * (1 - tau) : 0;
  const jolt = secondsSinceSeparation >= 0 ? Math.exp(-secondsSinceSeparation * 4) * 0.8 : 0;
  return Math.min(1.1, lift + maxQ + cruise + jolt);
}

/** Seconds of the countdown shown as the big number and during which the engines spool up. */
export const PAD_WINDOW_S = 10;

/** Progress 0..1 through the final `PAD_WINDOW_S` seconds of the countdown, from the seconds left on the pad. */
export function padWindowProgress(remainingS: number): number {
  return Math.min(1, Math.max(0, 1 - remainingS / PAD_WINDOW_S));
}
