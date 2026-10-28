'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Radio, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { startPulsarAudio, type PulsarAudio } from '@/lib/pulsarAudio';
import { useSelectionStore } from '@/stores/selectionStore';

type PulsarInfo = { name: string; hz: number; periodMs: number; media: string; kind: 'audio' | 'video' };

const PULSARS: Record<string, PulsarInfo> = {
  'vela-pulsar': { name: 'Vela Pulsar', hz: 11.2, periodMs: 89, media: '', kind: 'audio' },
  'crab-pulsar': { name: 'Crab Pulsar', hz: 30.2, periodMs: 33, media: '', kind: 'audio' },
};

export function getPulsarPlaybackAction({ playing, kind, videoOpen }: { playing: boolean; kind: 'audio' | 'video'; videoOpen: boolean }) {
  if (playing) return { action: 'pause' as const, openVideo: false };
  if (kind === 'video') return { action: 'play-video' as const, openVideo: true };
  return { action: 'play-audio' as const, openVideo: videoOpen };
}

function makeCanvasSizer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  return () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { width: w, height: h, dpr };
  };
}

/** Scrolling pulse train in slow motion: the real pulses are 11–30 per second. */
function PulseTrace({ hz, active }: { hz: number; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const size = makeCanvasSizer(canvasRef);
    let frame = 0;
    let request = 0;
    const pulsesAcross = hz > 20 ? 9 : 6;
    const draw = () => {
      const dims = size();
      if (!dims) return;
      const { width, height, dpr } = dims;
      context.clearRect(0, 0, width, height);
      context.lineWidth = dpr;
      context.strokeStyle = 'rgba(74, 221, 255, 0.08)';
      for (let x = 0; x < width; x += 28 * dpr) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 20 * dpr) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      const base = height * 0.82;
      const points: Array<[number, number]> = [];
      for (let x = 0; x <= width; x += dpr) {
        const phase = ((x / width) * pulsesAcross - frame * 0.012) % 1;
        const p = (phase + 1) % 1;
        const main = Math.exp(-Math.pow((p - 0.2) / 0.035, 2));
        const inter = 0.28 * Math.exp(-Math.pow((p - 0.62) / 0.05, 2)); // interpulse
        const noise = Math.sin(x * 0.9 + frame * 0.7) * 0.012 + Math.sin(x * 0.31 - frame * 0.3) * 0.015;
        points.push([x, base - (main + inter + noise) * height * 0.68]);
      }
      context.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
      context.lineTo(width, height); context.lineTo(0, height); context.closePath();
      const fill = context.createLinearGradient(0, 0, 0, height);
      fill.addColorStop(0, active ? 'rgba(110,240,255,0.30)' : 'rgba(80,140,160,0.14)');
      fill.addColorStop(1, 'rgba(110,240,255,0)');
      context.fillStyle = fill; context.fill();
      context.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
      context.lineWidth = 2 * dpr;
      context.strokeStyle = active ? '#9ff4ff' : '#4d91a2';
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = active ? 12 * dpr : 2 * dpr;
      context.stroke();
      context.shadowBlur = 0;
      if (active) { frame += 1; request = requestAnimationFrame(draw); }
    };
    draw();
    return () => cancelAnimationFrame(request);
  }, [active, hz]);

  return <canvas ref={canvasRef} className="h-[72px] w-full rounded-lg sm:h-[84px]" aria-label={`${hz} Hz pulse cadence illustration (slow motion)`} />;
}

