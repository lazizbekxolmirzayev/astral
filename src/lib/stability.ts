/**
 * Stability rules: when does a body count as "leaving the simulation"?
 *
 * Two independent checks, both relative to the central mass (the Sun):
 *
 * 1. **Unbound** — its speed reaches the local escape speed √(2·GM/r). At that
 *    point the two-body energy relative to the Sun is ≥ 0 and the body will not
 *    come back.
 * 2. **Too far** — its distance passes `MAX_MODELLED_DISTANCE_AU`.
 *
 * The thresholds are a product decision, not astronomy, so they are labelled
 * `artistic` everywhere they surface. The reference measurement they are chosen
 * against is real: Neptune's aphelion is 30.4 AU (its semi-major axis 4.5e9 km
 * and eccentricity 0.010, both in `data/solarSystem.ts`), so 40 AU sits outside
 * every planet's natural path and only fires when something has genuinely been
 * thrown out of the system.
 */

import type { BodyKinematics } from '@/physics/diagnostics';

/** AU. Beyond this a body has left the modelled neighbourhood. */
export const MAX_MODELLED_DISTANCE_AU = 40;

/** Speed/escape ratio at which a body is treated as unbound. 1 = parabolic. */
export const UNBOUND_RATIO = 1;

export type StabilityKind = 'unbound' | 'distance';

export type StabilityWarning = {
  id: string;
  kind: StabilityKind;
  /** The value that tripped the rule, in AU or AU/day. */
  measured: number;
  /** What the rule compares it against, same unit. */
  limit: number;
};

/**
 * Warnings for one frame. Order follows the input order (Mercury → Neptune), so
 * the list is stable and the UI never re-sorts while the user reads it.
 */
export function evaluateStability(kinematics: readonly BodyKinematics[]): StabilityWarning[] {
  const warnings: StabilityWarning[] = [];
  for (const body of kinematics) {
    if (body.boundRatio >= UNBOUND_RATIO) {
      warnings.push({
        id: body.id,
        kind: 'unbound',
        measured: body.speedAuPerDay,
        limit: body.escapeSpeedAuPerDay,
      });
      continue;
    }
    if (body.distanceAu > MAX_MODELLED_DISTANCE_AU) {
      warnings.push({
        id: body.id,
        kind: 'distance',
        measured: body.distanceAu,
        limit: MAX_MODELLED_DISTANCE_AU,
      });
    }
  }
  return warnings;
}

/** How close the worst-bound body is to escaping, 0…1. Clamped for bars. */
export function boundPressure(kinematics: readonly BodyKinematics[]): number {
  let worst = 0;
  for (const body of kinematics) worst = Math.max(worst, body.boundRatio);
  return Math.min(1, worst);
}
