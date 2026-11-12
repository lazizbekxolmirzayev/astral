'use client';

import { useLocale, useTranslations } from 'next-intl';
import { pickText } from '@/mission';
import { readTelemetry } from '@/mission/sim';
import { formatDistance, formatNumber, formatSpeed } from '@/game/format';
import { useSimSnapshot } from './useSimSnapshot';

const SWEEP = 240; // degrees of the dial arc
const START = 150; // degrees (SVG, clockwise from the +x axis) where the arc begins

/** Fraction 0..1 on a dial for a value on a log scale: 0 at 0, 1 at `max`. */
export function logFraction(value: number, max: number, knee: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(1, Math.max(0, Math.log10(1 + value / knee) / Math.log10(1 + max / knee)));
}

function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** One round instrument: arc, ticks, a needle that glides to its value, the value and a label. */
export function Dial({ label, fraction, value, tone = '#22d3ee', testId }: { label: string; fraction: number; value: string; tone?: string; testId: string }) {
  const f = Math.min(1, Math.max(0, fraction));
  const angle = START + SWEEP * f;
  const [nx, ny] = polar(50, 50, 31, angle);
  return (
    <div data-testid={testId} data-fraction={f.toFixed(3)} className="flex w-[92px] flex-col items-center">
      <svg viewBox="0 0 100 86" className="h-[78px] w-[92px]" role="img" aria-label={`${label}: ${value}`}>
        <defs>
          <radialGradient id={`dial-bg-${testId}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0d1626" />
            <stop offset="100%" stopColor="#05080f" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill={`url(#dial-bg-${testId})`} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <path d={arc(50, 50, 34, START, START + SWEEP)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" strokeLinecap="round" />
        <path d={arc(50, 50, 34, START, START + Math.max(0.5, SWEEP * f))} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${tone})`, transition: 'all 0.6s ease-out' }} />
        {Array.from({ length: 13 }, (_, index) => {
          const a = START + (SWEEP * index) / 12;
          const [x1, y1] = polar(50, 50, index % 3 === 0 ? 25 : 27.5, a);
          const [x2, y2] = polar(50, 50, 30, a);
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth={index % 3 === 0 ? 1.4 : 0.8} />;
        })}
        <line x1="50" y1="50" x2={nx} y2={ny} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" style={{ transition: 'all 0.6s ease-out' }} />
        <circle cx="50" cy="50" r="3.2" fill="#e6f7ff" stroke={tone} strokeWidth="1" />
      </svg>
      <p className="-mt-3.5 text-[11px] font-semibold leading-none text-white">{value}</p>
      <p className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-white/50">{label}</p>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  observing: 'border-emerald-300/50 bg-emerald-400/15 text-emerald-200',
  idle: 'border-white/15 bg-white/5 text-white/60',
  off: 'border-white/10 bg-white/[0.03] text-white/40',
  unpowered: 'border-amber-300/50 bg-amber-400/10 text-amber-200',
  fault: 'border-red-300/50 bg-red-400/10 text-red-200',
};

/**
 * The flight instruments: four dials and the spacecraft's equipment with what each instrument is doing.
 * Every reading is the simulation's telemetry; nothing here is made up.
 */
export function FlightInstruments() {
  const t = useTranslations('game.instruments');
  const locale = useLocale();
  const { plan, sim, clockT } = useSimSnapshot();
  if (!plan || !sim) return null;
  const tm = readTelemetry(plan, sim, clockT);
  const dvFraction = plan.dv.available > 0 ? tm.dvRemaining / plan.dv.available : 0;
  const altitude = tm.altitudeM ?? tm.distanceM;
  return (
    <>
      <div data-testid="instrument-dials" className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 gap-1 rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.78),rgba(8,10,20,0.62))] px-2 py-1.5 backdrop-blur-md min-[1060px]:flex">
        <Dial testId="dial-altitude" label={t(tm.altitudeM !== null ? 'altitude' : 'distance')} fraction={logFraction(altitude, 4e11, 1e5)} value={formatDistance(altitude, locale)} />
        <Dial testId="dial-speed" label={t('speed')} fraction={logFraction(tm.speedMps, 45000, 500)} value={formatSpeed(tm.speedMps, locale)} tone="#a78bfa" />
        <Dial testId="dial-dv" label={t('dv')} fraction={dvFraction} value={`${formatNumber(tm.dvRemaining, locale)} m/s`} tone={dvFraction < 0.25 ? '#f87171' : '#fbbf24'} />
        <Dial testId="dial-battery" label={t('battery')} fraction={tm.batteryFraction} value={`${formatNumber(tm.batteryFraction * 100, locale)}%`} tone={tm.batteryFraction < 0.25 ? '#f87171' : '#34d399'} />
      </div>

      <aside data-testid="equipment" className="pointer-events-none absolute left-3 top-[112px] z-20 hidden w-[210px] rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.78),rgba(8,10,20,0.62))] p-3 backdrop-blur-md min-[1060px]:block">
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">{t('equipment')}</p>
        {tm.instruments.length === 0 ? (
          <p className="mt-2 text-[11px] leading-snug text-white/50">{t('noInstruments')}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {tm.instruments.map((entry) => (
              <li key={entry.instrumentId} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-white/80">{pickText(entry.name, locale)}</span>
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${STATUS_STYLE[entry.status] ?? STATUS_STYLE.idle}`}>{t(`status.${entry.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
