'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FEATURED_EXPERIMENTS, FEATURED_FILTERS, type FeaturedFilter } from '@/data/featured';
import { getCatalogEntry } from '@/data/catalog/entries';
import { FeaturedThumb } from './FeaturedThumb';

export function FeaturedGrid() {
  const t = useTranslations('gallery');
  const [filter, setFilter] = useState<FeaturedFilter>('all');
  const items = FEATURED_EXPERIMENTS.filter((item) => filter === 'all' || item.tags.includes(filter));

  return (
    <section aria-labelledby="featured-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="featured-title" className="text-lg font-semibold">{t('featuredTitle')}</h2>
          <p className="text-sm text-foreground/55">{t('featuredHint')}</p>
        </div>
        <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-1.5">
          {FEATURED_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${filter === f ? 'border-accent-cyan/70 bg-accent-cyan/15 text-accent-cyan' : 'border-panel-border text-foreground/60 hover:border-accent-cyan/40'}`}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const entry = item.catalogId ? getCatalogEntry(item.catalogId) : undefined;
          const title = entry ? entry.name : t(`items.${item.id}.title`);
          return (
            <li key={item.id} className="group overflow-hidden rounded-xl border border-panel-border bg-background/60 transition-colors hover:border-accent-cyan/50">
              <Link href={item.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan">
                <div className="aspect-[2/1] overflow-hidden border-b border-panel-border">
                  <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
                    <FeaturedThumb kind={item.kind} seed={item.id} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold group-hover:text-accent-cyan">{title}</h3>
                    <span className="shrink-0 rounded bg-accent-cyan/15 px-2 py-0.5 text-[11px] text-accent-cyan">{t('run')} →</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/65">{t(`items.${item.id}.body`)}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => <li key={tag} className="rounded border border-panel-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/45">{t(`filters.${tag}`)}</li>)}
                  </ul>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
