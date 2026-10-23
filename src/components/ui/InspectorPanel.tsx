'use client';

import { useTranslations } from 'next-intl';
import { CatalogEntryCard } from '@/components/catalog/CatalogEntryCard';
import { getCatalogEntry } from '@/data/catalog/entries';
import { solarSystem } from '@/data/solarSystem';
import type { Quantity } from '@/types/celestial';
import { useSelectionStore } from '@/stores/selectionStore';
import { focusRing } from './FocusRing';

const FIELDS = [
  'mass',
  'radius',
  'semiMajorAxis',
  'orbitalPeriod',
  'rotationPeriod',
  'axialTilt',
  'eccentricity',
  'meanTemperature',
] as const;

const PROVENANCE_STYLE: Record<Quantity['provenance'], string> = {
  measured: 'border-accent-cyan/40 text-accent-cyan',
  derived: 'border-accent-cyan/25 text-foreground/70',
  estimated: 'border-star-gold/50 text-star-gold',
  fictional: 'border-foreground/30 text-foreground/60',
  artistic: 'border-foreground/30 text-foreground/60',
};

function formatValue(q: Quantity): string {
  const abs = Math.abs(q.value);
  const text = abs !== 0 && (abs >= 1e6 || abs < 1e-3) ? q.value.toExponential(3) : String(Number(q.value.toPrecision(6)));
  return q.unit === 'dimensionless' || q.unit === '1' ? text : `${text} ${q.unit}`;
}

function sourceHref(source: string | undefined): string | null {
  return source && /^https?:\/\//.test(source) ? source : null;
}

/** Shows the selected body's catalogue values, each with its provenance label. */
export function InspectorPanel() {
  const t = useTranslations('inspector');
  const bodies = useTranslations('bodies');
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);
  const scale = useSelectionStore((state) => state.scale);
  const catalogEntry = selectedId && (scale !== 'system' || !solarSystem.some((candidate) => candidate.id === selectedId)) ? getCatalogEntry(selectedId) : undefined;
  const body = catalogEntry ? undefined : selectedId ? solarSystem.find((candidate) => candidate.id === selectedId) : undefined;

  return (
    <aside aria-labelledby="inspector-title" className="w-[24%] min-w-[208px] max-w-72 shrink-0 overflow-y-auto border-l border-panel-border">
      <h2 id="inspector-title" className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest text-foreground/60">
        {t('title')}
        {body || catalogEntry ? (
          <button type="button" onClick={() => select(null)} className={`ml-auto rounded px-2 py-0.5 text-[10px] normal-case tracking-normal text-foreground/60 hover:text-accent-cyan ${focusRing()}`}>
            {t('clear')}
          </button>
        ) : null}
      </h2>
      {catalogEntry ? (
        <div className="px-4 pb-4"><CatalogEntryCard entry={catalogEntry} compact /></div>
      ) : !body ? (
        <p className="px-4 text-sm text-foreground/40">{t('noSelection')}</p>
      ) : (
        <div className="px-4 pb-4" aria-live="polite">
          <p className="text-base font-semibold">{bodies.has(body.id) ? bodies(body.id) : body.name}</p>
          <p className="text-xs text-foreground/55">{t('type')}: {t(`types.${body.type}`)}</p>
          <dl className="mt-3 space-y-3 text-sm">
            {FIELDS.map((field) => {
              const q = body[field];
              const href = q ? sourceHref(q.source) : null;
              return (
                <div key={field}>
                  <dt className="text-xs text-foreground/50">{t(`fields.${field}`)}</dt>
                  {q ? (
                    <dd className="mt-0.5">
                      <span className="font-mono">{formatValue(q)}</span>
                      <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${PROVENANCE_STYLE[q.provenance]}`}>{t(`prov.${q.provenance}`)}</span>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className={`mt-0.5 block truncate text-[10px] text-foreground/45 underline hover:text-accent-cyan ${focusRing()}`}>
                          {t('source')}
                        </a>
                      ) : null}
                    </dd>
                  ) : (
                    <dd className="mt-0.5 font-mono text-foreground/35">— <span className="font-sans text-[10px]">{t('noData')}</span></dd>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </aside>
  );
}
