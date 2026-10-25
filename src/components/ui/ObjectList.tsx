'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { catalogEntries } from '@/data/catalog/entries';
import { solarSystem } from '@/data/solarSystem';
import { galaxyMarkers, universeMarkers } from '@/lib/universeLayout';
import { useSelectionStore } from '@/stores/selectionStore';
import { focusRing } from './FocusRing';

/** Keyboard-reachable list of what the current view shows; selecting one drives the inspector and camera. */
export function ObjectList() {
  const t = useTranslations('sidebar');
  const bodies = useTranslations('bodies');
  const scale = useSelectionStore((state) => state.scale);
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);

  const items = useMemo(() => {
    if (scale === 'galaxy') return galaxyMarkers().map((marker) => ({ id: marker.id, name: marker.name }));
    if (scale === 'universe') return universeMarkers().map((marker) => ({ id: marker.id, name: marker.name }));
    const namedSmallBodies = ['ceres', 'vesta', 'apophis', 'bennu', 'halley', 'pluto', 'haumea', 'makemake', 'eris'];
    const catalogBodies = catalogEntries
      .filter((entry) => namedSmallBodies.includes(entry.id))
      .map((entry) => ({ id: entry.id, name: entry.name }));
    return [...solarSystem.map((body) => ({ id: body.id, name: body.name })), ...catalogBodies];
  }, [scale]);

  return (
    <div className="px-2 pb-2">
      <div className="mb-2 rounded-[18px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.14),transparent_36%),linear-gradient(180deg,rgba(12,17,27,0.95),rgba(9,12,18,0.8))] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">{t('title')}</p>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-cyan-200">{items.length}</span>
        </div>
      </div>
      <ul aria-label={t('title')} className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={selectedId === item.id}
              onClick={() => select(selectedId === item.id ? null : item.id)}
              className={`flex w-full items-center justify-between rounded-2xl border px-2.5 py-2.5 text-left text-sm transition-all ${selectedId === item.id ? 'border-accent-cyan/40 bg-accent-cyan/12 text-accent-cyan shadow-[0_0_20px_rgba(0,240,255,0.12)]' : 'border-transparent bg-white/[0.02] text-foreground/70 hover:border-panel-border hover:bg-white/[0.04] hover:text-foreground'} ${focusRing()}`}
            >
              <span className="truncate">{bodies.has(item.id) ? bodies(item.id) : item.name}</span>
              <span className={`h-2 w-2 rounded-full ${selectedId === item.id ? 'bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.8)]' : 'bg-foreground/25'}`} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
