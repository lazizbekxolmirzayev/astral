import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
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
    return { ok: false as const, items: [], pages: 0 };
  }
}

export async function CommunityGallery({ searchParams }: Props) {
  const params = await searchParams;
  const q = (single(params.q) ?? '').slice(0, 100);
  const rawPage = Number(single(params.page) ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [result, t, g, locale] = await Promise.all([
    loadCommunity(q, page),
    getTranslations('sharing'),
    getTranslations('gallery'),
    getLocale(),
  ]);

  return (
    <section className="mt-12" aria-labelledby="community-title">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="community-title" className="text-lg font-semibold">{g('communityTitle')}</h2>
          <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-violet-200">Live</span>
      </div>

      <form action="/gallery" className="mb-5 flex gap-2">
        <label className="sr-only" htmlFor="gallery-query">{t('searchLabel')}</label>
        <input id="gallery-query" name="q" defaultValue={q} maxLength={100} placeholder={t('searchPlaceholder')} className="min-w-0 flex-1 rounded-full border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/35 outline-none transition focus:border-accent-cyan/60" />
        <button className="rounded-full border border-panel-border bg-white/[0.02] px-4 py-2.5 text-sm text-foreground transition hover:border-accent-cyan/60 hover:text-accent-cyan">{t('search')}</button>
      </form>

      {!result.ok ? (
        <p className="rounded-[22px] border border-star-gold/30 bg-star-gold/8 p-6 text-center text-sm text-star-gold">{g('communityOffline')}</p>
      ) : result.items.length === 0 ? (
        <p className="rounded-[22px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.8),rgba(8,11,18,0.72))] p-8 text-center text-sm text-foreground/55">{g('communityEmpty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.id} className="rounded-[22px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.9),rgba(8,11,18,0.72))] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-cyan/40 hover:shadow-[0_16px_36px_rgba(0,240,255,0.05)]">
              <Link href={`/e/${item.shareToken}`} className="block text-base font-medium text-foreground hover:text-accent-cyan">{item.title}</Link>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-foreground/65">{item.description}</p>
              <time className="mt-3 block text-xs text-foreground/40" dateTime={item.createdAt}>{t('galleryDate', { date: new Intl.DateTimeFormat(locale).format(new Date(item.createdAt)) })}</time>
            </li>
          ))}
        </ul>
      )}

      {result.ok ? (
        <nav aria-label="Gallery pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page - 1) })}`} className="text-accent-cyan hover:underline">{t('previous')}</Link> : <span />}
          <span className="text-foreground/50">{t('page', { page, pages: Math.max(result.pages, 1) })}</span>
          {page < result.pages ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page + 1) })}`} className="text-accent-cyan hover:underline">{t('next')}</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
