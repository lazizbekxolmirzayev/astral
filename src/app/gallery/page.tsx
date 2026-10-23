import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppProviders } from '@/components/ui/AppProviders';
import { SiteNav } from '@/components/ui/SiteNav';
import { FeaturedGrid } from '@/components/gallery/FeaturedGrid';
import { listPublicExperiments } from '@/lib/server/experiment-sharing';

type Props = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadCommunity(q: string, page: number) {
  try {
    return { ok: true as const, ...(await listPublicExperiments(q, page, 12)) };
  } catch {
    // No database configured or unreachable: the built-in gallery still works.
    return { ok: false as const, items: [], pages: 0 };
  }
}

export default async function PublicGalleryPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (single(params.q) ?? '').slice(0, 100);
  const rawPage = Number(single(params.page) ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await loadCommunity(q, page);
  const t = await getTranslations('sharing');
  const g = await getTranslations('gallery');
  const locale = await getLocale();

  return (
    <AppProviders>
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-foreground sm:px-6">
        <header className="mb-8 rounded-2xl border border-panel-border bg-gradient-to-br from-nebula-purple/15 via-transparent to-accent-cyan/10 p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-cyan">NEXUS · {g('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold">{g('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/65">{g('subtitle')}</p>
        </header>

        <FeaturedGrid />

        <section className="mt-12" aria-labelledby="community-title">
          <h2 id="community-title" className="text-lg font-semibold">{g('communityTitle')}</h2>
          <p className="mb-4 text-sm text-foreground/55">{t('subtitle')}</p>

          <form action="/gallery" className="mb-5 flex gap-2">
            <label className="sr-only" htmlFor="gallery-query">{t('searchLabel')}</label>
            <input id="gallery-query" name="q" defaultValue={q} maxLength={100} placeholder={t('searchPlaceholder')} className="min-w-0 flex-1 rounded-md border border-panel-border bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent-cyan/60" />
            <button className="rounded-md border border-panel-border px-4 py-2 text-sm hover:border-accent-cyan/60">{t('search')}</button>
          </form>

          {!result.ok ? (
            <p className="rounded-lg border border-star-gold/30 bg-star-gold/5 p-6 text-center text-sm text-star-gold">{g('communityOffline')}</p>
          ) : result.items.length === 0 ? (
            <p className="rounded-lg border border-panel-border p-8 text-center text-sm text-foreground/55">{g('communityEmpty')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-panel-border bg-background/60 p-4 transition-colors hover:border-accent-cyan/40">
                  <Link href={`/e/${item.shareToken}`} className="text-base font-medium hover:text-accent-cyan">{item.title}</Link>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-foreground/65">{item.description}</p>
                  <time className="mt-3 block text-xs text-foreground/40" dateTime={item.createdAt}>{t('galleryDate', { date: new Intl.DateTimeFormat(locale).format(new Date(item.createdAt)) })}</time>
                </li>
              ))}
            </ul>
          )}

          {result.ok && (
            <nav aria-label="Gallery pages" className="mt-6 flex items-center justify-between text-sm">
              {page > 1 ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page - 1) })}`} className="text-accent-cyan hover:underline">{t('previous')}</Link> : <span />}
              <span className="text-foreground/50">{t('page', { page, pages: Math.max(result.pages, 1) })}</span>
              {page < result.pages ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page + 1) })}`} className="text-accent-cyan hover:underline">{t('next')}</Link> : <span />}
            </nav>
          )}
        </section>
      </main>
    </AppProviders>
  );
}
