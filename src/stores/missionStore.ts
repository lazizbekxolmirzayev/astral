import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { analyzeDesign } from '@/mission/analysis';
import { startingDesign } from '@/mission/data';
import { scoreMission } from '@/mission/score';
import { simulateMission } from '@/mission/simulate';
import type { FlightResult, MissionDesign, Outcome, RoleId } from '@/mission/types';

export const MISSION_STEPS = ['objective', 'spacecraft', 'payload', 'orbit', 'review', 'flight', 'report'] as const;
export type MissionStep = (typeof MISSION_STEPS)[number];

export const ROLES: readonly RoleId[] = ['director', 'engineer', 'scientist', 'operator'];

/** Who leads each design step in team play. */
export const STEP_OWNER: Partial<Record<MissionStep, RoleId>> = {
  objective: 'director',
  spacecraft: 'engineer',
  payload: 'scientist',
  orbit: 'operator',
};

const MAX_ATTEMPTS = 12;

export type Attempt = {
  id: number;
  objectiveId: string;
  score: number;
  outcome: Outcome;
  costM: number;
  wetKg: number;
  instruments: number;
};

type MissionState = {
  step: MissionStep;
  design: MissionDesign | null;
  teamPlay: boolean;
  players: Record<RoleId, string>;
  signoffs: readonly RoleId[];
  flight: FlightResult | null;
  attempts: readonly Attempt[];
  bestScores: Readonly<Record<string, number>>;
  sandbox: boolean;
  tutorialDone: boolean;
  setSandbox: (sandbox: boolean) => void;
  finishTutorial: () => void;
  loadDesign: (design: MissionDesign) => void;
  goTo: (step: MissionStep) => void;
  chooseObjective: (objectiveId: string) => void;
  updateDesign: (patch: Partial<MissionDesign>) => void;
  toggleInstrument: (instrumentId: string) => void;
  setTeamPlay: (teamPlay: boolean) => void;
  setPlayer: (role: RoleId, name: string) => void;
  toggleSignoff: (role: RoleId) => void;
  launch: (seed: number) => void;
};

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      step: 'objective',
      design: null,
      teamPlay: false,
      players: { director: '', engineer: '', scientist: '', operator: '' },
      signoffs: [],
      flight: null,
      attempts: [],
      bestScores: {},
      sandbox: false,
      tutorialDone: false,
      setSandbox: (sandbox) => set({ sandbox }),
      finishTutorial: () => set({ tutorialDone: true }),
      loadDesign: (design) => set({ design, sandbox: Boolean(design.sandbox), step: 'review', flight: null, signoffs: [] }),
      goTo: (step) => set({ step }),
      chooseObjective: (objectiveId) => set((state) => ({ design: { ...startingDesign(objectiveId), sandbox: state.sandbox }, step: 'spacecraft', flight: null, signoffs: [] })),
      updateDesign: (patch) => set((state) => (state.design ? { design: { ...state.design, ...patch }, signoffs: [] } : state)),
      toggleInstrument: (instrumentId) =>
        set((state) => {
          if (!state.design) return state;
          const selected = state.design.instrumentIds;
          const instrumentIds = selected.includes(instrumentId) ? selected.filter((id) => id !== instrumentId) : [...selected, instrumentId];
          return { design: { ...state.design, instrumentIds }, signoffs: [] };
        }),
      setTeamPlay: (teamPlay) => set({ teamPlay, signoffs: [] }),
      setPlayer: (role, name) => set((state) => ({ players: { ...state.players, [role]: name } })),
      toggleSignoff: (role) => set((state) => ({ signoffs: state.signoffs.includes(role) ? state.signoffs.filter((item) => item !== role) : [...state.signoffs, role] })),
      launch: (seed) => {
        const { design, teamPlay, attempts, bestScores } = get();
        if (!design) return;
        const flight = simulateMission(design, seed);
        const analysis = analyzeDesign(design);
        const attempt: Attempt = {
          id: seed,
          objectiveId: design.objectiveId,
          score: scoreMission(analysis, flight, teamPlay).total,
          outcome: flight.outcome,
          costM: Math.round(analysis.budget.totalM),
          wetKg: Math.round(analysis.mass.wetKg),
          instruments: design.instrumentIds.length,
        };
        const ranked = !design.sandbox && attempt.score > (bestScores[design.objectiveId] ?? 0);
        set({
          flight,
          step: 'flight',
          attempts: [attempt, ...attempts].slice(0, MAX_ATTEMPTS),
          bestScores: ranked ? { ...bestScores, [design.objectiveId]: attempt.score } : bestScores,
        });
      },
    }),
    {
      name: 'mission-game',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // A flight is not saved: reopening mid-flight returns to the launch review.
      partialize: ({ design, teamPlay, players, attempts, bestScores, sandbox, tutorialDone }) => ({ design, teamPlay, players, attempts, bestScores, sandbox, tutorialDone }),
    },
  ),
);
