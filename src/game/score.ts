/**
 * The score of a flight. Two parts: how well the *design* did (taken from the simulation's own outcome: result,
 * requirements, science, data, spacecraft health) and how well the *crew* ran the mission (the jobs in `crew.ts`).
 * Pure; nothing here is random or invented. There is no leaderboard: the score is for this flight only.
 */
import { DIFFICULTY_RULES, type Difficulty } from './difficulty';
import type { MissionOutcome } from '@/mission/sim';
import { CREW_ROLES, TASK_MAX, playerOfRole, type CrewRole } from './crew';
import type { CrewLogEntry } from './crewStore';

export type ScoreLineId = 'outcome' | 'requirements' | 'science' | 'data' | 'health' | 'crew' | 'difficulty';
export type ScoreLine = { id: ScoreLineId; points: number; max: number };
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export type PlayerScore = { player: number; points: number; tasks: number; quick: number; missed: number; roles: CrewRole[] };
export type Score = { lines: ScoreLine[]; total: number; max: number; grade: Grade; players: PlayerScore[]; mvp: number | null };

export const OUTCOME_POINTS = { success: 400, partial: 200, failure: 0 } as const;
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function gradeOf(fraction: number): Grade {
  if (fraction >= 0.9) return 'S';
  if (fraction >= 0.75) return 'A';
  if (fraction >= 0.6) return 'B';
  if (fraction >= 0.4) return 'C';
  return 'D';
}

export function computeScore(input: { outcome: MissionOutcome; health: number; log: readonly CrewLogEntry[]; playerCount: number; difficulty?: Difficulty }): Score {
  const { outcome, health, log, playerCount } = input;
  const lines: ScoreLine[] = [{ id: 'outcome', points: OUTCOME_POINTS[outcome.kind], max: OUTCOME_POINTS.success }];
  if (outcome.requirements.length > 0) {
    const met = outcome.requirements.filter((check) => check.met).length;
    lines.push({ id: 'requirements', points: Math.round((150 * met) / outcome.requirements.length), max: 150 });
  }
  if (outcome.scienceNominal > 0) lines.push({ id: 'science', points: Math.round(200 * clamp01(outcome.sciencePoints / outcome.scienceNominal)), max: 200 });
  if (outcome.generatedBits > 0) lines.push({ id: 'data', points: Math.round(100 * clamp01(outcome.deliveredBits / outcome.generatedBits)), max: 100 });
  lines.push({ id: 'health', points: Math.round(50 * clamp01(health)), max: 50 });

  const counted = log.filter((entry) => entry.result !== 'skipped' && !entry.ai);
  const crewSum = counted.reduce((sum, entry) => sum + entry.points, 0);
  lines.push({ id: 'crew', points: Math.max(0, Math.min(counted.length * TASK_MAX, crewSum)), max: Math.max(TASK_MAX, counted.length * TASK_MAX) });

  const bonus = input.difficulty ? DIFFICULTY_RULES[input.difficulty].bonus : 0;
  if (bonus > 0) lines.push({ id: 'difficulty', points: outcome.kind === 'success' ? bonus : outcome.kind === 'partial' ? Math.round(bonus / 2) : 0, max: bonus });

  const total = lines.reduce((sum, line) => sum + line.points, 0);
  const max = lines.reduce((sum, line) => sum + line.max, 0);

  const count = Math.max(1, playerCount);
  const players: PlayerScore[] = Array.from({ length: count }, (_, player) => {
    const own = counted.filter((entry) => entry.player === player);
    return {
      player,
      points: own.reduce((sum, entry) => sum + entry.points, 0),
      tasks: own.length,
      quick: own.filter((entry) => entry.result === 'perfect' || entry.result === 'correct-nogo').length,
      missed: own.filter((entry) => entry.points < 0).length,
      roles: CREW_ROLES.filter((role) => playerOfRole(role, count) === player),
    };
  });
  const best = Math.max(...players.map((entry) => entry.points));
  const leaders = players.filter((entry) => entry.points === best);
  return { lines, total, max, grade: gradeOf(max > 0 ? total / max : 0), players, mvp: count > 1 && leaders.length === 1 && best > 0 ? leaders[0]!.player : null };
}
