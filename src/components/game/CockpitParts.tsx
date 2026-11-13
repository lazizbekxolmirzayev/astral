'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The physical parts of the cockpit: dials, lamps, a throttle lever, a spring-loaded stick, a guarded switch, a toggle,
 * a rotary selector and the little green displays. Everything is drawn, nothing is a web button: a part is something
 * a crew member grabs, flips or reads.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const METAL = 'linear-gradient(180deg,#1d2533 0%,#121723 100%)';

export function Screw({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`absolute h-1.5 w-1.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#8b95a7,#2a3242)] ${className}`} />;
}

/** A metal plate with an engraved name; `color` is the crew member's colour, `lit` a warm glow when the station is acting. */
export function Plate({ title, sub, color, lit, testId, ai, children }: { title: string; sub: string; color: string; lit?: boolean; testId?: string; ai?: boolean; children: ReactNode }) {
  return (
    <section data-testid={testId} data-ai={ai ? 'true' : 'false'} className="relative min-w-0 rounded-lg border border-[#2d3648] px-2 pb-2 pt-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_10px_rgba(0,0,0,0.5)]" style={{ background: METAL, boxShadow: lit ? `inset 0 0 0 1px rgba(251,191,36,0.55), 0 0 18px rgba(251,191,36,0.18)` : undefined }}>
      <Screw className="left-1 top-1" />
      <Screw className="right-1 top-1" />
      <header className="mb-1 flex items-baseline justify-between gap-1 px-2">
        <h3 className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300">{title}</h3>
        <span className="truncate text-[9px] font-medium" style={{ color }}>{sub}</span>
      </header>
      {children}
    </section>
  );
}

/** Round analogue dial: a needle over a 270° scale, an optional red zone and an optional marker (the advised value). */
export function Dial({ value, min, max, label, unit, display, redFrom, marker, ticks = 8, size = 78, testId }: { value: number; min: number; max: number; label: string; unit: string; display: string; redFrom?: number; marker?: number; ticks?: number; size?: number; testId?: string }) {
  const toAngle = (v: number) => -135 + clamp((v - min) / (max - min), 0, 1) * 270;
  const point = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [50 + Math.cos(rad) * radius, 50 + Math.sin(rad) * radius] as const;
  };
  const arc = (from: number, to: number, radius: number) => {
    const [x1, y1] = point(toAngle(from), radius);
    const [x2, y2] = point(toAngle(to), radius);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${toAngle(to) - toAngle(from) > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const tickMarks = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks);
  const needle = toAngle(value);
  return (
    <figure className="m-0 flex flex-col items-center" aria-label={`${label}: ${display} ${unit}`} data-testid={testId}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden>
        <circle cx="50" cy="50" r="48" fill="#06090f" stroke="#3b465c" strokeWidth="3" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="#10151f" strokeWidth="1" />
        {redFrom !== undefined ? <path d={arc(redFrom, max, 38)} stroke="#ef4444" strokeWidth="4" fill="none" opacity="0.85" /> : null}
        {tickMarks.map((tick) => {
          const [x1, y1] = point(toAngle(tick), 44);
          const [x2, y2] = point(toAngle(tick), 38);
          return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1.4" />;
        })}
        {marker !== undefined ? (() => {
          const [mx, my] = point(toAngle(marker), 33);
          return <circle cx={mx} cy={my} r="3" fill="#34d399" stroke="#022c22" strokeWidth="1" />;
        })() : null}
        <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: '50px 50px', transition: 'transform 220ms ease-out' }}>
          <polygon points="48.6,52 51.4,52 50.5,14 49.5,14" fill="#fbbf24" />
          <polygon points="49.2,52 50.8,52 50.4,64 49.6,64" fill="#fbbf24" opacity="0.6" />
        </g>
        <circle cx="50" cy="50" r="5" fill="#1f2937" stroke="#64748b" strokeWidth="1.5" />
        <text x="50" y="74" textAnchor="middle" fontSize="9" fill="#e2e8f0" fontFamily="ui-monospace,monospace">{display}</text>
        <text x="50" y="84" textAnchor="middle" fontSize="6.5" fill="#7b8aa3">{unit}</text>
      </svg>
      <figcaption className="-mt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</figcaption>
    </figure>
  );
}

const LAMP: Record<'green' | 'amber' | 'red' | 'blue', [string, string]> = {
  green: ['#34d399', 'rgba(52,211,153,0.7)'],
  amber: ['#fbbf24', 'rgba(251,191,36,0.7)'],
  red: ['#f87171', 'rgba(248,113,113,0.8)'],
  blue: ['#60a5fa', 'rgba(96,165,250,0.7)'],
};

