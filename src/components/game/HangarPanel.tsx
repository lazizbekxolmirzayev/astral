'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { addPart, BATTERIES, BUSES, COMMS, INSTRUMENTS, LAUNCHERS, pickText, PROPULSION, removePart, setBus, setPropulsion, SOLAR_ARRAYS, toBase, type Mission, type Part } from '@/mission';
import type { ResourceKey } from '@/mission';
import { gameStore, type HangarView } from '@/game/gameStore';
import { formatBitRate, formatMoney, formatNumber } from '@/game/format';
import { useStore } from 'zustand';
import { useEditor, useEvaluation } from '../mission/hooks';
import { CrewSetup } from './CrewPanel';

type Category = 'platform' | 'power' | 'comms' | 'payload';
const CATEGORIES: Category[] = ['platform', 'power', 'comms', 'payload'];

const STATUS_COLOR = { ok: '#34d399', tight: '#fbbf24', over: '#f87171' } as const;

function Gauge({ label, used, limit, status, text }: { label: string; used: number; limit: number | null; status: 'ok' | 'tight' | 'over'; text: string }) {
  const fraction = limit && limit > 0 ? Math.min(1.15, used / limit) : 0;
  return (
    <div data-gauge={label}>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="uppercase tracking-[0.16em] text-white/60">{label}</span>
        <span className="font-medium text-white/90">{text}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, fraction * 100)}%`, background: STATUS_COLOR[status], boxShadow: `0 0 10px ${STATUS_COLOR[status]}` }} />
      </div>
    </div>
  );
}

function PartCard({ part, count, fits, onAdd, onRemove, locale, labels }: { part: Part; count: number; fits: boolean; onAdd: () => void; onRemove: () => void; locale: string; labels: { add: string; remove: string; other: string } }) {
  const name = pickText(part.name, locale);
  return (
    <div className={`rounded-xl border p-2.5 transition ${count > 0 ? 'border-cyan-300/45 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03]'} ${fits ? '' : 'opacity-60'}`} data-part={part.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{name}</p>
          <p className="mt-0.5 text-[11px] text-white/50">{formatNumber(toBase(part.mass), locale, 1)} kg · {formatMoney(toBase(part.cost), locale)}{fits ? '' : ` · ${labels.other}`}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label={labels.remove} disabled={count === 0} onClick={onRemove} className="h-7 w-7 rounded-lg border border-white/15 bg-white/5 text-sm text-white/80 transition hover:border-white/40 disabled:opacity-30">−</button>
          <span className="w-5 text-center text-sm tabular-nums text-cyan-100" data-count>{count}</span>
          <button type="button" aria-label={labels.add} onClick={onAdd} className="h-7 w-7 rounded-lg border border-cyan-300/40 bg-cyan-400/15 text-sm text-cyan-50 transition hover:bg-cyan-400/30">+</button>
        </div>
      </div>
    </div>
  );
}

/** The hangar's panels: the parts bay on the left, the live mission status and the launch button on the right. */
export function HangarPanel({ mission, view, onLaunch }: { mission: Mission; view: HangarView; onLaunch: () => void }) {
  const t = useTranslations('game.hangar');
  const tc = useTranslations('game.crew');
  const locale = useLocale();
  const evaluation = useEvaluation(mission);
  const { apply, error } = useEditor(mission.id);
  const [category, setCategory] = useState<Category>('platform');
  const abortNotice = useStore(gameStore, (state) => state.abortNotice);
  const [mobile, setMobile] = useState<'parts' | 'rockets' | 'status'>('parts');

  const destinationId = mission.objective.destinationId;
  const installed = (id: string) => mission.spacecraft.parts.find((line) => line.itemId === id)?.quantity ?? 0;
  const labelsOf = (part: Part) => ({ add: t('add', { name: pickText(part.name, locale) }), remove: t('remove', { name: pickText(part.name, locale) }), other: t('otherDestination') });
  const partList = (parts: readonly Part[]) =>
    parts.map((part) => (
      <PartCard key={part.id} part={part} count={installed(part.id)} fits={part.category !== 'instrument' || part.destinations.includes(destinationId)} onAdd={() => apply((current) => addPart(current, part.id))} onRemove={() => apply((current) => removePart(current, part.id))} locale={locale} labels={labelsOf(part)} />
    ));

  const launcher = LAUNCHERS.find((entry) => entry.id === mission.launch.vehicleId);
  const resources = evaluation.resources;
  const fails = evaluation.readiness.groups.flatMap((group) => group.checks).filter((check) => check.status === 'fail');
  const warnings = evaluation.readiness.counts.warning;
  const ready = evaluation.readiness.launchReady && evaluation.status !== 'unresolvable';

  const gauge = (key: ResourceKey, label: string, format: (value: number) => string) => {
    const line = resources?.[key];
    if (!line) return null;
    return <Gauge key={key} label={label} used={line.used} limit={line.limit} status={line.status} text={key === 'comms' && line.used === 0 && line.limit !== null ? t('gaugeIdle', { limit: format(line.limit) }) : line.limit === null ? `${format(line.used)} · ${t('noLimit')}` : t('gaugeOf', { used: format(line.used), limit: format(line.limit) })} />;
  };

  return (
    <>
      {/* mobile switch between the bay and the status */}
      <div className="absolute left-1/2 top-[68px] z-30 flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-black/50 p-1 backdrop-blur-md lg:hidden">
        {(['parts', 'rockets', 'status'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMobile(id);
              gameStore.getState().setHangarView(id === 'rockets' ? 'rockets' : 'ship');
            }}
            aria-pressed={mobile === id}
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${mobile === id ? 'bg-cyan-400/25 text-cyan-50' : 'text-white/60'}`}
          >
            {id === 'parts' ? t('mobileParts') : id === 'rockets' ? t('viewRockets') : t('mobileStatus')}
          </button>
        ))}
      </div>

      <div className="absolute left-3 top-[68px] z-20 hidden gap-1 lg:flex">
        <button type="button" data-action="back-to-map" onClick={() => gameStore.getState().cancelHangar()} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/75 backdrop-blur-md transition hover:border-white/40 hover:text-white">← {t('back')}</button>
        {(['ship', 'rockets'] as const).map((id) => (
          <button key={id} type="button" data-hangar-view={id} aria-pressed={view === id} onClick={() => gameStore.getState().setHangarView(id)} className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] backdrop-blur-md transition ${view === id ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-50' : 'border-white/15 bg-black/45 text-white/70 hover:text-white'}`}>{id === 'ship' ? t('viewShip') : t('viewRockets')}</button>
        ))}
      </div>

      {/* parts bay: only while looking at the ship, so the rocket bay stays in view */}
      {view === 'ship' ? <aside data-testid="parts-bay" className={`${mobile === 'parts' ? 'flex' : 'hidden'} absolute inset-x-3 bottom-3 top-[46%] z-20 flex-col rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.9),rgba(8,10,20,0.82))] p-3 backdrop-blur-md lg:top-[108px] lg:flex lg:w-[340px] lg:inset-x-auto lg:left-3 lg:bottom-3`}>
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">{t('bay')}</p>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {CATEGORIES.map((id) => (
            <button key={id} type="button" data-category={id} aria-pressed={category === id} onClick={() => setCategory(id)} className={`rounded-lg border px-1 py-1.5 text-[10px] uppercase tracking-[0.1em] transition ${category === id ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-50' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white'}`}>{t(`cat.${id}`)}</button>
          ))}
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {category === 'platform' ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{t('bus')}</p>
              {BUSES.map((bus) => (
                <button key={bus.id} type="button" data-bus={bus.id} aria-pressed={mission.spacecraft.busId === bus.id} onClick={() => apply((current) => setBus(current, bus.id))} className={`block w-full rounded-xl border p-2.5 text-left transition ${mission.spacecraft.busId === bus.id ? 'border-cyan-300/45 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'} ${bus.destinations.includes(destinationId) ? '' : 'opacity-60'}`}>
                  <p className="text-[13px] font-medium text-white">{pickText(bus.name, locale)}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{formatNumber(toBase(bus.mass), locale, 0)} kg · {formatMoney(toBase(bus.cost), locale)}{bus.destinations.includes(destinationId) ? '' : ` · ${t('otherDestination')}`}</p>
                </button>
              ))}
              <p className="pt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">{t('propulsion')}</p>
              {[null, ...PROPULSION].map((propulsion) => (
                <button key={propulsion?.id ?? 'none'} type="button" data-propulsion={propulsion?.id ?? 'none'} aria-pressed={mission.spacecraft.propulsionId === (propulsion?.id ?? null)} onClick={() => apply((current) => setPropulsion(current, propulsion?.id ?? null))} className={`block w-full rounded-xl border p-2.5 text-left transition ${mission.spacecraft.propulsionId === (propulsion?.id ?? null) ? 'border-cyan-300/45 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}>
                  <p className="text-[13px] font-medium text-white">{propulsion ? pickText(propulsion.name, locale) : t('noPropulsion')}</p>
                  {propulsion ? <p className="mt-0.5 text-[11px] text-white/50">{formatNumber(toBase(propulsion.mass), locale, 0)} kg · {formatMoney(toBase(propulsion.cost), locale)}</p> : null}
                </button>
              ))}
            </>
          ) : null}
          {category === 'power' ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{t('solar')}</p>
              {partList(SOLAR_ARRAYS)}
              <p className="pt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">{t('battery')}</p>
              {partList(BATTERIES)}
            </>
          ) : null}
          {category === 'comms' ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{t('radio')}</p>
              {partList(COMMS)}
            </>
          ) : null}
          {category === 'payload' ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{t('instruments')}</p>
              {partList([...INSTRUMENTS].sort((a, b) => Number(b.destinations.includes(destinationId)) - Number(a.destinations.includes(destinationId))))}
            </>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-2 text-[11px] text-red-300">{t('refused')}</p> : null}
      </aside> : null}

      {/* status and launch */}
      <aside data-testid="mission-status" className={`${mobile === 'parts' ? 'hidden' : 'flex'} absolute inset-x-3 bottom-3 top-[46%] z-20 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.9),rgba(8,10,20,0.82))] p-3 backdrop-blur-md lg:top-[108px] lg:flex lg:w-[320px] lg:inset-x-auto lg:right-3 lg:bottom-3`}>
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">{t('status')}</p>
        {resources ? (
          <div className="space-y-2.5">
            {gauge('mass', t('gauge.mass'), (value) => `${formatNumber(value, locale)} kg`)}
            {gauge('power', t('gauge.power'), (value) => `${formatNumber(value, locale)} W`)}
            {gauge('budget', t('gauge.budget'), (value) => formatMoney(value, locale))}
            {gauge('comms', t('gauge.comms'), (value) => formatBitRate(value, locale))}
          </div>
        ) : null}

        {launcher ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5" data-testid="rocket-card">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{t('rocket')}</p>
            <p className="mt-0.5 text-sm font-medium text-white">{pickText(launcher.name, locale)}</p>
            <p className="mt-1 text-[11px] text-white/55">{pickText(launcher.summary, locale)}</p>
            <p className="mt-1.5 text-[11px] text-cyan-100/80">{t('price', { value: formatMoney(toBase(launcher.cost), locale) })} · {t('reliability', { value: formatNumber(launcher.reliability.value * 100, locale) })}</p>
            <p className="mt-1 text-[10px] text-white/40">{t('capacityNote')}</p>
          </div>
        ) : null}

        <div className={`rounded-xl border p-2.5 ${ready ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-red-300/40 bg-red-500/10'}`} data-ready={ready}>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${ready ? 'text-emerald-200' : 'text-red-200'}`}>{ready ? t('ready') : t('blocked')}</p>
          {ready && warnings > 0 ? <p className="mt-1 text-[11px] text-amber-200/90">{t('warnings', { count: warnings })}</p> : null}
          {!ready ? (
            <ul className="mt-1.5 space-y-1.5">
              {fails.slice(0, 4).map((check) => (
                <li key={check.id} className="text-[11px] leading-snug text-white/75" data-check-fail={check.id}>
                  <span className="text-red-200">●</span> {pickText(check.reason, locale)}
                  {check.fix ? <span className="mt-0.5 block text-cyan-200/80">{t('fix')}: {pickText(check.fix, locale)}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {abortNotice ? (
          <div role="alert" data-testid="abort-notice" className="rounded-xl border border-amber-300/50 bg-amber-400/10 p-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{t('abort.title')}</p>
            <p className="mt-1 text-[11px] leading-snug text-white/75">{t('abort.body', { role: tc(`roles.${abortNotice.info.role}.name`) })}</p>
            <ul className="mt-1 space-y-1">{abortNotice.messages.slice(0, 3).map((message, index) => <li key={index} className="text-[11px] text-white/80">• {pickText(message, locale)}</li>)}</ul>
            <button type="button" data-action="dismiss-abort" onClick={() => gameStore.getState().dismissAbort()} className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200/80 hover:text-cyan-100">{t('abort.dismiss')}</button>
          </div>
        ) : null}

        <CrewSetup />

        <div className="sticky bottom-0 -mx-3 -mb-3 mt-auto rounded-b-2xl bg-[rgba(8,12,22,0.97)] px-3 pb-3 pt-2">
        <button
          type="button"
          data-action="launch"
          disabled={!ready}
          onClick={onLaunch}
          title={ready ? undefined : t('launchHint')}
          className="w-full rounded-xl border border-orange-300/70 bg-gradient-to-r from-orange-500/50 to-red-500/50 px-4 py-3.5 text-base font-bold uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(255,120,40,0.35)] transition enabled:hover:from-orange-400/70 enabled:hover:to-red-400/70 enabled:hover:shadow-[0_0_44px_rgba(255,140,60,0.6)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30 disabled:shadow-none"
        >
          {t('launch')}
        </button>
        </div>
      </aside>
    </>
  );
}
