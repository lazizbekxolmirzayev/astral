'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
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
    return solarSystem.map((body) => ({ id: body.id, name: body.name }));
  }, [scale]);

  return (
    <ul aria-label={t('title')} className="max-h-72 overflow-y-auto px-2 pb-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            aria-pressed={selectedId === item.id}
            onClick={() => select(selectedId === item.id ? null : item.id)}
            className={`w-full rounded px-2 py-1 text-left text-sm ${selectedId === item.id ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-foreground/70 hover:text-foreground'} ${focusRing()}`}
          >
            {bodies.has(item.id) ? bodies(item.id) : item.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
