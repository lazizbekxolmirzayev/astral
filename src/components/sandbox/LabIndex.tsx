'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';

const LABS = [
  { id: 'star-replacement', href: '/sandbox?preset=star-replacement' },
  { id: 'impact', href: '/sandbox?preset=asteroid-impact' },
  { id: 'black-hole', href: '/sandbox?preset=black-hole' },
  { id: 'sandbox', href: '/sandbox?preset=empty-space' },
] as const;

export function LabIndex() {
  const t = useTranslations('lab');
  return (
    <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8">
      <header className="border-b border-panel-border pb-4">
        <Link href="/" className="text-xs text-foreground/60 hover:text-accent-cyan">{t('back')}</Link>
        <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LABS.map((lab) => (
          <li key={lab.id} className="rounded-lg border border-panel-border p-5">
            <h2 className="text-base font-semibold">{t(`labs.${lab.id}.title`)}</h2>
            <p className="mt-2 text-sm text-foreground/65">{t(`labs.${lab.id}.body`)}</p>
            <p className="mt-2 text-xs text-star-gold">{t(`labs.${lab.id}.limit`)}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <Link href={lab.href} className={`rounded bg-accent-cyan/20 px-3 py-1.5 text-accent-cyan ${focusRing()}`}>{t('open')}</Link>
              <Link href="/catalog" className={`rounded border border-panel-border px-3 py-1.5 ${focusRing()}`}>{t('fromCatalog')}</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
