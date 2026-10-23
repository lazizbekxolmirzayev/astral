'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import type { CatalogEntry, CatalogQuantity } from '@/data/catalog/types';
import { catalogScenario } from '@/lib/sandboxSimulation';

const FIELDS = [
  'massSolar', 'massEarth', 'massKg', 'radiusSolar', 'radiusKm', 'diameterM', 'densityKgM3', 'temperatureK',
  'distanceLy', 'semiMajorAxisAu', 'eccentricity', 'orbitalPeriodDays', 'impactVelocityKmS', 'energyMegatons',
] as const;

function format(q: CatalogQuantity): string {
  const abs = Math.abs(q.value);
  const n = abs !== 0 && (abs >= 1e6 || abs < 1e-3) ? q.value.toExponential(2) : String(Number(q.value.toPrecision(4)));
  return q.unit ? `${n} ${q.unit}` : n;
}

/** Details of one catalogue record: values with provenance, source, licence, and the simulator link. */
export function CatalogEntryCard({ entry, compact = false }: { entry: CatalogEntry; compact?: boolean }) {
  const t = useTranslations('catalog');
  const simulatable = catalogScenario(entry) !== null;
  return (
    <article className={compact ? 'text-sm' : 'rounded-lg border border-panel-border bg-background/50 p-5'} aria-live="polite">
      <h2 className={compact ? 'text-base font-semibold' : 'text-lg font-semibold'}>{entry.name}</h2>
      <p className="text-xs text-foreground/55">{t(`types.${entry.type}`)}{entry.classification ? ` · ${entry.classification}` : ''}</p>
      <p className="mt-3 text-sm text-foreground/75">{entry.description}</p>
      <dl className={compact ? 'mt-3 space-y-2 text-sm' : 'mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm'}>
        {FIELDS.map((field) => {
          const q = entry[field];
          if (!q) return null;
          return (
            <div key={field} className={compact ? '' : 'contents'}>
              <dt className="text-foreground/55">{t(`fields.${field}`)}</dt>
              <dd>
                <span className="font-mono">{format(q)}</span>
                <span className="ml-2 rounded-full border border-star-gold/50 px-1.5 py-0.5 text-[10px] text-star-gold">{t(`provenance.${q.provenance}`)}</span>
                {q.note ? <span className="ml-2 block text-[11px] text-foreground/50">{q.note}</span> : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-4 text-[11px] text-foreground/50">
        {t('sourceLabel')}: <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all underline hover:text-accent-cyan">{entry.sourceUrl}</a> · {t('licenseLabel')}: {entry.license}
      </p>
      <div className="mt-4 border-t border-panel-border pt-4">
        {simulatable ? (
          <>
            <Link href={`/sandbox?catalog=${encodeURIComponent(entry.id)}`} className={`inline-flex rounded bg-accent-cyan/20 px-4 py-2 text-sm text-accent-cyan hover:bg-accent-cyan/30 ${focusRing()}`}>
              {t('openInSimulator')}
            </Link>
            <p className="mt-2 text-xs text-foreground/55">{t(`opensIn.${entry.type}`)}</p>
          </>
        ) : (
          <p className="text-xs text-foreground/55">{t('viewOnly')}</p>
        )}
      </div>
    </article>
  );
}
