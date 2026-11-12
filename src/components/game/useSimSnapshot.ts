'use client';

import { useEffect, useState } from 'react';
import { simStore, type SimStoreState } from '@/stores/simStore';

/**
 * The simulation as the HUD sees it: a copy refreshed a few times per second. The 3D scene reads the store
 * on every frame; the text panels do not need to re-render at 60 Hz.
 */
export function useSimSnapshot(intervalMs = 120): SimStoreState {
  const [snapshot, setSnapshot] = useState<SimStoreState>(() => simStore.getState());
  useEffect(() => {
    const id = window.setInterval(() => setSnapshot(simStore.getState()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return snapshot;
}
