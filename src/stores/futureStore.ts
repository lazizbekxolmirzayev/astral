import { create } from 'zustand';

/** Illustrative stellar-evolution timeline; it does not advance the N-body clock. */
export const FUTURE_MILESTONES = [0, 1_000, 100_000, 600_000_000, 1_000_000_000, 5_000_000_000, 7_500_000_000] as const;
export type FutureYear = (typeof FUTURE_MILESTONES)[number];

type FutureState = { yearsFromNow: FutureYear; setYearsFromNow: (years: FutureYear) => void };
export const useFutureStore = create<FutureState>((set) => ({ yearsFromNow: 0, setYearsFromNow: (yearsFromNow) => set({ yearsFromNow }) }));
