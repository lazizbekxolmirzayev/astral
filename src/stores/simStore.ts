import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Mission } from '@/mission';
import { advanceSim, buildSimPlan, createSim, skipToNextStage, type SimPlan, type SimState, type StageId } from '@/mission/sim';

/**
 * The running mission simulation of this browser session (one at a time).
 *
 * The simulation itself is pure (`src/mission/sim`); this store only holds the current plan and
 * state and the playback controls. It never holds a number that the simulation did not compute.
 * Time is driven from outside (`tick`), so tests drive it with exact amounts and the UI with the
 * frame clock.
 */

/** Simulated seconds per real second for each playback speed. */
export const SIM_SPEEDS = [
  { id: 'x1', factor: 1 },
  { id: 'x60', factor: 60 },
  { id: 'x600', factor: 600 },
  { id: 'x3600', factor: 3_600 },
  { id: 'x21600', factor: 21_600 },
  { id: 'day', factor: 86_400 },
  { id: 'days10', factor: 864_000 },
] as const;
export type SimSpeedId = (typeof SIM_SPEEDS)[number]['id'];

export type SimStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Largest real-time gap a single tick may cover, so a background tab does not jump the simulation. */
export const MAX_TICK_REAL_SECONDS = 0.25;

/** Replaces the speed presets with a rate chosen per stage (the game's cinematic pacing). */
export type RateModel = (plan: SimPlan, stage: StageId, stageElapsedS: number) => number;

export type SimStoreState = {
  missionId: string | null;
  /** Revision of the mission document the plan was built from. */
  missionRevision: number | null;
  plan: SimPlan | null;
  sim: SimState | null;
  status: SimStatus;
  speed: SimSpeedId;
  /** Continuous mission time the playback has reached; the state trails it by less than one step. */
  clockT: number;
  /** When set, the simulated seconds per real second come from this model instead of `speed`. */
  rateModel: RateModel | null;
  /** Builds a fresh plan and state for this mission and leaves them idle. */
  prepare: (mission: Mission) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Rebuilds from the given (current) mission document and starts again from zero. */
  restart: (mission: Mission) => void;
  setSpeed: (speed: SimSpeedId) => void;
  setRateModel: (model: RateModel | null) => void;
  /** Runs the active stage to its end (a real step of the simulation, not a jump of the display). */
  skipStage: () => void;
  /** Advances playback by `realSeconds` of wall-clock time at the chosen speed. */
  tick: (realSeconds: number) => void;
  /** Forgets the simulation. */
  clear: () => void;
};

const factorOf = (speed: SimSpeedId) => SIM_SPEEDS.find((entry) => entry.id === speed)?.factor ?? 1;

export function createSimStore(): StoreApi<SimStoreState> {
  return createStore<SimStoreState>()((set, get) => {
    const load = (mission: Mission, status: SimStatus) => {
      const plan = buildSimPlan(mission);
      const sim = createSim(plan);
      set({ missionId: mission.id, missionRevision: mission.revision, plan, sim, clockT: 0, status: sim.ended ? 'finished' : status });
    };
    return {
      missionId: null,
      missionRevision: null,
      plan: null,
      sim: null,
      status: 'idle',
      speed: 'x3600',
      clockT: 0,
      rateModel: null,
      prepare: (mission) => {
        const state = get();
        // A simulation that has begun keeps its own snapshot of the design until it is restarted.
        if (state.missionId === mission.id && state.status !== 'idle') return;
        if (state.missionId === mission.id && state.missionRevision === mission.revision && state.plan) return;
        load(mission, 'idle');
      },
      start: () => {
        const { status, plan, sim } = get();
        if (status !== 'idle' || !plan || !sim || plan.unresolvable) return;
        set({ status: 'running' });
      },
      pause: () => set((state) => (state.status === 'running' ? { status: 'paused' } : state)),
      resume: () => set((state) => (state.status === 'paused' ? { status: 'running' } : state)),
      restart: (mission) => {
        load(mission, 'running');
      },
      setSpeed: (speed) => set({ speed }),
      setRateModel: (rateModel) => set({ rateModel }),
      skipStage: () => {
        const { plan, sim, status } = get();
        if (!plan || !sim || sim.ended || status === 'idle') return;
        const next = skipToNextStage(plan, sim);
        set({ sim: next, clockT: next.t, status: next.ended ? 'finished' : status });
      },
      tick: (realSeconds) => {
        const { plan, sim, status, speed, clockT, rateModel } = get();
        if (status !== 'running' || !plan || !sim) return;
        const factor = rateModel ? rateModel(plan, plan.stageIds[sim.stageIndex]!, sim.stageElapsedS) : factorOf(speed);
        const target = clockT + Math.min(Math.max(0, realSeconds), MAX_TICK_REAL_SECONDS) * factor;
        const next = advanceSim(plan, sim, target - sim.t);
        set({ sim: next, clockT: next.ended ? next.t : target, status: next.ended ? 'finished' : 'running' });
      },
      clear: () => set({ missionId: null, missionRevision: null, plan: null, sim: null, status: 'idle', clockT: 0 }),
    };
  });
}

export const simStore = createSimStore();

export function useSimStore<T>(selector: (state: SimStoreState) => T): T {
  return useStore(simStore, selector);
}
