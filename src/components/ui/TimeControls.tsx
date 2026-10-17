'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSelectionStore } from '@/stores/selectionStore';
import { TIME_SPEEDS, useTimeStore } from '@/stores/timeStore';
import { focusRing } from './FocusRing';
import { useRadiogroup } from './useRadiogroup';

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

  const speedOptions = TIME_SPEEDS.map((s) => String(s));
  const { optionProps } = useRadiogroup({
    value: String(speed),
    options: speedOptions,
    onChange: (next) => setSpeed(Number(next) as (typeof TIME_SPEEDS)[number]),
  });

  /** Reset means "back to the start": clock, selection and camera together. */
  function reset() {
    resetClock();
    select(null);
    requestViewReset();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={togglePlaying}
        aria-pressed={!playing}
        className={`flex items-center gap-1.5 rounded border border-panel-border px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-panel-border hover:text-foreground ${focusRing()}`}
      >
        {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
        {playing ? t('pause') : t('play')}
      </button>

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-foreground/75">
          {t('speed')}
        </span>
        <div
          role="radiogroup"
          aria-label={t('speed')}
          className="flex gap-1 rounded-md border border-panel-border p-1"
        >
          {TIME_SPEEDS.map((option, index) => {
            const isActive = option === speed;
            return (
              <button
                key={option}
                type="button"
                {...optionProps(String(option), index)}
                className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
                  isActive
                    ? 'bg-accent-cyan/15 text-accent-cyan'
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
        className={`flex items-center gap-1.5 rounded border border-panel-border px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-panel-border hover:text-foreground ${focusRing()}`}
      >
        <RotateCcw size={13} aria-hidden />
        {t('reset')}
      </button>

      <p className="ml-auto text-[11px] text-foreground/75">{t('timeNote')}</p>
    </div>
  );
}
