'use client';

import { cn } from '@/lib/utils';

/**
 * A visible focus-visible ring for interactive elements.
 *
 * Usage:
 *   <button className={focusRing()}>…</button>
 *   <input className={focusRing('focus-visible:ring-2 focus-visible:ring-offset-2')} />
 *
 * The ring uses `focus-visible` so it only shows for keyboard users, not mouse
 * clicks. Colors are chosen for 3:1 contrast against the dark background.
 */
export function focusRing(extra: string = ''): string {
  return cn(
    'outline-none',
    'focus-visible:z-10 focus-visible:rounded-sm',
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-cyan',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    extra,
  );
}