/** A lamp that is dark until it has something to say, with its engraved name under it. */
export function Lamp({ on, color, label, flash }: { on: boolean; color: keyof typeof LAMP; label: string; flash?: boolean }) {
  const [solid, glow] = LAMP[color];
  return (
    <div className="flex w-10 flex-col items-center gap-0.5" role="status" aria-label={`${label}: ${on ? 'on' : 'off'}`}>
      <span className={`h-2.5 w-6 rounded-[3px] border ${on && flash ? 'animate-pulse' : ''}`} style={{ borderColor: on ? solid : '#2a3346', background: on ? solid : '#0b0f17', boxShadow: on ? `0 0 10px ${glow}` : 'inset 0 1px 2px rgba(0,0,0,0.8)' }} />
      <span className="text-center text-[7px] font-semibold uppercase leading-none tracking-[0.1em] text-slate-400">{label}</span>
    </div>
  );
}

/** A small green display, like the numeric readouts of a flight computer. */
export function Lcd({ label, value, tone, testId }: { label: string; value: string; tone?: 'good' | 'warn'; testId?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p data-testid={testId} className="truncate rounded-[3px] border border-[#1b2a22] bg-[#04100a] px-1.5 py-0.5 text-right font-mono text-[12px] leading-tight tabular-nums" style={{ color: tone === 'warn' ? '#fca5a5' : tone === 'good' ? '#86efac' : '#4ade80', textShadow: '0 0 6px rgba(74,222,128,0.5)' }}>{value}</p>
    </div>
  );
}

