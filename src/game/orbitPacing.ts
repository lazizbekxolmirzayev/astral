import type { SimPlan, StageId } from '@/mission/sim';
import { cinematicRate } from './cinematic';

/**
 * How the game draws motion on the operational orbit.
 *
 * Playing a stage in a few seconds means the mission clock can run thousands of times faster than real time;
 * an orbit that takes hours would then sweep around the planet hundreds of times a second. For the stages
 * that fly the operational orbit the game therefore draws the spacecraft at a fixed, watchable pace (one
 * orbit per `VISUAL_ORBIT_SECONDS` of real time) instead of at the clock's pace. This is a drawing choice
 * only: telemetry, power, data and the outcome are computed by the simulation from its own clock.
 */
export const VISUAL_ORBIT_SECONDS = 12;

/** Orbits per real second above which the true pace would only be a blur. */
const BLUR_ORBITS_PER_SECOND = 0.15;

const ALWAYS_VISUAL: readonly StageId[] = ['science-operations', 'data-transmission', 'mission-completion'];

export function usesVisualOrbit(plan: SimPlan, stage: StageId): boolean {
  if (ALWAYS_VISUAL.includes(stage)) return true;
  const flownOnOperationalOrbit = stage === 'destination-arrival' || (plan.missionClass === 'earth-orbit' && stage === 'orbit-insertion');
  if (!flownOnOperationalOrbit) return false;
  return cinematicRate(plan, stage) / Math.max(1, plan.geometry.periodS) > BLUR_ORBITS_PER_SECOND;
}

/** Seconds along the operational orbit that the drawing shows after `realSeconds` of watching. */
export function visualOrbitSeconds(plan: SimPlan, realSeconds: number): number {
  return (Math.max(0, realSeconds) / VISUAL_ORBIT_SECONDS) * plan.geometry.periodS;
}
