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
export function InspectorPanel({ mobileOpen = false }: { mobileOpen?: boolean } = {}) {
  const t = useTranslations('inspector');
  const bodies = useTranslations('bodies');
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);
  const scale = useSelectionStore((state) => state.scale);
  const catalogEntry = selectedId && (scale !== 'system' || !solarSystem.some((candidate) => candidate.id === selectedId)) ? getCatalogEntry(selectedId) : undefined;
  const body = catalogEntry ? undefined : selectedId ? solarSystem.find((candidate) => candidate.id === selectedId) : undefined;

  return (
    <aside aria-labelledby="inspector-title" className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] overflow-y-auto border-t border-panel-border bg-background shadow-2xl md:static md:block md:max-h-none md:w-[24%] md:min-w-[208px] md:max-w-72 md:shrink-0 md:border-l md:border-t-0 md:shadow-none bg-[linear-gradient(180deg,rgba(9,12,18,0.96),rgba(12,18,28,0.82))]`}>
      <div className="border-b border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.12),transparent_34%)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 id="inspector-title" className="text-[10px] uppercase tracking-[0.22em] text-foreground/60">
            {t('title')}
          </h2>
          {body || catalogEntry ? (
            <button type="button" onClick={() => select(null)} className={`ml-auto rounded-full border border-panel-border px-2 py-0.5 text-[10px] normal-case tracking-normal text-foreground/60 hover:border-accent-cyan/50 hover:text-accent-cyan ${focusRing()}`}>
              {t('clear')}
            </button>
          ) : null}
        </div>
      </div>

      {catalogEntry ? (
        <div className="px-4 pb-4 pt-4"><CatalogEntryCard entry={catalogEntry} compact /></div>
      ) : !body ? (
        <div className="px-4 py-5">
          <p className="rounded-[20px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.9),rgba(9,12,18,0.78))] p-3 text-sm text-foreground/45">{t('noSelection')}</p>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-4" aria-live="polite">
          <div className="rounded-[22px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.08),transparent_40%),linear-gradient(180deg,rgba(12,17,27,0.94),rgba(9,12,18,0.82))] p-3 shadow-[0_18px_34px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">{bodies.has(body.id) ? bodies(body.id) : body.name}</p>
              <span className="h-2.5 w-2.5 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.8)]" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-foreground/55">{t('type')}: {t(`types.${body.type}`)}</p>
          </div>

          <dl className="mt-4 space-y-2.5 text-sm">
            {FIELDS.map((field) => {
              const q = body[field];
              const href = q ? sourceHref(q.source) : null;
              return (
                <div key={field} className="rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.9),rgba(9,12,18,0.76))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">{t(`fields.${field}`)}</dt>
                  {q ? (
                    <dd className="mt-1.5">
                      <span className="font-mono text-foreground/90">{formatValue(q)}</span>
                      <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${PROVENANCE_STYLE[q.provenance]}`}>{t(`prov.${q.provenance}`)}</span>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className={`mt-1 block truncate text-[10px] text-foreground/45 underline hover:text-accent-cyan ${focusRing()}`}>
                          {t('source')}
                        </a>
                      ) : null}
                    </dd>
                  ) : (
                    <dd className="mt-1.5 font-mono text-foreground/35">— <span className="font-sans text-[10px]">{t('noData')}</span></dd>
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
