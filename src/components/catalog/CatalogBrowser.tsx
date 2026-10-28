'use client';

import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { catalogEntries } from '@/data/catalog/entries';
import type { CatalogEntry, CatalogType } from '@/data/catalog/types';
import { CatalogEntryCard } from './CatalogEntryCard';
import { searchCatalog } from '@/lib/catalog/search';
import { focusRing } from '@/components/ui/FocusRing';

const TYPES: Array<CatalogType | 'all'> = ['all', 'star', 'pulsar', 'black_hole', 'exoplanet', 'asteroid', 'comet', 'meteorite_event', 'galaxy'];

export function CatalogBrowser() {
  const t = useTranslations('catalog');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CatalogType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => searchCatalog(catalogEntries, query, { type }), [query, type]);
  const selected: CatalogEntry | undefined = results.find((entry) => entry.id === selectedId) ?? results[0];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8">
      <header className="relative overflow-hidden rounded-[28px] border border-panel-border bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.16),transparent_25%),linear-gradient(135deg,rgba(11,16,25,0.96),rgba(7,10,16,0.9))] p-5 shadow-[0_24px_80px_rgba(5,8,16,0.7)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_32%,transparent_56%)]" />
        <div className="relative">
          <Link href="/" className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-foreground/60 hover:text-accent-cyan">
            <ArrowLeft size={14} aria-hidden />{t('back')}
          </Link>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-accent-cyan">NEXUS</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('title')}</h1>
              <p className="mt-2 max-w-2xl text-sm text-foreground/60">{t('subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-200">Estimated</span>
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-violet-200">Catalog</span>
            </div>
          </div>
        </div>
      </header>

      <div role="note" className="rounded-2xl border border-star-gold/40 bg-star-gold/8 px-4 py-3 text-xs leading-relaxed text-star-gold">{t('unverifiedWarning')}</div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t('searchLabel')}</span>
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className={`w-full rounded-full border border-panel-border bg-background/60 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/35 ${focusRing()}`}
          />
        </label>
        <label className="sr-only" htmlFor="catalog-type">{t('typeLabel')}</label>
        <select id="catalog-type" value={type} onChange={(event) => setType(event.target.value as CatalogType | 'all')} className="rounded-full border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground">
          {TYPES.map((option) => <option key={option} value={option}>{t(`types.${option}`)}</option>)}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ul aria-label={t('results')} className="max-h-[32rem] overflow-y-auto rounded-[22px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,25,0.9),rgba(8,11,18,0.72))] p-2">
          {results.length === 0 ? <li className="px-3 py-4 text-sm text-foreground/50">{t('noResults')}</li> : results.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={selected?.id === entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all ${selected?.id === entry.id ? 'border-accent-cyan/40 bg-accent-cyan/12 text-accent-cyan shadow-[0_0_18px_rgba(0,240,255,0.08)]' : 'border-transparent bg-white/[0.02] text-foreground/75 hover:border-panel-border hover:bg-white/[0.04]' } ${focusRing()}`}
              >
                <span className="block text-sm font-medium">{entry.name}</span>
                <span className="mt-1 block text-[11px] text-foreground/50">{t(`types.${entry.type}`)}{entry.classification ? ` · ${entry.classification}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-[22px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.08),transparent_28%)] p-2">
          {selected ? (
            <CatalogEntryCard entry={selected} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
