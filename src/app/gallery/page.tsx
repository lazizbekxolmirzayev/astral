import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { listPublicExperiments } from '@/lib/server/experiment-sharing';

type Props = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PublicGalleryPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (single(params.q) ?? '').slice(0, 100);
  const rawPage = Number(single(params.page) ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await listPublicExperiments(q, page, 12);
  const t = await getTranslations('sharing');
  const locale = await getLocale();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 text-foreground">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent-cyan">NEXUS</p>
          <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
        </div>
        <Link href="/" className="text-sm text-accent-cyan hover:underline">{t('back')}</Link>
      </header>

      <form action="/gallery" className="mb-6 flex gap-2">
        <label className="sr-only" htmlFor="gallery-query">{t('searchLabel')}</label>
        <input id="gallery-query" name="q" defaultValue={q} maxLength={100} placeholder={t('searchPlaceholder')} className="min-w-0 flex-1 rounded-md border border-panel-border bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent-cyan/60" />
        <button className="rounded-md border border-panel-border px-4 py-2 text-sm hover:border-accent-cyan/60">{t('search')}</button>
      </form>

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-panel-border p-8 text-center text-sm text-foreground/55">{t('noResults')}</p>
      ) : (
        <ul className="grid gap-3">
          {result.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-panel-border bg-background/60 p-4">
              <Link href={`/e/${item.shareToken}`} className="text-base font-medium hover:text-accent-cyan">{item.title}</Link>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/65">{item.description}</p>
              <time className="mt-3 block text-xs text-foreground/40" dateTime={item.createdAt}>{t('galleryDate', { date: new Intl.DateTimeFormat(locale).format(new Date(item.createdAt)) })}</time>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Gallery pages" className="mt-6 flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page - 1) })}`} className="text-accent-cyan hover:underline">{t('previous')}</Link> : <span />}
        <span className="text-foreground/50">{t('page', { page, pages: Math.max(result.pages, 1) })}</span>
        {page < result.pages ? <Link href={`/gallery?${new URLSearchParams({ q, page: String(page + 1) })}`} className="text-accent-cyan hover:underline">{t('next')}</Link> : <span />}
      </nav>
    </main>
  );
}
