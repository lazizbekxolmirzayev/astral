import type { SimPlan, StageId } from '@/mission/sim';

/**
 * Game pacing. The simulation computes real mission time (hours to years); the game plays each stage in
 * a few seconds of watching time. The rate is only *how fast the clock runs*: every number still comes
 * from the simulation, and the simulation takes whole steps, so pacing never changes an outcome.
 */
export const CINEMATIC_SECONDS: Record<StageId, number> = {
  // the hour-long pad hold is skipped through; only the last minute of the countdown runs in real time
  'pre-launch': 10,
  // the climb to orbit runs in real time (the simulation's 9-minute ascent), chosen speed 1x..8x
  launch: 540,
  'orbit-insertion': 8,
  cruise: 22,
  'destination-arrival': 9,
  'science-operations': 24,
  'data-transmission': 8,
  'mission-completion': 2,
};

/** The last stretch of the countdown, and the whole ascent, play at real speed (times the player's chosen speed). */
export const REAL_TIME_COUNTDOWN_S = 60;
export type AscentSpeed = 1 | 2 | 4 | 8;
export const ASCENT_SPEEDS: readonly AscentSpeed[] = [1, 2, 4, 8];

/** Upper limit of simulated seconds per real second, so a very long mission cannot stall a frame. */
export const MAX_CINEMATIC_RATE = 3_000_000;

/** Planned length of a stage in mission seconds (the science stage uses its effective length). */
export function stageSeconds(plan: SimPlan, stage: StageId): number {
  return stage === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stage] ?? 0);
}

/**
 * Simulated seconds per real second for a stage. Most stages take about `CINEMATIC_SECONDS` to watch. The launch
 * stages are different: the hour-long hold on the pad is skipped through, but the last minute of the countdown
 * and the climb to orbit play in real time, so a launch lasts as long as a real one (`speed` speeds it up).
 */
export function cinematicRate(plan: SimPlan, stage: StageId, context: { stageElapsedS?: number; speed?: number } = {}): number {
  const speed = context.speed ?? 1;
  const length = stageSeconds(plan, stage);
  if (stage === 'launch') return speed;
  if (stage === 'pre-launch') {
    const remaining = length - (context.stageElapsedS ?? 0);
    if (remaining <= REAL_TIME_COUNTDOWN_S) return speed;
    return Math.max(1, (length - REAL_TIME_COUNTDOWN_S) / CINEMATIC_SECONDS['pre-launch']);
  }
  if (!(length > 0)) return 1;
  return Math.min(MAX_CINEMATIC_RATE, Math.max(1, length / CINEMATIC_SECONDS[stage]));
}
