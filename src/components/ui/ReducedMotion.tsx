'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that tracks the `prefers-reduced-motion` media query.
 *
 * Returns `true` when the user has requested reduced motion. Components should
 * skip or simplify animations when this is true.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  return reduced ?? (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Synchronously reads `prefers-reduced-motion` without React state.
 * Useful for one-off decisions outside of render (e.g. inside useFrame).
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
