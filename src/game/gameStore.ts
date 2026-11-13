import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DestinationId } from '@/mission';
import { missionStore } from '@/stores/missionStore';
import { simStore } from '@/stores/simStore';
import type { MissionOutcome, StageRecord } from '@/mission/sim';
import type { Localized } from '@/mission';
import { cinematicRate, type AscentSpeed } from './cinematic';
import { pilotStore } from './pilotStore';
import { crewStore, type AbortInfo, type CrewLogEntry } from './crewStore';
import { collectMistakes, type Mistake } from './mistakes';
import { REPLAY_ASCENT_SPEED, type ReplaySpeed } from './replay';
import { DEFAULT_DIFFICULTY, type Difficulty } from './difficulty';
import { computeScore, type Score } from './score';

/**
 * The flow of the game: choose a destination on the map, build and equip the spacecraft in the hangar,
 * launch, watch the flight, read the result. This store only knows *where the player is* in that flow.
 * The design lives in the mission store and the flight in the simulation store, so the game, the
 * Engineer pages and the simulation always agree.
 */
export type GamePhase = 'map' | 'hangar' | 'flight' | 'result' | 'replay';
export type HangarView = 'ship' | 'rockets';
export type LaunchCameraMode = 'auto' | 'side' | 'track' | 'chase' | 'rear' | 'onboard' | 'crew' | 'orbit';
export const LAUNCH_CAMERAS: readonly LaunchCameraMode[] = ['auto', 'side', 'track', 'chase', 'rear', 'onboard', 'crew', 'orbit'];

/** Everything the result screen and the video need about the flight that just ended. */
export type FlightRecord = {
  missionId: string;
  outcome: MissionOutcome;
  stages: StageRecord[];
  endedT: number;
  score: Score;
  mistakes: Mistake[];
  log: CrewLogEntry[];
  playerCount: number;
  names: string[];
};

/** Why the last launch was scrubbed (a station called NO-GO on a real fault), shown in the hangar. */
export type AbortNotice = { info: AbortInfo; messages: Localized[] };

const HOLD_FACTOR = 0.04;
const ASCENT_STAGES = new Set(['launch']);

export type GameState = {
  record: FlightRecord | null;
  abortNotice: AbortNotice | null;
  replaySpeed: ReplaySpeed;
  setReplaySpeed: (speed: ReplaySpeed) => void;
  /** Plays the finished flight again as a video. */
  startReplay: () => boolean;
  /** Back from the video to the result. */
  endReplay: () => void;
  /** Scrubs the launch after a NO-GO on a real fault and returns to the hangar. */
  abortLaunch: (notice: AbortNotice) => void;
  dismissAbort: () => void;
  phase: GamePhase;
  /** The destination highlighted on the map (not yet committed). */
  focus: DestinationId | null;
  /** Committed destination; the mission was created from it. */
  destinationId: DestinationId | null;
  missionId: string | null;
  hangarView: HangarView;
  /** Which camera shows the launch; `auto` cuts between the others like a broadcast. */
  launchCamera: LaunchCameraMode;
  setLaunchCamera: (mode: LaunchCameraMode) => void;
  /** How much faster than real time the countdown and the climb play (1 = a real launch). */
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  ascentSpeed: AscentSpeed;
  setAscentSpeed: (speed: AscentSpeed) => void;
  /** The camera actually in use right now (differs from `launchCamera` while it is `auto`); null outside the launch. */
  activeCamera: Exclude<LaunchCameraMode, 'auto'> | null;
  setActiveCamera: (mode: Exclude<LaunchCameraMode, 'auto'> | null) => void;
  /** Highlights a destination on the map; the camera glides to it. */
  focusDestination: (id: DestinationId | null) => void;
  /** Creates the mission from the template of the focused destination and enters the hangar. */
  confirmDestination: (title: string) => string | null;
  setHangarView: (view: HangarView) => void;
  /** Starts the simulation of the current design with cinematic pacing. Returns false when the design cannot fly. */
  launch: () => boolean;
  /** The simulation has finished: show the result. */
  showResult: () => void;
  /** Back to the hangar with the same design to improve it. */
  redesign: () => void;
  /** Back to the map; the finished mission stays in the Engineer pages. */
  newMission: () => void;
  /** Leave the hangar for the map and drop the unflown draft. */
  cancelHangar: () => void;
};

