'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useSyncExternalStore } from 'react';
import { formatNumber } from '@/game/format';
import { readTelemetry } from '@/mission/sim';
import { SIM_ASSUMPTIONS } from '@/mission/sim/assumptions';
import { createFlightRecorder, type ChartSample } from '@/game/recorder';
import { simStore } from '@/stores/simStore';
import { ascentPose } from './launchPath';
import { useSimSnapshot } from './useSimSnapshot';

/* ---- attitude indicator: the artificial horizon of a flight deck ---- */

/** The attitude indicator: sky and ground rotate behind a fixed vehicle symbol; the ladder marks pitch every 10 degrees. */
export function AttitudeIndicator({ pitchDeg, rollDeg = 0 }: { pitchDeg: number; rollDeg?: number }) {
  const scale = 1.05; // pixels per degree
  const shift = Math.max(-80, Math.min(80, pitchDeg)) * scale;
  const ladder = [-30, -20, -10, 10, 20, 30, 40, 50, 60, 70, 80];
  return (
    <svg data-testid="adi" data-pitch={pitchDeg.toFixed(1)} viewBox="0 0 120 120" className="h-[112px] w-[112px]" role="img" aria-label={`Attitude ${Math.round(pitchDeg)}°`}>
      <defs>
        <clipPath id="adi-clip"><circle cx="60" cy="60" r="52" /></clipPath>
        <linearGradient id="adi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a2a6a" /><stop offset="1" stopColor="#3b86d9" /></linearGradient>
        <linearGradient id="adi-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5a2c" /><stop offset="1" stopColor="#3d2610" /></linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="#05080f" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      <g clipPath="url(#adi-clip)">
        <g transform={`rotate(${rollDeg} 60 60) translate(0 ${shift})`} style={{ transition: 'transform 0.4s linear' }}>
          <rect x="-60" y="-260" width="240" height="320" fill="url(#adi-sky)" />
          <rect x="-60" y="60" width="240" height="320" fill="url(#adi-ground)" />
          <line x1="-60" y1="60" x2="180" y2="60" stroke="#fff" strokeWidth="1.4" />
          {ladder.map((deg) => {
            const y = 60 - deg * scale;
            const long = deg % 20 === 0;
            return (
              <g key={deg}>
                <line x1={long ? 44 : 50} y1={y} x2={long ? 76 : 70} y2={y} stroke="rgba(255,255,255,0.85)" strokeWidth="1" />
                {long ? <text x="80" y={y + 3} fontSize="7" fill="#fff">{Math.abs(deg)}</text> : null}
              </g>
            );
          })}
        </g>
      </g>
      <path d="M 30 62 L 50 62 L 56 70 M 90 62 L 70 62 L 64 70" fill="none" stroke="#fbbf24" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="62" r="2.4" fill="#fbbf24" />
      <path d="M 60 6 L 56 14 L 64 14 Z" fill="#fbbf24" />
    </svg>
  );
}

/* ---- tapes: a moving ruler with the current value in a box ---- */

export function Tape({ label, value, unit, span, major, decimals = 0, tone = '#22d3ee', testId }: { label: string; value: number; unit: string; span: number; major: number; decimals?: number; tone?: string; testId: string }) {
  const height = 112;
  const pxPerUnit = height / (span * 2);
  const first = Math.floor((value - span) / major) * major;
  const ticks: number[] = [];
  for (let v = first; v <= value + span + major; v += major) ticks.push(Number(v.toFixed(6)));
  return (
    <div data-testid={testId} data-value={value.toFixed(3)} className="flex flex-col items-center">
      <svg viewBox="0 0 64 112" className="h-[112px] w-[64px]" role="img" aria-label={`${label}: ${value.toFixed(decimals)} ${unit}`}>
        <defs><clipPath id={`tape-${testId}`}><rect x="0" y="0" width="64" height="112" rx="6" /></clipPath></defs>
        <rect x="0" y="0" width="64" height="112" rx="6" fill="#070b14" stroke="rgba(255,255,255,0.16)" />
        <g clipPath={`url(#tape-${testId})`}>
          {ticks.map((tick) => {
            const y = height / 2 - (tick - value) * pxPerUnit;
            const isMajor = Math.abs(tick / major - Math.round(tick / major)) < 1e-6;
            return (
              <g key={tick}>
                <line x1="46" y1={y} x2="64" y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth={isMajor ? 1.4 : 0.8} />
                {isMajor && tick >= 0 ? <text x="42" y={y + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.8)">{tick.toFixed(decimals)}</text> : null}
              </g>
            );
          })}
        </g>
        <path d="M 0 50 L 6 56 L 0 62 Z" fill={tone} />
        <rect x="6" y="46" width="40" height="20" rx="3" fill="#000" stroke={tone} strokeWidth="1.2" />
        <text x="26" y="60.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{value.toFixed(decimals)}</text>
      </svg>
      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.18em] text-white/55">{label} · {unit}</p>
    </div>
  );
}

/* ---- acceleration gauge: a horizontal bar graph in g ---- */

export function GMeter({ g, label, max = 6 }: { g: number; label: string; max?: number }) {
  const fraction = Math.min(1, Math.max(0, g / max));
  return (
    <div data-testid="gmeter" data-g={g.toFixed(2)} className="w-[112px]">
      <div className="flex items-baseline justify-between"><span className="text-[8.5px] uppercase tracking-[0.18em] text-white/55">{label}</span><span className="text-[12px] font-bold text-white">{g.toFixed(1)} g</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-white/15 bg-black/60">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fraction * 100}%`, background: g > 4 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#22d3ee,#34d399)' }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[8px] text-white/35"><span>0</span><span>2</span><span>4</span><span>6</span></div>
    </div>
  );
}

