import { create } from 'zustand';
import { invalidateDiagnostics } from '@/stores/diagnosticsStore';
import { simulation } from '@/lib/simulation';

/** Speed multipliers offered by the toolbar. */
export const TIME_SPEEDS = [1, 10, 100, 1000] as const;
export type TimeSpeed = (typeof TIME_SPEEDS)[number];

/**
 * Playback controls only. The simulated time itself is NOT stored here — it
 * lives in `simulation.elapsedDays`, so advancing it every frame never
 * re-renders a React component. The 3D scene reads this store non-reactively
 * through `useTimeStore.getState()` inside `useFrame`.
 */
type TimeState = {
  playing: boolean;
  speed: TimeSpeed;
  togglePlaying: () => void;
  setSpeed: (speed: TimeSpeed) => void;
  /** Back to the epoch: body state and elapsed time, exactly. */
  reset: () => void;
};

export const useTimeStore = create<TimeState>()((set) => ({
  playing: true,
  speed: 1,
  togglePlaying: () => {
    set((state) => ({ playing: !state.playing }));
    invalidateDiagnostics();
  },
  setSpeed: (speed) => {
    set({ speed });
    invalidateDiagnostics();
  },
  reset: () => {
    simulation.reset();
    invalidateDiagnostics();
  },
}));

/**
 * Called once per rendered frame with the real elapsed seconds. Paused frames
 * do nothing at all, so a long pause cannot make the next frame jump.
 *
 * Returns the number of physics steps actually taken (0 when paused), which is
 * what the frame driver uses to decide whether to publish diagnostics.
 */
export function stepSimulation(deltaSeconds: number): number {
  const { playing, speed } = useTimeStore.getState();
  if (!playing) return 0;
  return simulation.advance(deltaSeconds, speed);
}