/** Vertical tape gauge for a tank: a glass tube with a level and tick marks. */
export function Tank({ label, fraction, color }: { label: string; fraction: number; color: string }) {
  const level = clamp(fraction, 0, 1);
  return (
    <div className="flex flex-col items-center gap-0.5" role="meter" aria-label={label} aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="relative h-[58px] w-3.5 overflow-hidden rounded-[4px] border border-[#3b465c] bg-[#06090f]">
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${level * 100}%`, background: `linear-gradient(180deg,${color},${color}aa)`, boxShadow: `0 0 8px ${color}88`, transition: 'height 200ms linear' }} />
        {[0.25, 0.5, 0.75].map((tick) => <span key={tick} className="absolute inset-x-0 h-px bg-white/25" style={{ bottom: `${tick * 100}%` }} />)}
      </div>
      <span className="text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <span className="font-mono text-[9px] text-slate-200">{Math.round(level * 100)}%</span>
    </div>
  );
}

/** The throttle lever on its quadrant: grab the handle and slide it. Keyboard and the lever share one value. */
export function Lever({ value, onChange, disabled, label, testId }: { value: number; onChange: (next: number) => void; disabled: boolean; label: string; testId?: string }) {
  const track = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const set = (clientY: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(clamp(1 - (clientY - rect.top) / rect.height, 0, 1));
  };
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-disabled={disabled}
      data-testid={testId}
      className={`relative h-[74px] w-9 touch-none select-none rounded-md border border-[#3b465c] bg-[#070a10] ${disabled ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={(event) => { if (disabled) return; dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); set(event.clientY); }}
      onPointerMove={(event) => { if (dragging.current) set(event.clientY); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      onKeyDown={(event) => { if (event.key === 'ArrowUp') { onChange(clamp(value + 0.05, 0, 1)); event.preventDefault(); } else if (event.key === 'ArrowDown') { onChange(clamp(value - 0.05, 0, 1)); event.preventDefault(); } }}
    >
      <span aria-hidden className="absolute inset-y-1.5 left-1/2 w-1 -translate-x-1/2 rounded bg-[#1b2433]" />
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => <span key={tick} aria-hidden className="absolute left-0.5 h-px w-1.5 bg-slate-500" style={{ bottom: `calc(${tick} * (100% - 10px) + 5px)` }} />)}
      <span aria-hidden className="absolute left-1/2 h-[18px] w-8 -translate-x-1/2 rounded-[5px] border border-[#8b95a7] shadow-[0_3px_6px_rgba(0,0,0,0.6)]" style={{ bottom: `calc(${value} * (100% - 18px))`, background: 'linear-gradient(180deg,#d1d5db,#6b7280 55%,#374151)' }}>
        <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-black/50" />
      </span>
    </div>
  );
}

/** A spring-loaded hand controller: push it forward or pull it back, let go and it returns to centre. */
export function Stick({ disabled, onChange, label }: { disabled: boolean; onChange: (direction: -1 | 0 | 1) => void; label: string }) {
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [grabbed, setGrabbed] = useState(false);
  const release = () => { start.current = null; setGrabbed(false); setOffset(0); onChange(0); };
  return (
    <div
      role="group"
      aria-label={label}
      data-action="pilot-stick"
      className={`relative h-[74px] w-[58px] touch-none select-none rounded-md border border-[#3b465c] bg-[#070a10] ${disabled ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={(event) => { if (disabled) return; start.current = event.clientY; setGrabbed(true); event.currentTarget.setPointerCapture?.(event.pointerId); }}
      onPointerMove={(event) => {
        if (start.current === null) return;
        const dy = clamp(event.clientY - start.current, -22, 22);
        setOffset(dy);
        onChange(dy < -6 ? -1 : dy > 6 ? 1 : 0);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span aria-hidden className="absolute left-1/2 top-1 -translate-x-1/2 text-[8px] text-slate-500">▲</span>
      <span aria-hidden className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">▼</span>
      <span aria-hidden className="absolute left-1/2 top-1/2 h-5 w-5 rounded-full border border-[#9aa4b5] shadow-[0_4px_8px_rgba(0,0,0,0.7)]" style={{ transform: `translate(-50%, calc(-50% + ${offset}px))`, background: 'radial-gradient(circle at 35% 30%,#e5e7eb,#6b7280 60%,#1f2937)', transition: grabbed ? 'none' : 'transform 160ms ease-out' }} />
    </div>
  );
}

/** A switch under a flip-up red cover: lift the cover first, then throw the switch. The cover closes again by itself. */
export function GuardedSwitch({ label, cover, disabled, onThrow, action }: { label: string; cover: string; disabled: boolean; onThrow: () => void; action: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setOpen(false), 4000);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <div className="relative flex h-[38px] w-full items-center justify-between rounded-md border border-[#3b465c] bg-[#070a10] px-2" data-open={open ? 'true' : 'false'}>
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-100">{label}</span>
      <button type="button" data-action={action} disabled={disabled || !open} aria-label={label} onClick={() => { onThrow(); setOpen(false); }} className="h-5 w-7 rounded-[3px] border border-red-300/60 bg-[linear-gradient(180deg,#ef4444,#7f1d1d)] shadow-[0_2px_4px_rgba(0,0,0,0.7)] disabled:opacity-60" />
      <button type="button" data-action={`${action}-cover`} disabled={disabled} aria-expanded={open} aria-label={cover} onClick={() => setOpen((value) => !value)} className="absolute right-1 top-1 h-[28px] w-[34px] origin-bottom rounded-[4px] border border-red-200/50 bg-red-500/35 backdrop-blur-[1px] transition-transform duration-200 disabled:opacity-40" style={{ transform: open ? 'translateY(-15px) rotateX(70deg)' : 'none', transformOrigin: 'top' }} />
    </div>
  );
}

/** A metal toggle switch with its engraved ON and OFF. */
export function Toggle({ on, onToggle, disabled, label, state, action, title }: { on: boolean; onToggle: () => void; disabled: boolean; label: string; state: string; action: string; title?: string }) {
  return (
    <button type="button" data-action={action} title={title} aria-pressed={on} disabled={disabled} onClick={onToggle} className="flex w-full items-center justify-between gap-2 rounded-md border border-[#3b465c] bg-[#070a10] px-2 py-1 text-left disabled:opacity-60">
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-200">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[8px] font-semibold uppercase" style={{ color: on ? '#6ee7b7' : '#64748b' }}>{state}</span>
        <span className="relative h-6 w-3 rounded-full border border-[#475569] bg-[#0b1018]" aria-hidden>
          <span className="absolute left-1/2 h-3.5 w-2 -translate-x-1/2 rounded-[3px] border border-[#9aa4b5] transition-all duration-150" style={{ top: on ? 1 : 8, background: 'linear-gradient(180deg,#e5e7eb,#6b7280)' }} />
        </span>
      </span>
    </button>
  );
}

/** A rotary selector: the knob points at the chosen position, the positions around it are what can be chosen. */
export function Selector<T extends string | number>({ value, options, labelOf, onSelect, label, action, disabledOf }: { value: T; options: readonly T[]; labelOf: (option: T) => string; onSelect: (option: T) => void; label: string; action: (option: T) => string; disabledOf?: (option: T) => boolean }) {
  const index = Math.max(0, options.indexOf(value));
  const angle = options.length > 1 ? -60 + (120 * index) / (options.length - 1) : 0;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span aria-hidden className="relative h-5 w-5 shrink-0 rounded-full border border-[#8b95a7] shadow-[0_3px_6px_rgba(0,0,0,0.6)]" style={{ background: 'radial-gradient(circle at 35% 30%,#d1d5db,#4b5563 65%,#111827)' }}>
        <span className="absolute left-1/2 top-0.5 h-2 w-0.5 -translate-x-1/2 bg-amber-300" style={{ transformOrigin: '50% 8px', transform: `translateX(-50%) rotate(${angle}deg)`, transition: 'transform 160ms ease-out' }} />
      </span>
      <span className="flex flex-nowrap gap-x-1.5 whitespace-nowrap">
        {options.map((option) => (
          <button key={String(option)} type="button" data-action={action(option)} aria-pressed={option === value} disabled={disabledOf?.(option)} onClick={() => onSelect(option)} className={`text-[9px] font-semibold uppercase tracking-[0.1em] disabled:opacity-30 ${option === value ? 'text-amber-200' : 'text-slate-500 hover:text-slate-300'}`}>
            {labelOf(option)}
          </button>
        ))}
      </span>
    </div>
  );
}
