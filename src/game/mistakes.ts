/**
 * Where the flight went wrong, gathered into one list so the player can see and replay each mistake: crew jobs that
 * were missed or answered wrongly, warnings and errors the simulation logged, requirements that were not met, and
 * errors left in the design before the launch. Pure.
 */
import type { Localized } from '@/mission';
import type { MissionOutcome, StageId, TimelineEntry } from '@/mission/sim';
import type { CrewRole } from './crew';
import type { CrewLogEntry } from './crewStore';

export type MistakeText = { key: string; params?: Record<string, string | number> } | { loc: Localized };
export type MistakeCategory = 'crew' | 'flight' | 'requirement' | 'design';
export type Mistake = {
  id: string;
  category: MistakeCategory;
  severity: 'warning' | 'error';
  /** Mission time to jump to in the video; null for mistakes that are not a moment of the flight. */
  missionT: number | null;
  stage: StageId | null;
  role?: CrewRole;
  player?: number;
  /** Task id for crew mistakes (the renderer names it). */
  task?: string;
  title: MistakeText;
  detail: MistakeText | null;
  points: number;
};

export type DesignIssue = { code: string; severity: 'error' | 'warning'; message: Localized };

export function collectMistakes(input: { outcome: MissionOutcome; timeline: readonly TimelineEntry[]; log: readonly CrewLogEntry[]; designIssues: readonly DesignIssue[] }): Mistake[] {
  const out: Mistake[] = [];
  for (const entry of input.log) {
    if (entry.points >= 0) continue;
    out.push({
      id: `crew-${entry.key}`,
      category: 'crew',
      severity: entry.result === 'false-hold' ? 'warning' : 'error',
      missionT: entry.missionT,
      stage: entry.stage,
      role: entry.role,
      player: entry.player,
      task: entry.defId,
      title: { key: `mistakes.crew.${entry.result}` },
      detail: entry.result === 'wrong-go' && entry.issueCodes.length > 0 ? { key: 'mistakes.crew.knownFault', params: { count: entry.issueCodes.length } } : { key: `mistakes.crew.${entry.result}Why` },
      points: entry.points,
    });
  }
  input.timeline.forEach((entry, index) => {
    if (entry.severity !== 'warning' && entry.severity !== 'error') return;
    out.push({ id: `flight-${index}`, category: 'flight', severity: entry.severity, missionT: entry.t, stage: entry.stage, title: { loc: entry.text }, detail: entry.cause ? { loc: entry.cause } : null, points: 0 });
  });
  for (const check of input.outcome.requirements) {
    if (check.met) continue;
    out.push({ id: `req-${check.id}`, category: 'requirement', severity: 'error', missionT: null, stage: null, title: { key: 'mistakes.requirement', params: { kind: check.kind, actual: check.actual, limit: check.limit, unit: check.unit } }, detail: null, points: 0 });
  }
  for (const issue of input.designIssues) {
    if (issue.severity !== 'error') continue;
    out.push({ id: `design-${issue.code}`, category: 'design', severity: 'error', missionT: null, stage: null, title: { loc: issue.message }, detail: { key: 'mistakes.designFix' }, points: 0 });
  }
  return out.sort((a, b) => (a.missionT ?? Number.POSITIVE_INFINITY) - (b.missionT ?? Number.POSITIVE_INFINITY));
}