/** Reads the simulation once and gives the recorder the numbers of this moment. */
function feed(recorder: ReturnType<typeof createFlightRecorder>): void {
  const { plan, sim, clockT } = simStore.getState();
  if (!plan || !sim) return;
  const stage = plan.stageIds[sim.stageIndex]!;
  const length = plan.stagePlannedS.launch ?? 540;
  const launchElapsedS = stage === 'pre-launch' ? 0 : stage === 'launch' ? sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t) : length;
  if (stage !== 'launch' && stage !== 'pre-launch') { recorder.push({ clockT, stage, launchElapsedS, altitudeKm: 0, speedMps: 0 }); return; }
  const tm = readTelemetry(plan, sim, clockT);
  recorder.push({ clockT, stage, launchElapsedS, altitudeKm: (tm.altitudeM ?? 0) / 1000, speedMps: tm.speedMps });
}

/* ---- strip chart: the flown altitude and speed against time ---- */

export function StripChart({ samples, length, altitudeMax, speedMax, labels }: { samples: ChartSample[]; length: number; altitudeMax: number; speedMax: number; labels: { altitude: string; speed: string } }) {
  const w = 220;
  const h = 84;
  const path = (pick: (s: ChartSample) => number, max: number) =>
    samples.map((s, index) => `${index === 0 ? 'M' : 'L'} ${((s.t / Math.max(1, length)) * w).toFixed(1)} ${(h - Math.min(1, pick(s) / max) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <div data-testid="strip-chart" data-samples={samples.length}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[84px] w-[220px] rounded-md border border-white/12 bg-[#070b14]" role="img" aria-label={`${labels.altitude}, ${labels.speed}`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,0.07)" />)}
        {[0.25, 0.5, 0.75].map((f) => <line key={`v${f}`} y1="0" y2={h} x1={w * f} x2={w * f} stroke="rgba(255,255,255,0.07)" />)}
        {samples.length > 1 ? <path d={path((s) => s.speedKms, speedMax)} fill="none" stroke="#a78bfa" strokeWidth="1.6" /> : null}
        {samples.length > 1 ? <path d={path((s) => s.altitudeKm, altitudeMax)} fill="none" stroke="#22d3ee" strokeWidth="1.6" /> : null}
      </svg>
      <p className="mt-0.5 flex gap-3 text-[8.5px] uppercase tracking-[0.14em]"><span className="text-cyan-300">● {labels.altitude}</span><span className="text-violet-300">● {labels.speed}</span></p>
    </div>
  );
}

/**
 * The ascent instrument panel: attitude indicator, altitude and speed tapes, acceleration, and a strip chart of
 * the climb. Altitude, speed and acceleration come from the simulation's telemetry; the attitude is the drawn
 * ascent profile (the simulation has no flight dynamics), and the panel says so.
 */
export function AscentPanel() {
  const t = useTranslations('game.instruments');
  const locale = useLocale();
  const { plan, sim, clockT } = useSimSnapshot();
  const recorder = useMemo(() => createFlightRecorder(), []);
  const subscribe = useMemo(() => (listener: () => void) => simStore.subscribe(() => { feed(recorder); listener(); }), [recorder]);
  const recorded = useSyncExternalStore(subscribe, recorder.snapshot, recorder.snapshot);
  if (!plan || !sim) return null;

  const tm = readTelemetry(plan, sim, clockT);
  const stage = plan.stageIds[sim.stageIndex]!;
  const length = plan.stagePlannedS.launch ?? 540;
  const launchElapsed = stage === 'pre-launch' ? 0 : stage === 'launch' ? sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t) : length;
  const tau = Math.min(1, Math.max(0, launchElapsed / length));
  const pitchDeg = stage === 'orbit-insertion' ? 0 : 90 - (ascentPose(tau).pitch * 180) / Math.PI;
  const altitudeKm = (tm.altitudeM ?? 0) / 1000;
  const speedKms = tm.speedMps / 1000;
  const g = recorded.g;
  const samples = recorded.samples as ChartSample[];
  const parkingKm = SIM_ASSUMPTIONS.parkingAltitudeKm;
  const toOrbitKm = Math.max(0, parkingKm - altitudeKm);

  return (
    <div data-testid="ascent-panel" className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 items-end gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.82),rgba(8,10,20,0.7))] px-3 py-2 backdrop-blur-md min-[1060px]:flex">
      <div className="flex flex-col items-center">
        <AttitudeIndicator pitchDeg={pitchDeg} />
        <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.18em] text-white/55">{t('attitude')}</p>
      </div>
      <Tape testId="tape-altitude" label={t('altitude')} unit="km" value={altitudeKm} span={60} major={10} />
      <Tape testId="tape-speed" label={t('speed')} unit="km/s" value={speedKms} span={2} major={0.5} decimals={1} tone="#a78bfa" />
      <div className="flex flex-col gap-2">
        <GMeter g={g} label={t('accel')} />
        <div className="w-[112px]">
          <p className="text-[8.5px] uppercase tracking-[0.18em] text-white/55">{t('toOrbit')}</p>
          <p className="text-[13px] font-bold text-white">{formatNumber(toOrbitKm, locale)} km</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (altitudeKm / parkingKm) * 100)}%` }} /></div>
        </div>
      </div>
      <div>
        <StripChart samples={samples} length={length} altitudeMax={parkingKm} speedMax={8} labels={{ altitude: t('altitude'), speed: t('speed') }} />
        <p className="mt-0.5 max-w-[220px] text-[8px] leading-tight text-white/35">{t('profileNote')}</p>
      </div>
    </div>
  );
}
