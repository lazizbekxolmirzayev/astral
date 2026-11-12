'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DESTINATIONS, DESTINATION_IDS, pickText, toBase, type DestinationId } from '@/mission';
import { gameStore } from '@/game/gameStore';
import { formatNumber } from '@/game/format';

const DEST_COLOR: Record<DestinationId, string> = { leo: '#5cf2ff', sso: '#9d8bff', geo: '#ffd166', moon: '#c7d2e2', mars: '#ff8a5c', helio: '#ffb347' };

/** The map screen's text: the headline, the destination chips and the card of the focused destination. */
export function MapPanel({ focus, onBuild }: { focus: DestinationId | null; onBuild: () => void }) {
  const t = useTranslations('game.map');
  const locale = useLocale();
  const destination = focus ? DESTINATIONS.find((entry) => entry.id === focus) : undefined;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[72px] z-10 flex flex-col items-center px-4 text-center">
        <h1 className="text-balance bg-gradient-to-b from-white to-cyan-200 bg-clip-text text-2xl font-semibold uppercase tracking-[0.28em] text-transparent drop-shadow-[0_0_18px_rgba(0,240,255,0.35)] sm:text-4xl">{t('heading')}</h1>
        {!destination ? <p className="mt-2 max-w-md animate-pulse text-sm text-cyan-100/80">{t('hint')}</p> : null}
      </div>

      {destination ? (
        <aside data-testid="destination-card" className="absolute bottom-16 left-3 right-3 z-20 rounded-2xl border border-cyan-300/25 bg-[linear-gradient(160deg,rgba(8,16,28,0.88),rgba(10,12,24,0.78))] p-4 shadow-[0_0_40px_rgba(0,200,255,0.12)] backdrop-blur-md sm:bottom-20 sm:left-6 sm:right-auto sm:w-[400px]">
          <div className="flex items-start justify-between">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">{t('selected')}</p>
            <button type="button" aria-label={t('close')} onClick={() => gameStore.getState().focusDestination(null)} className="-mr-1 -mt-1 h-6 w-6 rounded-full text-sm text-white/50 transition hover:bg-white/10 hover:text-white">✕</button>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">{pickText(destination.name, locale)}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">{pickText(destination.summary, locale)}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <dt className="text-white/50">{t('cruise')}</dt>
              <dd className="mt-0.5 font-medium text-white">{toBase(destination.cruiseDuration) > 0 ? t('days', { count: formatNumber(toBase(destination.cruiseDuration) / 86_400, locale, 1) }) : t('cruiseNone')}</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <dt className="text-white/50">{t('orbit')}</dt>
              <dd className="mt-0.5 font-medium text-white">{t('orbitValue', { peri: formatNumber(destination.defaultOrbit.periapsisAltKm, locale), apo: formatNumber(destination.defaultOrbit.apoapsisAltKm, locale), inc: formatNumber(destination.defaultOrbit.inclinationDeg, locale, 1) })}</dd>
            </div>
          </dl>
          <button
            type="button"
            data-action="build-mission"
            onClick={onBuild}
            className="mt-4 w-full rounded-xl border border-cyan-300/60 bg-gradient-to-r from-cyan-500/30 to-violet-500/30 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-50 shadow-[0_0_24px_rgba(0,240,255,0.25)] transition hover:from-cyan-400/50 hover:to-violet-400/50 hover:shadow-[0_0_34px_rgba(0,240,255,0.45)]"
          >
            {t('build')} →
          </button>
        </aside>
      ) : null}

      <nav aria-label={t('heading')} className="absolute inset-x-0 bottom-3 z-20 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:bottom-6 sm:left-auto sm:right-6 sm:inset-x-auto sm:flex-wrap sm:justify-end sm:overflow-visible">
        {DESTINATION_IDS.map((id) => {
          const entry = DESTINATIONS.find((item) => item.id === id)!;
          const active = focus === id;
          return (
            <button
              key={id}
              type="button"
              data-destination={id}
              aria-pressed={active}
              aria-label={t('pick', { name: pickText(entry.name, locale) })}
              onClick={() => gameStore.getState().focusDestination(id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] backdrop-blur-sm transition ${active ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-50 shadow-[0_0_16px_rgba(0,240,255,0.35)]' : 'border-white/15 bg-black/40 text-white/70 hover:border-white/40 hover:text-white'}`}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DEST_COLOR[id], boxShadow: `0 0 8px ${DEST_COLOR[id]}` }} />
              {pickText(entry.name, locale)}
            </button>
          );
        })}
      </nav>
      <p className="pointer-events-none absolute bottom-[4.2rem] right-3 z-10 hidden text-[10px] uppercase tracking-[0.2em] text-white/35 sm:block sm:bottom-1 sm:right-6">{t('notToScale')}</p>
    </>
  );
}
