'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UniverseViewport } from '../3d/UniverseViewport';
import { AccountMenu } from './AccountMenu';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ObjectList } from './ObjectList';
import { InspectorPanel } from './InspectorPanel';
import { SettingsPanel } from './SettingsPanel';
import { TimeControls } from './TimeControls';

/**
 * TODO(shell): the sidebar object list and the inspector property rows are
 * still placeholders; they arrive with the selection/simulation tasks. The
 * toolbar time controls and the sidebar diagnostics panel below are real and
 * wired to the time and diagnostics stores.
 */
export function Shell() {
  const t = useTranslations();
  const [panel, setPanel] = useState<'none' | 'objects' | 'inspector'>('none');

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.08),_transparent_25%),linear-gradient(180deg,#0b0e14_0%,#090d14_100%)]">
      <header className="relative shrink-0 border-b border-panel-border bg-[linear-gradient(90deg,rgba(10,14,22,0.96),rgba(12,17,28,0.88),rgba(8,11,18,0.96))] px-3 py-2 backdrop-blur-sm md:px-4 md:py-3">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-8 top-2 h-20 w-20 rounded-full border border-accent-cyan/20" />
          <div className="absolute left-16 top-2 h-20 w-20 rounded-full border border-accent-cyan/10" style={{ transform: 'rotate(18deg)' }} />
          <div className="absolute right-8 top-1 h-16 w-16 rounded-full border border-nebula-purple/20" style={{ transform: 'rotate(42deg)' }} />
        </div>

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 md:h-12 md:flex-nowrap">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent-cyan shadow-[0_0_12px_rgba(0,240,255,0.9)]" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-[0.16em] text-foreground">
              {t('app.title')}
            </span>
          </div>

          <div className="hidden items-center md:flex">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-cyan-200">Realtime</span>
          </div>

          <nav className="order-last flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 md:order-none md:ml-2 md:w-auto md:pr-2">
            <Link href="/gallery" className="shrink-0 whitespace-nowrap rounded-full border border-panel-border bg-white/2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan">
              {t('sharing.nav')}
            </Link>
            <Link href="/lab" className="shrink-0 whitespace-nowrap rounded-full border border-panel-border bg-white/2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan">
              {t('lab.nav')}
            </Link>
            <Link href="/catalog" className="shrink-0 whitespace-nowrap rounded-full border border-panel-border bg-white/2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan">
              {t('catalog.nav')}
            </Link>
            <Link href="/sandbox" className="shrink-0 whitespace-nowrap rounded-full border border-panel-border bg-white/2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan">
              {t('sandbox.nav')}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/saved" className="text-[10px] uppercase tracking-[0.16em] text-foreground/60 transition-colors hover:text-accent-cyan">
              {t('saved.nav')}
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${panel === 'objects' ? 'flex' : 'hidden'} fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] flex-col overflow-y-auto border-t border-panel-border bg-background shadow-2xl md:static md:flex md:max-h-none md:w-[22%] md:min-w-[176px] md:max-w-64 md:shrink-0 md:overflow-visible md:border-r md:border-t-0 md:shadow-none bg-[linear-gradient(180deg,rgba(10,14,22,0.9),rgba(12,17,25,0.78))]`}>
          <h2 className="px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-foreground/60">
            {t('sidebar.title')}
          </h2>
          <ObjectList />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <DiagnosticsPanel />
          </div>

          <div className="shrink-0 border-t border-panel-border bg-[#090d15]/90">
            <SettingsPanel />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.04),transparent_30%)]">
          <section
            aria-label={t('viewport.title')}
            className="flex min-h-0 flex-1 flex-col"
          >
            <UniverseViewport />
          </section>
          <div className="flex gap-2 border-t border-panel-border px-3 py-2 md:hidden">
            {(['objects', 'inspector'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-expanded={panel === id}
                onClick={() => setPanel((current) => (current === id ? 'none' : id))}
                className={`flex-1 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${panel === id ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan' : 'border-panel-border text-foreground/70'}`}
              >
                {id === 'objects' ? t('sidebar.title') : t('inspector.title')}
              </button>
            ))}
          </div>
          <section
            aria-label={t('toolbar.title')}
            className="max-h-[32dvh] shrink-0 overflow-y-auto border-t border-panel-border bg-[linear-gradient(180deg,rgba(8,11,18,0.9),rgba(12,17,25,0.96))] px-4 py-2"
          >
            <TimeControls />
          </section>
        </main>

        <InspectorPanel mobileOpen={panel === 'inspector'} />
        {panel !== 'none' ? <button type="button" aria-label="Close" onClick={() => setPanel('none')} className="fixed inset-0 z-30 bg-black/50 md:hidden" /> : null}
      </div>
    </div>
  );
}
