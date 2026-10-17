import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getShareableExperiment } from '@/lib/server/experiment-sharing';
import { ReportButton } from './ReportButton';

export const runtime = 'nodejs';

export default async function SharedExperimentPage({ params }: PageProps<'/e/[shareToken]'>) {
  const { shareToken } = await params;
  const experiment = await getShareableExperiment(shareToken);
  if (!experiment) notFound();
  const t = await getTranslations('sharing');

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 text-foreground">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent-cyan">{t('sharedEyebrow')}</p>
          <h1 className="mt-2 break-words text-2xl font-semibold">{experiment.title}</h1>
          <p className="mt-1 text-xs text-foreground/45">{experiment.visibility === 'unlisted' ? t('unlisted') : t('public')}</p>
        </div>
        <Link href="/gallery" className="shrink-0 text-sm text-accent-cyan hover:underline">{t('nav')}</Link>
      </header>

      <p className="mb-6 whitespace-pre-wrap break-words text-sm text-foreground/70">{experiment.description}</p>
      <section className="rounded-lg border border-panel-border bg-background/60 p-4">
        <h2 className="text-sm font-semibold">{t('restored', { name: experiment.scenario.name })}</h2>
        <p className="mt-1 text-xs text-foreground/50">{t('objectCount', { count: experiment.scenario.objects.length })}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {experiment.scenario.objects.map((object) => (
            <li key={object.id} className="rounded border border-panel-border/70 px-3 py-2 text-sm">
              <span className="font-medium">{object.name}</span>
              <span className="ml-2 text-xs text-foreground/45">{object.type}</span>
              {object.description ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground/55">{object.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <footer className="mt-6 flex justify-end">
        <ReportButton shareToken={shareToken} />
      </footer>
    </main>
  );
}
