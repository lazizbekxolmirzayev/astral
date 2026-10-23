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

const TYPES: Array<CatalogType | 'all'> = ['all', 'star', 'black_hole', 'exoplanet', 'asteroid', 'comet', 'meteorite_event', 'galaxy'];

export function CatalogBrowser() {
  const t = useTranslations('catalog');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CatalogType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => searchCatalog(catalogEntries, query, { type }), [query, type]);
  const selected: CatalogEntry | undefined = results.find((entry) => entry.id === selectedId) ?? results[0];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8">
      <header className="border-b border-panel-border pb-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs text-foreground/60 hover:text-accent-cyan">
          <ArrowLeft size={14} aria-hidden />{t('back')}
        </Link>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
      </header>

      <div role="note" className="rounded-md border border-star-gold/40 bg-star-gold/5 px-4 py-3 text-xs leading-relaxed text-star-gold">{t('unverifiedWarning')}</div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t('searchLabel')}</span>
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className={`w-full rounded-md border border-panel-border bg-background py-2 pl-9 pr-3 text-sm ${focusRing()}`}
          />
        </label>
        <label className="sr-only" htmlFor="catalog-type">{t('typeLabel')}</label>
        <select id="catalog-type" value={type} onChange={(event) => setType(event.target.value as CatalogType | 'all')} className="rounded-md border border-panel-border bg-background px-3 py-2 text-sm">
          {TYPES.map((option) => <option key={option} value={option}>{t(`types.${option}`)}</option>)}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ul aria-label={t('results')} className="max-h-[32rem] overflow-y-auto rounded-lg border border-panel-border p-1">
          {results.length === 0 ? <li className="px-3 py-4 text-sm text-foreground/50">{t('noResults')}</li> : results.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={selected?.id === entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`w-full rounded px-3 py-2 text-left ${selected?.id === entry.id ? 'bg-accent-cyan/15 text-accent-cyan' : 'hover:bg-foreground/5'} ${focusRing()}`}
              >
                <span className="block text-sm">{entry.name}</span>
                <span className="block text-[11px] text-foreground/50">{t(`types.${entry.type}`)}{entry.classification ? ` · ${entry.classification}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <CatalogEntryCard entry={selected} />
        ) : null}
      </div>
    </main>
  );
}
