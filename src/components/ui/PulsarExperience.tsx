'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Radio, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSelectionStore } from '@/stores/selectionStore';

const PULSARS = {
  'vela-pulsar': { name: 'Vela Pulsar', hz: 11.2, periodMs: 89, media: 'https://chandra.si.edu/photo/2024/ar/ar_vela_composite.mp4', kind: 'video' },
  'crab-pulsar': { name: 'Crab Pulsar', hz: 30.2, periodMs: 33, media: 'https://chandra.si.edu/sound/sounds/audio/crab_chandra_nustar.mp3', kind: 'audio' },
} as const;

export function getPulsarPlaybackAction({ playing, kind, videoOpen }: { playing: boolean; kind: 'audio' | 'video'; videoOpen: boolean }) {
  if (playing) return { action: 'pause' as const, openVideo: false };
  if (kind === 'video') return { action: 'play-video' as const, openVideo: true };
  return { action: 'play-audio' as const, openVideo: videoOpen };
}

function startPulsarSynth(hz: number, periodMs: number) {
  if (typeof window === 'undefined') return null;

  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  const context = new AudioCtor();
  const startAt = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const baseFrequency = 180 + hz * 18;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(baseFrequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.14, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + 0.14);

  return {
    context,
    interval: window.setInterval(() => {
      const innerContext = context;
      const innerStart = innerContext.currentTime;
      const innerOscillator = innerContext.createOscillator();
      const innerGain = innerContext.createGain();
      innerOscillator.type = 'triangle';
      innerOscillator.frequency.setValueAtTime(baseFrequency + (Math.random() - 0.5) * 40, innerStart);
      innerGain.gain.setValueAtTime(0.0001, innerStart);
      innerGain.gain.exponentialRampToValueAtTime(0.12, innerStart + 0.008);
      innerGain.gain.exponentialRampToValueAtTime(0.0001, innerStart + 0.12);
      innerOscillator.connect(innerGain);
      innerGain.connect(innerContext.destination);
      innerOscillator.start(innerStart);
      innerOscillator.stop(innerStart + 0.13);
    }, Math.max(80, periodMs)),
  };
}

function PulseTrace({ hz, active }: { hz: number; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let frame = 0;
    let request = 0;
    const draw = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(74, 221, 255, 0.1)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 30) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 22) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.beginPath();
      context.lineWidth = 2.2;
      context.strokeStyle = active ? '#8bf1ff' : '#4d91a2';
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = active ? 11 : 2;
      for (let x = 0; x <= width; x += 1) {
        const phase = ((x / width) * 7 - frame * 0.018) % 1;
        const pulse = Math.exp(-Math.pow((((phase + 1) % 1) - 0.18) / 0.04, 2));
        const y = height / 2 + Math.sin(x * 0.04 - frame * 0.05) * 1.7 - pulse * height * 0.37;
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      context.shadowBlur = 0;
      if (active) { frame += 1; request = requestAnimationFrame(draw); }
    };
    draw();
    return () => cancelAnimationFrame(request);
  }, [active]);

  return <canvas ref={canvasRef} width={900} height={96} className="h-[66px] w-full rounded-lg sm:h-[74px]" aria-label={`${hz} Hz pulse cadence illustration`} />;
}

