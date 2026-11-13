'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/gameStore';
import { positionOf, replaySegments, REPLAY_SPEEDS, timeAt } from '@/game/replay';
import { simStore } from '@/stores/simStore';
import { MistakeList } from './MistakeList';
import { useSimSnapshot } from './useSimSnapshot';

/** The controls of the mission video: play and pause, speed, a timeline with the mistakes marked, and a list of them. */
export function ReplayBar() {
  const t = useTranslations('game.replay');
  const tc = useTranslations('game.crew');
  const record = useStore(gameStore, (state) => state.record);
  const speed = useStore(gameStore, (state) => state.replaySpeed);
  const { clockT, status } = useSimSnapshot();
  const [showList, setShowList] = useState(false);
  const [caption, setCaption] = useState<{ id: string; text: string; good: boolean } | null>(null);
  const lastT = useRef(0);
  const segments = useMemo(() => (record ? replaySegments(record.stages, record.endedT) : []), [record]);

  // a caption for each crew answer the video passes
  useEffect(() => {
    if (!record) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const id = window.setInterval(() => {
      const now = simStore.getState().clockT;
      const before = lastT.current;
      lastT.current = now;
      if (now < before) return;
      const passed = record.log.filter((entry) => entry.missionT > before && entry.missionT <= now);
      const entry = passed[passed.length - 1];
      if (!entry) return;
      const who = record.names[entry.player]?.trim() || tc('player', { n: entry.player + 1 });
      setCaption({ id: entry.key, text: tc(`caption.${entry.result}`, { who, role: tc(`roles.${entry.role}.name`), task: tc(`tasks.${entry.defId}.name`), points: entry.points }), good: entry.points >= 0 });
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setCaption(null), 4200);
    }, 150);
    return () => { clearInterval(id); if (hide) clearTimeout(hide); };
  }, [record, tc]);

  if (!record || segments.length === 0) return null;
  const finished = status === 'finished';
  const position = finished ? 1 : positionOf(segments, clockT);
  const seek = (p: number) => {
    lastT.current = timeAt(segments, p);
    simStore.getState().seek(lastT.current);
    if (simStore.getState().status === 'paused' && finished) simStore.getState().resume();
  };
  const markers = record.mistakes.filter((mistake) => mistake.missionT !== null);

  return (
    <>
      {caption ? <p data-testid="replay-caption" className={`pointer-events-none absolute inset-x-0 top-[34%] z-30 mx-auto w-fit max-w-[min(560px,92vw)] rounded-xl border px-4 py-2 text-center text-[13px] backdrop-blur-md ${caption.good ? 'border-emerald-300/40 bg-emerald-900/50 text-emerald-100' : 'border-red-300/40 bg-red-900/50 text-red-100'}`}>{caption.text}</p> : null}
      {showList ? (
        <div data-testid="replay-mistakes" className="absolute inset-x-3 bottom-[96px] z-40 mx-auto max-h-[42%] max-w-[480px] overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(8,12,22,0.92)] p-3 backdrop-blur-md sm:bottom-[88px]">
          <MistakeList mistakes={record.mistakes} record={record} onJump={(mistake) => { seek(positionOf(segments, mistake.missionT ?? 0)); setShowList(false); }} />
        </div>
      ) : null}
      <div data-testid="replay-bar" className="absolute inset-x-3 top-[196px] z-40 mx-auto w-auto max-w-[480px] rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.88),rgba(8,10,20,0.8))] p-2.5 backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:top-auto">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{finished ? t('finished') : t('title')}</p>
          <div className="flex items-center gap-1">
            {REPLAY_SPEEDS.map((value) => (
              <button key={value} type="button" data-action={`replay-speed-${value}`} aria-pressed={speed === value} onClick={() => gameStore.getState().setReplaySpeed(value)} className={`rounded-full border px-2 py-0.5 text-[10px] ${speed === value ? 'border-amber-300/70 bg-amber-400/20 text-amber-100' : 'border-white/15 text-white/65 hover:text-white'}`}>×{value}</button>
            ))}
          </div>
        </div>
        <div className="relative mt-2 h-4 cursor-pointer" onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); seek((event.clientX - box.left) / box.width); }} data-testid="replay-timeline" role="slider" aria-label={t('timeline')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position * 100)} tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'ArrowRight') seek(Math.min(1, position + 0.05)); if (event.key === 'ArrowLeft') seek(Math.max(0, position - 0.05)); }}>
          <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-0.5">
            {segments.map((segment) => <div key={segment.id} className="h-full flex-1 rounded-full bg-white/15" />)}
          </div>
          <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.8)]" style={{ width: `${position * 100}%` }} />
          {markers.map((mistake) => (
            <span key={mistake.id} aria-hidden className={`absolute top-0 h-4 w-0.5 -translate-x-1/2 ${mistake.severity === 'error' ? 'bg-red-400' : 'bg-amber-300'}`} style={{ left: `${positionOf(segments, mistake.missionT ?? 0) * 100}%` }} />
          ))}
          <span aria-hidden className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-200" style={{ left: `${position * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" data-action="replay-toggle" onClick={() => { const state = simStore.getState(); if (finished) { seek(0); state.resume(); } else if (state.status === 'running') state.pause(); else state.resume(); }} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/85 transition hover:border-white/40">{finished ? `↻ ${t('again')}` : status === 'running' ? `❚❚ ${t('pause')}` : `▶ ${t('play')}`}</button>
          <button type="button" data-action="show-mistakes" aria-pressed={showList} onClick={() => setShowList((value) => !value)} className="rounded-lg border border-red-300/50 bg-red-500/15 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-red-50 transition hover:bg-red-500/30">{t('mistakes', { count: record.mistakes.length })}</button>
          <button type="button" data-action="replay-exit" onClick={() => gameStore.getState().endReplay()} className="ml-auto rounded-lg border border-cyan-300/60 bg-cyan-400/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-400/35">{t('exit')}</button>
        </div>
      </div>
    </>
  );
}
