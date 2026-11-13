import { useSyncExternalStore } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { StageId } from '@/mission/sim';
import { clampPlayers, judgeAnswer, playerOfRole, taskInfo, TASK_POINTS, type CrewResult, type CrewRole } from './crew';

/** A job the crew has been given and has not finished. */
export type CrewTask = {
  key: string;
  defId: string;
  role: CrewRole;
  player: number;
  kind: 'poll' | 'action';
  stage: StageId;
  hold: boolean;
  windowS: number;
  /** Crew clock (wall-clock seconds while the flight runs) at which it opened and runs out. */
  openedAtS: number;
  deadlineS: number;
  /** For a GO / NO-GO poll: what the design says the answer should be, and the engine issues behind a NO-GO. */
  expected: 'go' | 'nogo' | null;
  issueCodes: string[];
};

export type CrewLogEntry = {
  key: string;
  defId: string;
  role: CrewRole;
  player: number;
  stage: StageId;
  /** Mission time of the answer (or of the moment the flight computer took over), seconds. */
  missionT: number;
  result: CrewResult;
  responseS: number | null;
  /** Crew clock at the moment it was settled. */
  atS: number;
  points: number;
  expected: 'go' | 'nogo' | null;
  issueCodes: string[];
};

export type AbortInfo = { role: CrewRole; player: number; issueCodes: string[] };

export type CrewState = {
  playerCount: number;
  names: string[];
  clockS: number;
  open: CrewTask[];
  log: CrewLogEntry[];
  /** True while an open job asks the playback to slow down. */
  holding: boolean;
  /** Set when a station called NO-GO on a real fault: the launch is scrubbed. */
  abort: AbortInfo | null;
  setPlayerCount: (count: number) => void;
  setName: (player: number, name: string) => void;
  /** A new flight: forget the old session's jobs and log (players stay). */
  reset: () => void;
  advance: (dtS: number) => void;
  openTask: (input: { key: string; defId: string; stage: StageId; expected?: 'go' | 'nogo' | null; issueCodes?: string[] }) => CrewTask | null;
  /** The player at `role`'s station answers its oldest open job. Returns the logged entry, or null when the station has none. */
  respond: (role: CrewRole, choice: 'go' | 'nogo' | 'do', missionT: number) => CrewLogEntry | null;
  /** The flight computer takes over these jobs (time ran out or the moment passed). */
  autoComplete: (keys: readonly string[], missionT: number) => void;
  /** Jobs belonging to a stage that is over are taken over by the flight computer. */
  sweepStages: (currentStage: StageId, missionT: number) => void;
  /** Drops every open job without a penalty (a skipped stage, a ended mission). */
  cancelAll: () => void;
  clearAbort: () => void;
};

export const DEFAULT_NAMES = ['', '', '', ''];

export function createCrewStore(): StoreApi<CrewState> {
  return createStore<CrewState>()((set, get) => {
    const finish = (task: CrewTask, result: CrewResult, responseS: number | null, missionT: number): CrewLogEntry => ({
      key: task.key,
      defId: task.defId,
      role: task.role,
      player: task.player,
      stage: task.stage,
      missionT,
      result,
      responseS,
      atS: get().clockS,
      points: TASK_POINTS[result],
      expected: task.expected,
      issueCodes: task.issueCodes,
    });
    const settle = (tasks: readonly CrewTask[], entries: CrewLogEntry[], extra: Partial<CrewState> = {}) => {
      set((state) => {
        const remove = new Set(tasks.map((task) => task.key));
        const open = state.open.filter((task) => !remove.has(task.key));
        return { ...extra, open, log: [...state.log, ...entries], holding: open.some((task) => task.hold) };
      });
    };
    return {
      playerCount: 1,
      names: [...DEFAULT_NAMES],
      clockS: 0,
      open: [],
      log: [],
      holding: false,
      abort: null,
      setPlayerCount: (count) => set({ playerCount: clampPlayers(count) }),
      setName: (player, name) => set((state) => ({ names: state.names.map((entry, index) => (index === player ? name.slice(0, 14) : entry)) })),
      reset: () => set({ clockS: 0, open: [], log: [], holding: false, abort: null }),
      advance: (dtS) => set((state) => ({ clockS: state.clockS + Math.max(0, dtS) })),
      openTask: ({ key, defId, stage, expected = null, issueCodes = [] }) => {
        const info = taskInfo(defId);
        const state = get();
        if (!info || state.open.some((task) => task.key === key) || state.log.some((entry) => entry.key === key)) return null;
        const task: CrewTask = {
          key,
          defId,
          role: info.role,
          player: playerOfRole(info.role, state.playerCount),
          kind: info.kind,
          stage,
          hold: info.hold,
          windowS: info.windowS,
          openedAtS: state.clockS,
          deadlineS: state.clockS + info.windowS,
          expected: info.kind === 'poll' ? expected ?? 'go' : null,
          issueCodes,
        };
        set((current) => ({ open: [...current.open, task], holding: current.holding || task.hold }));
        return task;
      },
      respond: (role, choice, missionT) => {
        const state = get();
        const task = state.open.filter((entry) => entry.role === role && (choice !== 'nogo' || entry.kind === 'poll')).sort((a, b) => a.openedAtS - b.openedAtS)[0];
        if (!task) return null;
        if (choice === 'nogo' && task.kind !== 'poll') return null;
        const responseS = Math.max(0, state.clockS - task.openedAtS);
        const result = judgeAnswer({ kind: task.kind, expected: task.expected, choice, responseS, windowS: task.windowS });
        const entry = finish(task, result, responseS, missionT);
        settle([task], [entry], result === 'correct-nogo' ? { abort: { role: task.role, player: task.player, issueCodes: task.issueCodes } } : {});
        return entry;
      },
      autoComplete: (keys, missionT) => {
        const tasks = get().open.filter((task) => keys.includes(task.key));
        if (tasks.length === 0) return;
        settle(tasks, tasks.map((task) => finish(task, 'missed', null, missionT)));
      },
      sweepStages: (currentStage, missionT) => {
        const state = get();
        const late = state.open.filter((task) => task.stage !== currentStage);
        const expired = state.open.filter((task) => task.stage === currentStage && state.clockS >= task.deadlineS);
        const tasks = [...late, ...expired];
        if (tasks.length === 0) return;
        settle(tasks, tasks.map((task) => finish(task, 'missed', null, missionT)));
      },
      cancelAll: () => {
        const tasks = get().open;
        if (tasks.length === 0) return;
        settle(tasks, []);
      },
      clearAbort: () => set({ abort: null }),
    };
  });
}

export const crewStore = createCrewStore();

/** Reads the live crew session (also while rendering on the server, so the markup matches the current session). */
export function useCrewStore<T>(selector: (state: CrewState) => T): T {
  const read = () => selector(crewStore.getState());
  return useSyncExternalStore(crewStore.subscribe, read, read);
}