/** Lighthouse model: a tilted beam sweeps past the observer once per rotation. */
function LighthouseDial({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const size = makeCanvasSizer(canvasRef);
    let request = 0;
    let angle = 0;
    const draw = () => {
      const dims = size();
      if (!dims) return;
      const { width, height } = dims;
      const cx = width / 2; const cy = height / 2; const r = Math.min(width, height) * 0.36;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(120,200,230,0.18)';
      context.lineWidth = 1;
      context.beginPath(); context.arc(cx, cy, r * 1.15, 0, Math.PI * 2); context.stroke();
      // observer on the right
      const observer = 0;
      const diff = Math.abs(((angle - observer + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const hit = Math.max(0, 1 - Math.min(diff, Math.PI - diff * 0) / 0.5);
      for (const flip of [0, Math.PI]) {
        const a = angle + flip;
        const grad = context.createLinearGradient(cx, cy, cx + Math.cos(a) * r * 2, cy + Math.sin(a) * r * 2);
        grad.addColorStop(0, 'rgba(120,240,255,0.55)');
        grad.addColorStop(1, 'rgba(120,240,255,0)');
        context.fillStyle = grad;
        context.beginPath(); context.moveTo(cx, cy);
        context.arc(cx, cy, r * 2.2, a - 0.1, a + 0.1); context.closePath(); context.fill();
      }
      const core = context.createRadialGradient(cx, cy, 0, cx, cy, r * 0.5);
      core.addColorStop(0, '#ffffff'); core.addColorStop(0.5, '#6fe7ff'); core.addColorStop(1, 'rgba(60,160,255,0)');
      context.fillStyle = core; context.beginPath(); context.arc(cx, cy, r * 0.5, 0, Math.PI * 2); context.fill();
      // observer marker + flash
      const ox = width - 14; const oy = cy;
      context.fillStyle = `rgba(255,230,150,${0.35 + 0.65 * (hit > 0.2 && active ? hit : 0)})`;
      context.beginPath(); context.arc(ox, oy, 4 + (active ? hit * 5 : 0), 0, Math.PI * 2); context.fill();
      if (active) { angle += 0.045; request = requestAnimationFrame(draw); }
    };
    draw();
    return () => cancelAnimationFrame(request);
  }, [active]);
  return <canvas ref={canvasRef} className="h-[72px] w-[72px] shrink-0 rounded-lg sm:h-[84px] sm:w-[110px]" aria-hidden />;
}

function PulsarPanel({ selectedId }: { selectedId: string }) {
  const t = useTranslations('pulsar');
  const select = useSelectionStore((state) => state.select);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const media = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const audioRef = useRef<PulsarAudio | null>(null);
  const [volume, setVolume] = useState(0.6);
  const selected = PULSARS[selectedId] ?? null;
  const stopAudio = () => { audioRef.current?.stop(); audioRef.current = null; };

  useEffect(() => () => { audioRef.current?.stop(); audioRef.current = null; }, []);

  useEffect(() => {
    if (!media.current) return;
    if (playing) {
      void media.current.play().catch(() => setPlaying(false));
      return;
    }
    media.current.pause();
  }, [playing, selectedId]);

  if (!selected) return null;

  function toggleAudio() {
    if (!selected) return;
    const action = getPulsarPlaybackAction({ playing, kind: selected.kind, videoOpen });
    if (action.action === 'pause') {
      stopAudio();
      media.current?.pause();
      setPlaying(false);
      return;
    }
    if (selected.kind === 'video') setVideoOpen(action.openVideo);
    if (selected.kind === 'audio') {
      // Start synchronously inside the click so mobile browsers allow sound.
      stopAudio();
      audioRef.current = startPulsarAudio(selected.periodMs, volume);
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
          <p className="mt-0.5 hidden text-[9px] leading-relaxed text-slate-300/55 sm:block">{t('caption')}</p>
        </div>
        <button type="button" onClick={toggleAudio} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-200/25 bg-[linear-gradient(180deg,rgba(65,201,240,0.2),rgba(30,120,160,0.12))] px-3 py-2 text-[10px] font-medium text-cyan-50 shadow-[0_0_18px_rgba(53,204,255,0.08)] transition hover:border-cyan-100/45 hover:bg-cyan-300/20" aria-pressed={playing}>
          {playing ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}{playing ? t('pause') : t('listen')}
        </button>
        {selected.kind === 'video' ? <button type="button" onClick={() => setVideoOpen((value) => { if (value) { media.current?.pause(); setPlaying(false); } return !value; })} className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-slate-200/75 transition hover:border-white/20 hover:text-white sm:block">{videoOpen ? t('hideVideo') : t('nasaVideo')}</button> : null}
        <button type="button" onClick={() => select(null)} className="rounded-full p-1.5 text-foreground/50 transition hover:bg-white/5 hover:text-foreground" aria-label={t('close')}><X size={14} aria-hidden /></button>
      </div>

      <div className="mt-3 hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2"><span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('pulseRate')}</span><span className="mt-1 block font-mono text-sm text-cyan-100">{selected.hz} <span className="text-[9px] text-cyan-100/55">Hz</span></span></div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2"><span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('period')}</span><span className="mt-1 block font-mono text-sm text-violet-100">{selected.periodMs} <span className="text-[9px] text-violet-100/55">ms</span></span></div>
        <div className="col-span-2 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 sm:col-span-1 sm:flex-col sm:items-start sm:justify-center"><span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400/65">{t('trace')}</span><span className="font-mono text-[10px] text-slate-200/75">{t('traceNote')}</span></div>
      </div>
      <div className="mt-2 flex items-stretch gap-2 rounded-xl border border-cyan-200/10 bg-[#030a12]/85 p-1.5 shadow-[inset_0_0_22px_rgba(45,160,190,0.07)]"><div className="min-w-0 flex-1"><PulseTrace hz={selected.hz} active={playing} /></div><LighthouseDial active={playing} /></div>
      <div className="mt-1 flex justify-between px-1 font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/40"><span>{t('radioSignal')}</span><span>{t('sonified')}</span></div>
      {selected.kind === 'video' ? <video ref={media as React.RefObject<HTMLVideoElement>} title={t('nasaVideo')} src={selected.media} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className={`mt-2 max-h-[28rem] w-full rounded-xl border border-cyan-100/10 bg-black ${videoOpen ? '' : 'hidden'}`} /> : <label className="mt-2 flex items-center gap-3 rounded-xl border border-cyan-100/10 bg-cyan-400/5 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/80"><span className="shrink-0">{t('volume')}</span><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => { const v = Number(event.target.value); setVolume(v); audioRef.current?.setVolume(v); }} className="min-w-0 flex-1 accent-cyan-300" aria-label={t('volume')} /><span className="shrink-0 text-cyan-100/55">{playing ? t('active') : t('standby')}</span></label>}
    </section>
  );
}

/** Remounts per pulsar, so playback state and audio never leak between objects. */
export function PulsarExperience() {
  const selectedId = useSelectionStore((state) => state.selectedId);
  if (!selectedId || !(selectedId in PULSARS)) return null;
  return <PulsarPanel key={selectedId} selectedId={selectedId} />;
}
