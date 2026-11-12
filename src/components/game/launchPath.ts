/**
 * The drawn ascent: a pure function of how far through the launch stage the simulation is (0..1).
 * It is a picture of the climb (altitude grows slowly at first, the rocket then pitches over), not a
 * trajectory computation. Units are scene units.
 */
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export const ASCENT_DISTANCE = 240;

export type AscentPose = { x: number; y: number; pitch: number; distance: number };

export function ascentPose(tau: number): AscentPose {
  const clamped = Math.min(1, Math.max(0, tau));
  const distance = ASCENT_DISTANCE * clamped ** 2.1;
  const pitch = 1.2 * smooth((clamped - 0.22) / 0.7);
  return { distance, pitch, x: distance * Math.sin(pitch * 0.55), y: distance * Math.cos(pitch * 0.55) };
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
