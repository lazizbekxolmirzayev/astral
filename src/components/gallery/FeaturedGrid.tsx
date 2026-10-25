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
    <section aria-labelledby="featured-title" className="mb-10">
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
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition-all ${filter === f ? 'border-accent-cyan/70 bg-accent-cyan/15 text-accent-cyan shadow-[0_0_16px_rgba(0,240,255,0.08)]' : 'border-panel-border text-foreground/60 hover:border-accent-cyan/40 hover:text-foreground'}`}
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
            <li key={item.id} className="group overflow-hidden rounded-[22px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.96),rgba(8,10,16,0.82))] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-cyan/45 hover:shadow-[0_18px_40px_rgba(0,240,255,0.05)]">
              <Link href={item.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan">
                <div className="aspect-[2/1] overflow-hidden border-b border-panel-border">
                  <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
                    <FeaturedThumb kind={item.kind} seed={item.id} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold tracking-tight group-hover:text-accent-cyan">{title}</h3>
                    <span className="shrink-0 rounded-full border border-accent-cyan/40 bg-accent-cyan/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-accent-cyan">{t('run')}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/65">{t(`items.${item.id}.body`)}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => <li key={tag} className="rounded border border-panel-border bg-white/[0.02] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground/45">{t(`filters.${tag}`)}</li>)}
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
