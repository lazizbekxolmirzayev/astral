'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSelectionStore } from '@/stores/selectionStore';
import { TIME_SPEEDS, useTimeStore } from '@/stores/timeStore';
import { focusRing } from './FocusRing';
import { useRadiogroup } from './useRadiogroup';
import { FUTURE_MILESTONES, useFutureStore, type FutureYear } from '@/stores/futureStore';

/**
 * Playback controls for `simulationClock`. Local component state is not used
 * for the clock itself, so clicking these only re-renders this panel.
 */
export function TimeControls() {
  const t = useTranslations('toolbar');
  const playing = useTimeStore((state) => state.playing);
  const speed = useTimeStore((state) => state.speed);
  const togglePlaying = useTimeStore((state) => state.togglePlaying);
  const setSpeed = useTimeStore((state) => state.setSpeed);
  const resetClock = useTimeStore((state) => state.reset);
  const select = useSelectionStore((state) => state.select);
  const requestViewReset = useSelectionStore((state) => state.requestViewReset);
  const futureYears = useFutureStore((state) => state.yearsFromNow);
  const setFutureYears = useFutureStore((state) => state.setYearsFromNow);
  const future = useTranslations('future');
  const selectedFuture = FUTURE_MILESTONES.indexOf(futureYears);
  const futureLabel = future(`milestones.${selectedFuture}`);
  const futureStatus = selectedFuture < 3 ? future('early') : selectedFuture < 5 ? future('brightening') : selectedFuture < 6 ? future('redGiant') : future('earthRisk');

  const speedOptions = TIME_SPEEDS.map((s) => String(s));
  const { optionProps } = useRadiogroup({
    value: String(speed),
    options: speedOptions,
    onChange: (next) => setSpeed(Number(next) as (typeof TIME_SPEEDS)[number]),
  });

  /** Reset means "back to the start": clock, selection and camera together. */
  function reset() {
    resetClock();
    setFutureYears(0);
    select(null);
    requestViewReset();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2 rounded-full border border-panel-border bg-white/[0.02] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
        <span className="inline-flex h-2 w-2 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.9)]" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/60">{t('speed')}</span>
      </div>

      <button
        type="button"
        onClick={togglePlaying}
        aria-pressed={!playing}
        className={`flex items-center gap-1.5 rounded-full border border-panel-border bg-background/50 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan ${focusRing()}`}
      >
        {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
        {playing ? t('pause') : t('play')}
      </button>

      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label={t('speed')}
          className="flex gap-1 rounded-full border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.9),rgba(9,12,18,0.75))] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
        >
          {TIME_SPEEDS.map((option, index) => {
            const isActive = option === speed;
            return (
              <button
                key={option}
                type="button"
                {...optionProps(String(option), index)}
                className={`rounded-full px-2.5 py-1 font-mono text-xs transition-all ${
                  isActive
                    ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_16px_rgba(0,240,255,0.18)]'
                    : 'text-foreground/75 hover:bg-panel-border hover:text-foreground'
                } ${focusRing()}`}
              >
                {option}×
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className={`flex items-center gap-1.5 rounded-full border border-panel-border bg-background/50 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan ${focusRing()}`}
      >
        <RotateCcw size={13} aria-hidden />
        {t('reset')}
      </button>

      <p className="ml-auto text-[11px] uppercase tracking-[0.18em] text-foreground/60">{t('timeNote')}</p>
      <div className="basis-full rounded-[20px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(100,73,20,0.1),rgba(26,17,8,0.04))] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,202,96,0.04)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">{future('title')}</span>
          <label htmlFor="future-time" className="text-xs text-foreground/75">{future('fromNow')}: <strong className="font-mono text-amber-100">{futureLabel}</strong></label>
          <span className="text-xs text-foreground/55">{futureStatus}</span>
        </div>
        <input id="future-time" type="range" min={0} max={FUTURE_MILESTONES.length - 1} step={1} value={selectedFuture} onChange={(event) => setFutureYears(FUTURE_MILESTONES[Number(event.target.value)] as FutureYear)} aria-label={future('title')} className="mt-1 w-full accent-amber-300" />
        <p className="text-[10px] leading-relaxed text-foreground/50">{selectedFuture < 3 ? future('moonNote') : future('modelNote')}</p>
      </div>
    </div>
  );
}
