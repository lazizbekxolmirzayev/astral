import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DestinationId } from '@/mission';
import { missionStore } from '@/stores/missionStore';
import { simStore } from '@/stores/simStore';
import { cinematicRate, type AscentSpeed } from './cinematic';

/**
 * The flow of the game: choose a destination on the map, build and equip the spacecraft in the hangar,
 * launch, watch the flight, read the result. This store only knows *where the player is* in that flow.
 * The design lives in the mission store and the flight in the simulation store, so the game, the
 * Engineer pages and the simulation always agree.
 */
export type GamePhase = 'map' | 'hangar' | 'flight' | 'result';
export type HangarView = 'ship' | 'rockets';
export type LaunchCameraMode = 'auto' | 'side' | 'track' | 'chase' | 'rear' | 'onboard' | 'crew';
export const LAUNCH_CAMERAS: readonly LaunchCameraMode[] = ['auto', 'side', 'track', 'chase', 'rear', 'onboard', 'crew'];

export type GameState = {
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
    focus: null,
    destinationId: null,
    missionId: null,
    hangarView: 'ship',
    launchCamera: 'auto',
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
      simStore.getState().setRateModel((plan, stage, stageElapsedS) => cinematicRate(plan, stage, { stageElapsedS, speed: get().ascentSpeed }));
      simStore.getState().restart(mission);
      const { plan, status } = simStore.getState();
      if (!plan || plan.unresolvable || status === 'idle') return false;
      set({ phase: 'flight' });
      return true;
    },
    showResult: () => set((state) => (state.phase === 'flight' ? { phase: 'result' } : state)),
    redesign: () => {
      simStore.getState().clear();
      set((state) => (state.missionId ? { phase: 'hangar', hangarView: 'ship' } : state));
    },
    newMission: () => {
      simStore.getState().clear();
      set({ phase: 'map', focus: null, destinationId: null, missionId: null, hangarView: 'ship' });
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
