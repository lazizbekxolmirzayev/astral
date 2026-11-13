import { useSyncExternalStore } from 'react';

/** A counter that goes up whenever the flight cuts to a different scene; the overlay restarts its fade on each change. */
let count = 0;
const listeners = new Set<() => void>();
export function triggerSceneFade(): void {
  count += 1;
  listeners.forEach((listener) => listener());
}
export function useSceneFade(): number {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => count, () => 0);
}
