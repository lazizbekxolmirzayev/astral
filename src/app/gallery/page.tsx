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
        <header className="mb-8 rounded-2xl border border-panel-border bg-gradient-to-br from-nebula-purple/15 via-transparent to-accent-cyan/10 p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-cyan">NEXUS · {g('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold">{g('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/65">{g('subtitle')}</p>
        </header>

        <FeaturedGrid />
        <Suspense fallback={<section className="mt-12 rounded-lg border border-panel-border p-6" aria-live="polite"><h2 className="text-lg font-semibold">{g('communityTitle')}</h2><p className="mt-3 text-sm text-foreground/55">{g('subtitle')}</p></section>}>
          <CommunityGallery searchParams={searchParams} />
        </Suspense>
      </main>
    </AppProviders>
  );
}
