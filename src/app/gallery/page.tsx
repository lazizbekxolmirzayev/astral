import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppProviders } from '@/components/ui/AppProviders';
import { SiteNav } from '@/components/ui/SiteNav';
import { FeaturedGrid } from '@/components/gallery/FeaturedGrid';
import { CommunityGallery } from '@/components/gallery/CommunityGallery';

type Props = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};

export default async function PublicGalleryPage({ searchParams }: Props) {
  const g = await getTranslations('gallery');

  return (
    <AppProviders>
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-foreground sm:px-6">
        <header className="relative mb-8 overflow-hidden rounded-[30px] border border-panel-border bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(108,92,231,0.14),transparent_28%),linear-gradient(135deg,rgba(12,17,26,0.96),rgba(9,13,18,0.9))] p-6 shadow-[0_24px_80px_rgba(5,7,14,0.7)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_28%,transparent_58%)]" />
          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-accent-cyan">NEXUS · {g('eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{g('title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/65">{g('subtitle')}</p>
          </div>
        </header>

        <FeaturedGrid />
        <Suspense fallback={<section className="mt-12 rounded-lg border border-panel-border p-6" aria-live="polite"><h2 className="text-lg font-semibold">{g('communityTitle')}</h2><p className="mt-3 text-sm text-foreground/55">{g('subtitle')}</p></section>}>
          <CommunityGallery searchParams={searchParams} />
        </Suspense>
      </main>
    </AppProviders>
  );
}
