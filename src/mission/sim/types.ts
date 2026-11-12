import type { Localized } from '../i18n';
import type { RequirementKind } from '../models/mission';

export const STAGE_IDS = ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** Which kind of mission the destination makes this; each has its own stage list. */
export type MissionClass = 'earth-orbit' | 'geostationary' | 'lunar' | 'mars' | 'heliocentric';

export type StageResult = 'pending' | 'active' | 'ok' | 'degraded' | 'failed' | 'skipped';

export type StageRecord = {
  id: StageId;
  /** Planned length in seconds (the science stage may end earlier or later than planned; see `endReason`). */
  plannedSeconds: number;
  startS: number | null;
  endS: number | null;
  result: StageResult;
  /** Why the stage ended the way it did. */
  outcome: Localized | null;
};

export const EVENT_KINDS = ['solar-degradation', 'instrument-malfunction', 'communication-outage', 'observation-opportunity', 'increased-power-demand'] as const;
export type SimEventKind = (typeof EVENT_KINDS)[number];

/** One seeded event of the schedule. Same mission and seed give the same list. */
export type ScheduledEvent = {
  id: string;
  kind: SimEventKind;
  /** Mission elapsed time the event begins, seconds. */
  startS: number;
  /** End time; null for permanent effects. */
  endS: number | null;
  /** Kind-specific size: fraction lost, fraction of load added, or science multiplier minus one. */
  magnitude: number;
  /** Index into the instrument list, for malfunctions. */
  instrumentIndex: number | null;
};

export type TimelineKind = 'stage' | 'check' | 'burn' | 'event' | 'power' | 'comms' | 'science' | 'outcome';
export type TimelineSeverity = 'info' | 'success' | 'warning' | 'error';

export type TimelineEntry = {
  /** Mission elapsed time, seconds. */
  t: number;
  stage: StageId;
  kind: TimelineKind;
  severity: TimelineSeverity;
  text: Localized;
  /** Why it happened, in terms of the numbers the design produced. */
  cause: Localized | null;
};

export type InstrumentStatus = 'off' | 'idle' | 'observing' | 'unpowered' | 'fault';

export type InstrumentState = {
  instrumentId: string;
  status: InstrumentStatus;
  /** Observing seconds credited (an observation opportunity counts double). */
  creditedS: number;
  observedS: number;
  /** Fault end time, seconds; Infinity for a permanent fault; null when healthy. */
  faultUntilS: number | null;
};

export type RequirementCheck = { id: string; kind: RequirementKind; limit: number; actual: number; unit: string; met: boolean; fromSimulation: boolean };

export type OutcomeKind = 'success' | 'partial' | 'failure';

export type MissionOutcome = {
  kind: OutcomeKind;
  /** Headline reason, in the player's terms. */
  summary: Localized;
  /** Every contributing reason, most important first. */
  reasons: Localized[];
  requirements: RequirementCheck[];
  operationsDays: number;
  sciencePoints: number;
  scienceNominal: number;
  deliveredBits: number;
  generatedBits: number;
  lostBits: number;
  endBacklogBits: number;
  /** Stage in which the mission ended. */
  endedIn: StageId;
};

export type PowerMode = 'nominal' | 'instruments-shed' | 'comms-limited' | 'essential-only' | 'brownout' | 'unpowered';

/** The live, changing state. Everything telemetry shows comes from here (and the plan), never from a script. */
export type SimState = {
  /** Mission elapsed time, seconds. */
  t: number;
  stageIndex: number;
  stageElapsedS: number;
  /** True once the mission has ended (completed or lost). */
  ended: boolean;
  stages: StageRecord[];
  timeline: TimelineEntry[];
  outcome: MissionOutcome | null;

  // --- power ---
  batteryJ: number;
  generationW: number;
  loadW: number;
  sunlit: boolean;
  powerMode: PowerMode;
  /** Spacecraft health 0..1; falls while power is critically short. */
  health: number;

  // --- data ---
  generatedBits: number;
  deliveredBits: number;
  lostBits: number;
  backlogBits: number;
  inContact: boolean;

  // --- propulsion ---
  dvUsed: number;

  // --- instruments & events ---
  instruments: InstrumentState[];
  degradationFactor: number;
  opsStartS: number | null;
  opsEndS: number | null;
  /** Seconds of science operations actually flown. */
  opsFlownS: number;
  /** Event ids that have started / ended, so each is logged once. */
  eventsStarted: string[];
  eventsEnded: string[];
  /** Last time a recurring message was logged, per key, so a flickering condition does not flood the timeline. */
  lastLog: Record<string, number>;
  /** Why the science stage will end early, if it will. */
  opsLimit: 'planned' | 'design-life' | 'propellant' | null;
};
