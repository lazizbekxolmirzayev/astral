/**
 * The crew: one to four players share four stations, and each station has real jobs during the flight.
 *
 * What the crew does is checked against what the simulation actually contains. At the pad every station is
 * asked GO or NO-GO, and a station whose subsystem has a real error in the design (the engine's own issue list)
 * should say NO-GO. Later jobs (separations, deploying the panels, the burns, answering a malfunction or an
 * outage) open when the flight reaches them. The crew's answers change the *score*, not the physics: the design
 * decides how the mission flies, the crew decides how well it is run. A job nobody does is done by the flight
 * computer, and that costs points. Everything here is pure; `crewStore` holds the live session.
 */
import type { StageId } from '@/mission/sim';

export const CREW_ROLES = ['director', 'propulsion', 'power', 'comms'] as const;
export type CrewRole = (typeof CREW_ROLES)[number];
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = ['#22d3ee', '#fbbf24', '#a78bfa', '#34d399'] as const;

export const clampPlayers = (count: number): number => Math.max(1, Math.min(MAX_PLAYERS, Math.round(count) || 1));

/** Which player sits at a station. One player runs all four; four players have one each. */
export function playerOfRole(role: CrewRole, playerCount: number): number {
  return CREW_ROLES.indexOf(role) % clampPlayers(playerCount);
}

export function rolesOfPlayer(player: number, playerCount: number): CrewRole[] {
  return CREW_ROLES.filter((role) => playerOfRole(role, playerCount) === player);
}

/* ---- what is wrong with the design, by station ---- */

const ROLE_OF_ISSUE: Record<string, CrewRole> = {
  'delta-v-insufficient': 'propulsion',
  'low-thrust-cannot-insert': 'propulsion',
  'departure-energy-insufficient': 'propulsion',
  'delta-v-margin-tight': 'propulsion',
  'mass-over-launcher-capacity': 'propulsion',
  'site-cannot-reach-inclination': 'propulsion',
  'site-inclination-penalty': 'propulsion',
  'power-deficit': 'power',
  'battery-too-small': 'power',
  'no-power-source': 'power',
  'power-margin-tight': 'power',
  'battery-margin-tight': 'power',
  'no-radio': 'comms',
  'link-cannot-close': 'comms',
  'link-below-hardware-rate': 'comms',
  'data-storage-overflow': 'comms',
  'data-backlog-at-end': 'comms',
  'no-instruments': 'comms',
  'pointing-insufficient': 'comms',
};

export const roleOfIssue = (code: string): CrewRole => ROLE_OF_ISSUE[code] ?? 'director';

export type IssueLike = { code: string; severity: 'error' | 'warning' };

/** The truthful answer to "GO or NO-GO?" for one station: NO-GO while the design has an error in its area. */
export function padStatus(role: CrewRole, issues: readonly IssueLike[]): { expected: 'go' | 'nogo'; errors: string[]; warnings: string[] } {
  const own = issues.filter((issue) => roleOfIssue(issue.code) === role);
  const errors = own.filter((issue) => issue.severity === 'error').map((issue) => issue.code);
  const warnings = own.filter((issue) => issue.severity === 'warning').map((issue) => issue.code);
  return { expected: errors.length > 0 ? 'nogo' : 'go', errors, warnings };
}

/* ---- the jobs ---- */

export type CrewInput = {
  stage: StageId;
  stageElapsedS: number;
  stageLengthS: number;
  /** How much faster than real time the ascent plays (1 = real). */
  speed: number;
  hasBoosters: boolean;
  hasCorrections: boolean;
  separation: { boosters: number; stage1: number; fairing: number };
  /** Ids of the events that have started (`<kind>-<n>`). */
  eventsStarted: readonly string[];
  /** Keys of the jobs that are open right now. */
  openKeys: readonly string[];
  /** The mission is over (completed or lost). */
  ended: boolean;
};

export type TaskDef = {
  role: CrewRole;
  kind: 'poll' | 'action';
  stage: StageId;
  /** Wall-clock seconds the crew has. */
  windowS: number;
  /** While this job is open the playback slows to real time or slower, so the crew can keep up (not used in the climb, which is real time already). */
  hold: boolean;
  open: (input: CrewInput) => boolean;
  /** The simulation moment at which the flight computer takes over. */
  due?: (input: CrewInput) => boolean;
};

const remaining = (i: CrewInput) => i.stageLengthS - i.stageElapsedS;
const tau = (i: CrewInput) => (i.stageLengthS > 0 ? i.stageElapsedS / i.stageLengthS : 0);
/** A launch job opens early enough that the crew really has `windowS` wall-clock seconds before the event happens. */
const lead = (i: CrewInput, windowS: number) => (i.stageLengthS > 0 ? (windowS * Math.max(1, i.speed)) / i.stageLengthS : 0);
const ever = () => true;

