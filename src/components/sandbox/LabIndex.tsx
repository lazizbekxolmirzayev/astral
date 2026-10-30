'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import { FeaturedThumb } from '@/components/gallery/FeaturedThumb';
import type { ThumbKind } from '@/data/featured';

const LABS: Array<{ id: string; href: string; thumb: ThumbKind }> = [
  { id: 'star-replacement', href: '/sandbox?preset=star-replacement', thumb: 'star' },
  { id: 'impact', href: '/sandbox?preset=asteroid-impact', thumb: 'impact' },
  { id: 'black-hole', href: '/sandbox?preset=black-hole', thumb: 'blackhole' },
  { id: 'sandbox', href: '/sandbox?preset=empty-space', thumb: 'orbit' },
];

const SYSTEM_PILLS = ['Gravity', 'Orbital paths', 'Planetary systems', 'Impact tests'];

export function LabIndex() {
  const t = useTranslations('lab');

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <header className="relative overflow-hidden rounded-[30px] border border-panel-border bg-[radial-gradient(circle_at_15%_20%,rgba(0,240,255,0.26),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(108,92,231,0.2),transparent_28%),linear-gradient(135deg,rgba(12,17,27,0.98),rgba(8,12,18,0.92))] p-6 shadow-[0_32px_120px_rgba(3,6,14,0.9)] sm:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_30%,transparent_58%)]" />
        <div className="absolute -right-10 top-4 h-40 w-40 rounded-full border border-accent-cyan/20 bg-accent-cyan/5 blur-3xl" />
        <div className="absolute left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full border border-accent-cyan/20" style={{ transform: 'translateY(-50%) rotate(28deg)' }} />

        <div className="relative">
          <Link href="/universe" className="inline-flex text-xs font-medium uppercase tracking-[0.18em] text-foreground/60 transition-colors hover:text-accent-cyan">{t('back')}</Link>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-cyan">Lab</span>
            <span className="inline-flex rounded-full border border-panel-border bg-white/3 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/60">Solar System</span>
            <span className="inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200">Omniverse</span>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
              <p className="mt-3 max-w-2xl text-sm text-foreground/70 sm:text-base">{t('subtitle')}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SYSTEM_PILLS.map((pill) => (
                <span key={pill} className="rounded-full border border-panel-border bg-background/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground/65">
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <ul className="grid gap-5 sm:grid-cols-2">
        {LABS.map((lab, index) => (
          <li
            key={lab.id}
            className="group relative overflow-hidden rounded-[24px] border border-panel-border bg-background/45 shadow-[0_14px_40px_rgba(3,7,18,0.48)] transition-all duration-300 hover:-translate-y-1 hover:border-accent-cyan/60 hover:shadow-[0_26px_60px_rgba(0,240,255,0.12)]"
          >
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-accent-cyan/10 via-transparent to-nebula-purple/10 opacity-80" />
            <div className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-accent-cyan/20 bg-background/60 text-[10px] font-semibold text-accent-cyan shadow-[0_0_18px_rgba(0,240,255,0.3)]">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="relative aspect-[2/1] overflow-hidden border-b border-panel-border bg-slate-950/90">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,240,255,0.22),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(108,92,231,0.18),transparent_28%)]" />
              <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.18)_0,transparent_1px)] [background-size:18px_18px]" />
              <FeaturedThumb kind={lab.thumb} seed={`lab-${lab.id}`} />
            </div>

            <div className="relative p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/60">
                  <span className="h-2 w-2 rounded-full bg-accent-cyan shadow-[0_0_14px_rgba(0,240,255,0.9)]" />
                  Orbit Lab
                </span>
              </div>

              <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{t(`labs.${lab.id}.title`)}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground/65">{t(`labs.${lab.id}.body`)}</p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-star-gold">{t(`labs.${lab.id}.limit`)}</p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link href={lab.href} className={`inline-flex items-center justify-center rounded-full bg-accent-cyan/15 px-4 py-2 font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/25 ${focusRing()}`}>
                  {t('open')}
                </Link>
                <Link href="/catalog" className={`inline-flex items-center justify-center rounded-full border border-panel-border bg-white/2 px-4 py-2 text-foreground/80 transition-colors hover:border-accent-cyan/50 hover:text-accent-cyan ${focusRing()}`}>
                  {t('fromCatalog')}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
