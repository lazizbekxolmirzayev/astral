import type { Tone } from '@/mission/view';

/** Colour classes per tone. Colour is never the only cue: every use pairs it with an icon and a word. */
export const TONE_STYLES: Record<Tone, { text: string; border: string; surface: string; bar: string; led: string }> = {
  normal: { text: 'text-emerald-200', border: 'border-emerald-400/35', surface: 'bg-emerald-400/10', bar: 'bg-emerald-400', led: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' },
  warning: { text: 'text-amber-200', border: 'border-amber-300/45', surface: 'bg-amber-300/10', bar: 'bg-amber-300', led: 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]' },
  critical: { text: 'text-red-200', border: 'border-red-400/50', surface: 'bg-red-500/10', bar: 'bg-red-400', led: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.85)]' },
};

/** Width of a usage bar in percent: used / limit, capped so an overrun still fits the track. */
export function barPercent(fraction: number | null): number {
  if (fraction === null || Number.isNaN(fraction)) return 0;
  return Math.max(0, Math.min(100, fraction * 100));
}
