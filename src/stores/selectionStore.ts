import { create } from 'zustand';

/**
 * Which body the user pointed at. Changes here come from pointer events, never
 * from the frame loop, so subscribing to this store cannot cause a per-frame
 * re-render.
 */
type SelectionState = {
  selectedId: string | null;
  hoveredId: string | null;
  /** Bumped by the toolbar reset so the camera can return to its default view. */
  viewResetNonce: number;
  select: (id: string | null) => void;
  hover: (id: string) => void;
  /** Ignored when another body is already the hovered one being left. */
  leaveHover: (id: string) => void;
  requestViewReset: () => void;
};

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedId: null,
  hoveredId: null,
  viewResetNonce: 0,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  leaveHover: (id) =>
    set((state) => (state.hoveredId === id ? { hoveredId: null } : state)),
  requestViewReset: () => set((state) => ({ viewResetNonce: state.viewResetNonce + 1 })),
}));
