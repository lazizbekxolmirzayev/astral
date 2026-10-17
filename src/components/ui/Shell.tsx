import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { UniverseViewport } from '../3d/UniverseViewport';
import { DiagnosticsPanel } from './DiagnosticsPanel';
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-panel-border px-4">
        <span className="text-sm font-semibold tracking-wide">
          {t('app.title')}
        </span>
        <span className="text-xs text-foreground/50">{t('app.tagline')}</span>
        <Link href="/gallery" className="text-xs text-foreground/60 transition-colors hover:text-accent-cyan">
          {t('sharing.nav')}
        </Link>
        <Link href="/sandbox" className="text-xs text-foreground/60 transition-colors hover:text-accent-cyan">
          {t('sandbox.nav')}
        </Link>
        <Link href="/saved" className="ml-auto text-xs text-foreground/60 transition-colors hover:text-accent-cyan">
          {t('saved.nav')}
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[22%] min-w-[176px] max-w-64 shrink-0 flex-col border-r border-panel-border">
          <h2 className="px-4 py-3 text-xs uppercase tracking-widest text-foreground/60">
            {t('sidebar.title')}
          </h2>
          <p className="px-4 text-sm text-foreground/40">{t('sidebar.empty')}</p>

          {/* Scrolls on its own so a long body table cannot push Settings off
              screen; Settings stays pinned at the bottom. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DiagnosticsPanel />
          </div>

          <div className="shrink-0 border-t border-panel-border">
            <SettingsPanel />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <section
            aria-label={t('viewport.title')}
            className="flex min-h-0 flex-1 flex-col"
          >
            <UniverseViewport />
          </section>
          <section
            aria-label={t('toolbar.title')}
            className="shrink-0 border-t border-panel-border px-4 py-2"
          >
            <TimeControls />
          </section>
        </main>

        <aside className="w-[24%] min-w-[208px] max-w-72 shrink-0 border-l border-panel-border">
          <h2 className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest text-foreground/60">
            {t('inspector.title')}
            <span className="ml-auto rounded-full border border-panel-border px-2 py-0.5 font-mono text-[10px] normal-case tracking-normal text-star-gold">
              {t('common.comingSoon')}
            </span>
          </h2>
          <dl className="space-y-2 px-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-foreground/50">{t('inspector.property')}</dt>
              <dd className="font-mono text-foreground/40">—</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-foreground/50">{t('inspector.value')}</dt>
              <dd className="font-mono text-foreground/40">—</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-foreground/50">{t('inspector.provenance')}</dt>
              <dd className="font-mono text-foreground/40">—</dd>
            </div>
          </dl>
          <p className="mt-3 px-4 text-sm text-foreground/40">
            {t('inspector.noSelection')}
          </p>
        </aside>
      </div>
    </div>
  );
}
