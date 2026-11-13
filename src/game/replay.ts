/**
 * The mission video: the finished flight is played again from the same plan (the simulation is deterministic, so it
 * flies exactly the same), faster, with the crew's answers and the mistakes marked on a timeline. The timeline is
 * split into one equal segment per stage that was flown, like the stage track of the flight screen.
 */
import type { StageId, StageRecord } from '@/mission/sim';

export type ReplaySegment = { id: StageId; startS: number; endS: number };

export const REPLAY_ASCENT_SPEED = 8;
export const REPLAY_SPEEDS = [1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** The stages that actually started, with their real start and end (the last one ends where the mission ended). */
export function replaySegments(stages: readonly StageRecord[], endedT: number): ReplaySegment[] {
  const out: ReplaySegment[] = [];
  for (const stage of stages) {
    if (stage.startS === null) continue;
    out.push({ id: stage.id, startS: stage.startS, endS: Math.max(stage.startS, stage.endS ?? endedT) });
  }
  return out;
}

/** 0..1 position on the timeline of a mission time. */
export function positionOf(segments: readonly ReplaySegment[], t: number): number {
  if (segments.length === 0) return 0;
  let index = segments.findIndex((segment) => t < segment.endS);
  if (index < 0) return 1;
  index = Math.max(0, index);
  const segment = segments[index]!;
  const span = segment.endS - segment.startS;
  const fraction = span > 0 ? Math.max(0, Math.min(1, (t - segment.startS) / span)) : 0;
  return (index + fraction) / segments.length;
}

/** Mission time at a 0..1 position of the timeline. */
export function timeAt(segments: readonly ReplaySegment[], position: number): number {
  if (segments.length === 0) return 0;
  const scaled = Math.max(0, Math.min(1, position)) * segments.length;
  const index = Math.min(segments.length - 1, Math.floor(scaled));
  const segment = segments[index]!;
  return segment.startS + (scaled - index) * (segment.endS - segment.startS);
}