export function createGameStore(): StoreApi<GameState> {
  return createStore<GameState>()((set, get) => ({
    phase: 'map',
    record: null,
    abortNotice: null,
    replaySpeed: 1,
    setReplaySpeed: (replaySpeed) => set({ replaySpeed }),
    startReplay: () => {
      const { record, missionId } = get();
      const mission = missionId ? missionStore.getState().missions[missionId] : undefined;
      if (!record || !mission) return false;
      pilotStore.getState().reset();
      simStore.getState().setRateModel((plan, stage, stageElapsedS) => cinematicRate(plan, stage, { stageElapsedS, speed: REPLAY_ASCENT_SPEED }) * get().replaySpeed);
      simStore.getState().restart(mission);
      set({ phase: 'replay' });
      return true;
    },
    endReplay: () => {
      simStore.getState().finishNow();
      set((state) => (state.phase === 'replay' ? { phase: 'result' } : state));
    },
    abortLaunch: (abortNotice) => {
      simStore.getState().clear();
      crewStore.getState().reset();
      set((state) => (state.missionId ? { phase: 'hangar', hangarView: 'ship', abortNotice } : state));
    },
    dismissAbort: () => set({ abortNotice: null }),
    focus: null,
    destinationId: null,
    missionId: null,
    hangarView: 'ship',
    launchCamera: 'auto',
    difficulty: DEFAULT_DIFFICULTY,
    setDifficulty: (difficulty) => { pilotStore.getState().setDifficulty(difficulty); set({ difficulty }); },
    ascentSpeed: 1,
    setAscentSpeed: (ascentSpeed) => set({ ascentSpeed }),
    setLaunchCamera: (launchCamera) => set({ launchCamera }),
    activeCamera: null,
    setActiveCamera: (activeCamera) => set((state) => (state.activeCamera === activeCamera ? state : { activeCamera })),
    focusDestination: (focus) => set((state) => (state.phase === 'map' && state.focus !== focus ? { focus } : state)),
    confirmDestination: (title) => {
      const { focus, phase } = get();
      if (phase !== 'map' || !focus) return null;
      const missionId = missionStore.getState().createFromTemplate(focus, title);
      set({ phase: 'hangar', destinationId: focus, missionId, hangarView: 'ship' });
      return missionId;
    },
    setHangarView: (hangarView) => set({ hangarView }),
    launch: () => {
      const { missionId, phase } = get();
      const mission = missionId ? missionStore.getState().missions[missionId] : undefined;
      if (phase !== 'hangar' || !mission) return false;
      crewStore.getState().reset();
      pilotStore.getState().reset();
      // while a crew job is open the slow stages play almost in slow motion, so the crew can answer
      simStore.getState().setRateModel((plan, stage, stageElapsedS) => {
        // while a person flies the ascent the mission clock waits at lift-off; the flight itself runs in the pilot store
        if (stage === 'launch' && pilotStore.getState().flight) return 0;
        const rate = cinematicRate(plan, stage, { stageElapsedS, speed: get().ascentSpeed });
        return crewStore.getState().holding && !ASCENT_STAGES.has(stage) ? Math.max(1, rate * HOLD_FACTOR) : rate;
      });
      simStore.getState().restart(mission);
      const { plan, status } = simStore.getState();
      if (!plan || plan.unresolvable || status === 'idle') return false;
      set({ phase: 'flight', record: null, abortNotice: null });
      return true;
    },
    showResult: () => {
      const { phase, missionId } = get();
      if (phase !== 'flight') return;
      const { plan, sim } = simStore.getState();
      const outcome = sim?.outcome;
      if (!plan || !sim || !outcome || !missionId) { set({ phase: 'result' }); return; }
      crewStore.getState().cancelAll();
      const crew = crewStore.getState();
      const log = crew.log;
      const score = computeScore({ outcome, health: sim.health, log, playerCount: crew.playerCount, difficulty: get().difficulty });
      const mistakes = collectMistakes({ outcome, timeline: sim.timeline, log, designIssues: plan.evaluation.issues.map((issue) => ({ code: issue.code, severity: issue.severity, message: issue.message })) });
      set({ phase: 'result', record: { missionId, outcome, stages: sim.stages, endedT: sim.t, score, mistakes, log, playerCount: crew.playerCount, names: crew.names } });
    },
    redesign: () => {
      simStore.getState().clear();
      set((state) => (state.missionId ? { phase: 'hangar', hangarView: 'ship', record: null } : state));
    },
    newMission: () => {
      simStore.getState().clear();
      set({ phase: 'map', focus: null, destinationId: null, missionId: null, hangarView: 'ship', record: null, abortNotice: null });
    },
    cancelHangar: () => {
      const { missionId } = get();
      if (missionId) missionStore.getState().remove(missionId);
      simStore.getState().clear();
      set((state) => ({ phase: 'map', destinationId: null, missionId: null, focus: state.focus }));
    },
  }));
}

export const gameStore = createGameStore();

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
