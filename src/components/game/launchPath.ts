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

/**
 * When the vehicle drops its pieces, as a fraction of the launch stage. This is the drawn story of the ascent
 * (the catalog does not model staging events), so it is the same for every launch.
 */
export const SEPARATION = { boosters: 0.38, stage1: 0.62, fairing: 0.8 } as const;

/** Camera for the `auto` mode: a broadcast-style schedule that shows each separation from a good angle. */
export function autoCameraAt(tau: number): 'side' | 'track' | 'chase' | 'rear' | 'onboard' | 'crew' {
  if (tau < 0.1) return 'side';
  if (tau < 0.3) return 'track';
  if (tau < 0.45) return 'chase';
  if (tau < 0.57) return 'crew';
  if (tau < 0.7) return 'rear';
  if (tau < 0.86) return 'chase';
  return 'onboard';
}

/**
 * How hard the vehicle shakes at a point in the climb (0..1): engine rumble through the pad and lift-off,
 * the peak of dynamic pressure (max-Q), and a jolt that decays after each separation. Drawn, not computed.
 */
export function shakeAmount(tau: number, secondsSinceSeparation: number): number {
  const lift = tau < 0.1 ? 0.55 + (tau / 0.1) * 0.25 : 0;
  const maxQ = Math.exp(-(((tau - 0.2) / 0.07) ** 2)) * 0.9;
  const cruise = tau >= 0.1 ? 0.18 * (1 - tau * 0.6) : 0;
  const jolt = secondsSinceSeparation >= 0 ? Math.exp(-secondsSinceSeparation * 5) * 1.1 : 0;
  return Math.min(1.2, lift + maxQ + cruise + jolt);
}
