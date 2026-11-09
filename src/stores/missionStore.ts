import { nanoid } from 'nanoid';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createBlankMission, createDefaultMission, type DestinationId, type EditError, type EditResult, type Mission } from '@/mission';

/**
 * The missions of this browser session, as plain mission documents.
 *
 * This store holds the single source of truth, `Mission`, and nothing computed from
 * it: mass, power, Δv and readiness come from the resource engine
 * (`evaluateMissionCached`), so they can never disagree with the document. Missions
 * live in memory only (guest mode); saving to the browser's database is a later phase.
 *
 * Edits go through the pure functions in `src/mission/edit.ts`; the store only
 * swaps the resulting document in. A mission whose edit is refused is left as it was.
 */

export type MissionStoreState = {
  missions: Readonly<Record<string, Mission>>;
  /** Mission ids, newest first. */
  order: readonly string[];
  /** The part highlighted in lists and in the 3D preview (a catalog id), or null. */
  selectedPartId: string | null;
  createFromTemplate: (destinationId: DestinationId, title: string) => string;
  createBlank: (destinationId: DestinationId, title: string) => string;
  duplicate: (id: string, title: string) => string | null;
  remove: (id: string) => void;
  /** Applies a pure edit to a mission. Returns the refusal reason, or null when it was applied. */
  edit: (id: string, change: (mission: Mission) => EditResult) => EditError | null;
  selectPart: (itemId: string | null) => void;
};

export type MissionStoreDeps = {
  newId: () => string;
  now: () => string;
  newSeed: () => number;
};

const defaultDeps: MissionStoreDeps = {
  newId: () => nanoid(10),
  now: () => new Date().toISOString(),
  newSeed: () => Math.floor(Math.random() * 0xffff_ffff),
};

export function createMissionStore(deps: Partial<MissionStoreDeps> = {}): StoreApi<MissionStoreState> {
  const { newId, now, newSeed } = { ...defaultDeps, ...deps };

  return createStore<MissionStoreState>()((set, get) => {
    const insert = (mission: Mission) => set((state) => ({ missions: { ...state.missions, [mission.id]: mission }, order: [mission.id, ...state.order], selectedPartId: null }));

    return {
      missions: {},
      order: [],
      selectedPartId: null,

      createFromTemplate: (destinationId, title) => {
        const id = newId();
        insert(createDefaultMission(destinationId, { id, now: now(), title, seed: newSeed() }));
        return id;
      },
      createBlank: (destinationId, title) => {
        const id = newId();
        insert(createBlankMission(destinationId, { id, now: now(), title, seed: newSeed() }));
        return id;
      },
      duplicate: (id, title) => {
        const source = get().missions[id];
        if (!source) return null;
        const copyId = newId();
        const stamp = now();
        insert({ ...structuredClone(source), id: copyId, title, revision: 0, status: 'draft', createdAt: stamp, updatedAt: stamp, seed: newSeed() });
        return copyId;
      },
      remove: (id) =>
        set((state) => {
          if (!state.missions[id]) return state;
          const rest = Object.fromEntries(Object.entries(state.missions).filter(([key]) => key !== id));
          return { missions: rest, order: state.order.filter((entry) => entry !== id), selectedPartId: null };
        }),
      edit: (id, change) => {
        const mission = get().missions[id];
        if (!mission) return 'not-installed';
        const result = change(mission);
        if (result.error) return result.error;
        if (result.mission !== mission) set((state) => ({ missions: { ...state.missions, [id]: { ...result.mission, updatedAt: now() } } }));
        return null;
      },
      selectPart: (selectedPartId) => set((state) => (state.selectedPartId === selectedPartId ? state : { selectedPartId })),
    };
  });
}

/** The session's mission store. */
export const missionStore = createMissionStore();

export function useMissionStore<T>(selector: (state: MissionStoreState) => T): T {
  return useStore(missionStore, selector);
}
