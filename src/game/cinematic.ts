import type { SimPlan, StageId } from '@/mission/sim';

/**
 * Game pacing. The simulation computes real mission time (hours to years); the game plays each stage in
 * a few seconds of watching time. The rate is only *how fast the clock runs*: every number still comes
 * from the simulation, and the simulation takes whole steps, so pacing never changes an outcome.
 */
export const CINEMATIC_SECONDS: Record<StageId, number> = {
  'pre-launch': 7,
  launch: 18,
  'orbit-insertion': 8,
  cruise: 22,
  'destination-arrival': 9,
  'science-operations': 24,
  'data-transmission': 8,
  'mission-completion': 2,
};

/** Upper limit of simulated seconds per real second, so a very long mission cannot stall a frame. */
export const MAX_CINEMATIC_RATE = 3_000_000;

/** Planned length of a stage in mission seconds (the science stage uses its effective length). */
export function stageSeconds(plan: SimPlan, stage: StageId): number {
  return stage === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stage] ?? 0);
}

/** Simulated seconds per real second for a stage, so that stage takes about `CINEMATIC_SECONDS` to watch. */
export function cinematicRate(plan: SimPlan, stage: StageId): number {
  const length = stageSeconds(plan, stage);
  if (!(length > 0)) return 1;
  return Math.min(MAX_CINEMATIC_RATE, Math.max(1, length / CINEMATIC_SECONDS[stage]));
}