export const TASKS: Record<string, TaskDef> = {
  'go-power': { role: 'power', kind: 'poll', stage: 'pre-launch', windowS: 10, hold: true, open: (i) => remaining(i) <= 52, due: (i) => remaining(i) <= 1 },
  'go-propulsion': { role: 'propulsion', kind: 'poll', stage: 'pre-launch', windowS: 10, hold: true, open: (i) => remaining(i) <= 42, due: (i) => remaining(i) <= 1 },
  'go-comms': { role: 'comms', kind: 'poll', stage: 'pre-launch', windowS: 10, hold: true, open: (i) => remaining(i) <= 32, due: (i) => remaining(i) <= 1 },
  'go-director': { role: 'director', kind: 'poll', stage: 'pre-launch', windowS: 10, hold: true, open: (i) => remaining(i) <= 20, due: (i) => remaining(i) <= 1 },
  maxq: { role: 'propulsion', kind: 'action', stage: 'launch', windowS: 12, hold: false, open: (i) => tau(i) >= 0.15, due: (i) => tau(i) >= 0.27 },
  'booster-sep': { role: 'director', kind: 'action', stage: 'launch', windowS: 12, hold: false, open: (i) => i.hasBoosters && tau(i) >= i.separation.boosters - lead(i, 12), due: (i) => tau(i) >= i.separation.boosters },
  'stage-sep': { role: 'propulsion', kind: 'action', stage: 'launch', windowS: 12, hold: false, open: (i) => tau(i) >= i.separation.stage1 - lead(i, 12), due: (i) => tau(i) >= i.separation.stage1 },
  'fairing-sep': { role: 'comms', kind: 'action', stage: 'launch', windowS: 12, hold: false, open: (i) => tau(i) >= i.separation.fairing - lead(i, 12), due: (i) => tau(i) >= i.separation.fairing },
  meco: { role: 'director', kind: 'action', stage: 'launch', windowS: 10, hold: false, open: (i) => tau(i) >= 0.93 },
  'deploy-panels': { role: 'power', kind: 'action', stage: 'orbit-insertion', windowS: 10, hold: true, open: ever },
  'link-check': { role: 'comms', kind: 'action', stage: 'orbit-insertion', windowS: 10, hold: true, open: ever },
  'course-correction': { role: 'propulsion', kind: 'action', stage: 'cruise', windowS: 10, hold: true, open: (i) => i.hasCorrections && tau(i) >= 0.3 },
  'arrival-go': { role: 'director', kind: 'action', stage: 'destination-arrival', windowS: 10, hold: true, open: ever },
  'arrival-burn': { role: 'propulsion', kind: 'action', stage: 'destination-arrival', windowS: 10, hold: true, open: ever },
  downlink: { role: 'comms', kind: 'action', stage: 'data-transmission', windowS: 10, hold: true, open: ever },
};

/** The jobs that answer the simulation's own events. */
export const EVENT_TASKS: Record<string, { role: CrewRole; windowS: number }> = {
  'ev-solar-degradation': { role: 'power', windowS: 9 },
  'ev-instrument-malfunction': { role: 'comms', windowS: 9 },
  'ev-communication-outage': { role: 'comms', windowS: 9 },
  'ev-observation-opportunity': { role: 'comms', windowS: 9 },
  'ev-increased-power-demand': { role: 'power', windowS: 9 },
};
/** Event jobs are limited so a long science stage cannot hold the playback forever. */
export const MAX_EVENT_TASKS = 6;

export type TaskInfo = { role: CrewRole; kind: 'poll' | 'action'; windowS: number; hold: boolean };

export function taskInfo(defId: string): TaskInfo | null {
  const def = TASKS[defId];
  if (def) return { role: def.role, kind: def.kind, windowS: def.windowS, hold: def.hold };
  const event = EVENT_TASKS[defId];
  return event ? { role: event.role, kind: 'action', windowS: event.windowS, hold: true } : null;
}

export type TaskOpening = { key: string; defId: string };

/** Decides which jobs open and which are due, each at most once per flight. Pure; give it the flight state every tick. */
export function createCrewScheduler() {
  const opened = new Set<string>();
  let eventTasks = 0;
  let lastStage: StageId | null = null;
  return {
    reset() {
      opened.clear();
      eventTasks = 0;
      lastStage = null;
    },
    update(input: CrewInput): { open: TaskOpening[]; due: string[] } {
      if (lastStage !== null && input.stage === 'pre-launch' && lastStage !== 'pre-launch') { opened.clear(); eventTasks = 0; }
      lastStage = input.stage;
      const open: TaskOpening[] = [];
      const due: string[] = [];
      if (input.ended) return { open, due };
      for (const [id, def] of Object.entries(TASKS)) {
        if (def.stage !== input.stage) continue;
        if (!opened.has(id) && def.open(input)) {
          opened.add(id);
          open.push({ key: id, defId: id });
        }
        if (input.openKeys.includes(id) && def.due?.(input)) due.push(id);
      }
      if (input.stage === 'science-operations') {
        for (const eventId of input.eventsStarted) {
          if (opened.has(eventId) || eventTasks >= MAX_EVENT_TASKS) continue;
          const defId = `ev-${eventId.replace(/-\d+$/, '')}`;
          if (!EVENT_TASKS[defId]) continue;
          opened.add(eventId);
          eventTasks += 1;
          open.push({ key: eventId, defId });
        }
      }
      return { open, due };
    },
  };
}

/* ---- judging an answer ---- */

export type CrewResult = 'perfect' | 'good' | 'missed' | 'wrong-go' | 'false-hold' | 'correct-nogo' | 'skipped';

export const TASK_POINTS = { perfect: 30, good: 20, missed: -20, 'wrong-go': -30, 'false-hold': -15, 'correct-nogo': 30, skipped: 0 } as const satisfies Record<CrewResult, number>;
/** The most one job can earn. */
export const TASK_MAX = 30;
/** An answer within this share of the window counts as quick. */
export const QUICK_SHARE = 0.4;

export function judgeAnswer(input: { kind: 'poll' | 'action'; expected: 'go' | 'nogo' | null; choice: 'go' | 'nogo' | 'do'; responseS: number; windowS: number }): CrewResult {
  if (input.kind === 'poll') {
    if (input.choice === 'nogo') return input.expected === 'nogo' ? 'correct-nogo' : 'false-hold';
    if (input.expected === 'nogo') return 'wrong-go';
  }
  return input.responseS <= input.windowS * QUICK_SHARE ? 'perfect' : 'good';
}