export function PulsarExperience() {
  const t = useTranslations('pulsar');
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const media = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const synthRef = useRef<{ context: AudioContext; interval: number } | null>(null);
  const selected = selectedId && selectedId in PULSARS ? PULSARS[selectedId as keyof typeof PULSARS] : null;

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        window.clearInterval(synthRef.current.interval);
        void synthRef.current.context.close();
        synthRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!media.current) return;
    if (playing) {
      void media.current.play().catch(() => setPlaying(false));
      return;
    }
    media.current.pause();
  }, [playing, selectedId]);

  useEffect(() => {
    if (!selected || selected.kind !== 'audio') return;
    if (!playing) {
      if (synthRef.current) {
        window.clearInterval(synthRef.current.interval);
        void synthRef.current.context.close();
        synthRef.current = null;
      }
      return;
    }
    if (synthRef.current) return;
    const synth = startPulsarSynth(selected.hz, selected.periodMs);
    if (synth) synthRef.current = synth;
  }, [playing, selected]);

  useEffect(() => { media.current?.pause(); setPlaying(false); setVideoOpen(false); }, [selectedId]);
  if (!selected) return null;

  function toggleAudio() {
    if (!selected) return;
    const action = getPulsarPlaybackAction({ playing, kind: selected.kind, videoOpen });
    if (action.action === 'pause') {
      if (selected.kind === 'audio') {
        if (synthRef.current) {
          window.clearInterval(synthRef.current.interval);
          void synthRef.current.context.close();
          synthRef.current = null;
        }
      }
      media.current?.pause();
      setPlaying(false);
      return;
    }
    if (selected.kind === 'video') {
      setVideoOpen(action.openVideo);
    }
    setPlaying(true);
  }

  return (
    <section className="pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[min(52rem,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[24px] border border-cyan-200/25 bg-[radial-gradient(ellipse_at_top_right,rgba(54,191,255,0.16),transparent_34%),linear-gradient(145deg,rgba(7,18,30,0.98),rgba(5,9,18,0.97))] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-4" aria-label={t('title')}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-200/10 shadow-[0_0_22px_rgba(62,219,255,0.15)]"><Radio size={15} className="text-cyan-100" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold tracking-wide text-cyan-50">{selected.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/15 bg-cyan-100/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-cyan-100/80"><span className={`h-1.5 w-1.5 rounded-full ${playing ? 'animate-pulse bg-emerald-300 shadow-[0_0_8px_#6ee7b7]' : 'bg-slate-500'}`} />{playing ? t('active') : t('standby')}</span>
          </div>
          <p className="mt-0.5 text-[9px] leading-relaxed text-slate-300/55">{t('caption')}</p>
        </div>
        <button type="button" onClick={toggleAudio} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-200/25 bg-[linear-gradient(180deg,rgba(65,201,240,0.2),rgba(30,120,160,0.12))] px-3 py-2 text-[10px] font-medium text-cyan-50 shadow-[0_0_18px_rgba(53,204,255,0.08)] transition hover:border-cyan-100/45 hover:bg-cyan-300/20" aria-pressed={playing}>
          {playing ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}{playing ? t('pause') : t('listen')}
        </button>
        {selected.kind === 'video' ? <button type="button" onClick={() => setVideoOpen((value) => { if (value) { media.current?.pause(); setPlaying(false); } return !value; })} className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-slate-200/75 transition hover:border-white/20 hover:text-white sm:block">{videoOpen ? t('hideVideo') : t('nasaVideo')}</button> : null}
        <button type="button" onClick={() => select(null)} className="rounded-full p-1.5 text-foreground/50 transition hover:bg-white/5 hover:text-foreground" aria-label={t('close')}><X size={14} aria-hidden /></button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2"><span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('pulseRate')}</span><span className="mt-1 block font-mono text-sm text-cyan-100">{selected.hz} <span className="text-[9px] text-cyan-100/55">Hz</span></span></div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2"><span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('period')}</span><span className="mt-1 block font-mono text-sm text-violet-100">{selected.periodMs} <span className="text-[9px] text-violet-100/55">ms</span></span></div>
        <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 sm:col-span-1 sm:flex-col sm:items-start sm:justify-center"><span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('trace')}</span><span className="font-mono text-[10px] text-slate-200/75">{t('traceNote')}</span></div>
      </div>
      <div className="mt-2 rounded-xl border border-cyan-200/10 bg-[#030a12]/85 p-1.5 shadow-[inset_0_0_22px_rgba(45,160,190,0.07)]"><PulseTrace hz={selected.hz} active={playing} /></div>
      <div className="mt-1 flex justify-between px-1 font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/40"><span>{t('radioSignal')}</span><span>{t('sonified')}</span></div>
      {selected.kind === 'video' ? <video ref={media as React.RefObject<HTMLVideoElement>} title={t('nasaVideo')} src={selected.media} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className={`mt-2 max-h-[28rem] w-full rounded-xl border border-cyan-100/10 bg-black ${videoOpen ? '' : 'hidden'}`} /> : <div className="mt-2 rounded-xl border border-cyan-100/10 bg-cyan-400/5 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/80">{playing ? 'Synth pulse audio active' : 'Pulse audio ready'}</div>}
    </section>
  );
}
