'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogEntry } from '@/data/catalog/entries';
import { CustomBodyEditor } from './CustomBodyEditor';
import { catalogScenario, createSandboxSimulation, customScenario, type CustomBodySpec, SANDBOX_PRESETS, SANDBOX_SPEEDS, type SandboxPreset, type SandboxSpeed } from '@/lib/sandboxSimulation';
import type { NBodyState } from '@/physics/gravity';
import type { SandboxPresetInfo, SandboxSnapshot } from '@/lib/sandboxSimulation';

const BODY_COLORS: Record<string, string> = {
  sun: '#ffd166',
  mercury: '#a99a8b',
  venus: '#e8bd70',
  earth: '#58a6ff',
  mars: '#e27655',
  jupiter: '#d2ad83',
  saturn: '#e2cc8a',
  uranus: '#82d3d9',
  neptune: '#637bea',
  asteroid: '#dbdbdb',
  'test-particle': '#56dbcc',
  'black-hole': '#050509',
  star: '#ffd166',
  planet: '#58a6ff',
};

function drawSandbox(canvas: HTMLCanvasElement, state: NBodyState, centerId?: string) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = '#070a12';
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = 'rgba(145, 170, 210, 0.10)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(rect.width / 2, 0);
  context.lineTo(rect.width / 2, rect.height);
  context.moveTo(0, rect.height / 2);
  context.lineTo(rect.width, rect.height / 2);
  context.stroke();
  if (state.ids.length === 0) return;

  const centerIndex = Math.max(0, centerId ? state.ids.indexOf(centerId) : 0);
  const centerX = state.positions[centerIndex * 3] as number;
  const centerY = state.positions[centerIndex * 3 + 1] as number;
  let extent = 0;
  for (let index = 0; index < state.ids.length; index += 1) {
    const dx = (state.positions[index * 3] as number) - centerX;
    const dy = (state.positions[index * 3 + 1] as number) - centerY;
    extent = Math.max(extent, Math.hypot(dx, dy));
  }
  const scale = Math.min(rect.width, rect.height) * 0.42 / Math.max(extent, 1e-6);
  const originX = rect.width / 2;
  const originY = rect.height / 2;

  for (let index = 0; index < state.ids.length; index += 1) {
    const id = state.ids[index] as string;
    const x = originX + ((state.positions[index * 3] as number) - centerX) * scale;
    const y = originY - ((state.positions[index * 3 + 1] as number) - centerY) * scale;
    const radius = id === 'sun' || id === 'star' || id === 'black-hole' ? 6 : id === 'asteroid' ? 2 : 3.5;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = BODY_COLORS[id] ?? '#d7e2f1';
    context.fill();
    if (id === 'black-hole') {
      context.strokeStyle = '#9b78ff';
      context.lineWidth = 2;
      context.stroke();
    }
    context.fillStyle = '#d4d9e5';
    context.font = '11px ui-monospace, monospace';
    context.fillText(id, x + radius + 4, y + 4);
  }
}

function formatDrift(value: number) {
  return `${value.toExponential(3)}%`;
}

export function SandboxWorkspace({ preset, onPresetChange, override }: {
  preset: SandboxPreset;
  onPresetChange: (preset: SandboxPreset) => void;
  /** A scenario built from a catalogue record; replaces the preset's own setup. */
  override?: SandboxPresetInfo;
}) {
  const t = useTranslations('sandbox');
  const [engine] = useState(() => createSandboxSimulation(preset, override));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<SandboxSpeed>(1);
  const [snapshot, setSnapshot] = useState<SandboxSnapshot>(() => engine.snapshot());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetCanvas = canvas;
    let animationFrame = 0;
    let previousFrame = 0;
    let lastPublish = 0;

    function frame(now: number) {
      if (previousFrame > 0 && playing) {
        const delta = Math.min((now - previousFrame) / 1000, 0.1);
        engine.advance(delta, speed);
      }
      previousFrame = now;
      drawSandbox(targetCanvas, engine.state, engine.info.centerId);
      if (now - lastPublish >= 250) {
        setSnapshot(engine.snapshot());
        lastPublish = now;
      }
      animationFrame = requestAnimationFrame(frame);
    }

    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, [engine, playing, speed]);

  function reset() {
    engine.reset();
    setPlaying(false);
    setSnapshot(engine.snapshot());
  }

  const validity = engine.info.blackHole?.validity;
  const presetName = override?.kind === 'catalog' ? (override.title ?? '') : t(`presets.${preset}`);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-5 py-7 text-foreground sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-panel-border pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent-cyan">NEXUS</p>
          <h1 className="mt-1 text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
        </div>
        <label className="grid gap-1 text-xs text-foreground/60">
          {t('presetLabel')}
          <select
            aria-label={t('presetLabel')}
            value={override?.kind === 'catalog' ? '' : preset}
            onChange={(event) => onPresetChange(event.target.value as SandboxPreset)}
            className="min-w-56 rounded-md border border-panel-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {override?.kind === 'catalog' ? <option value="" disabled>{override.title}</option> : null}
            {SANDBOX_PRESETS.map((option) => <option key={option} value={option}>{t(`presets.${option}`)}</option>)}
          </select>
        </label>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="relative min-h-[22rem] overflow-hidden rounded-lg border border-panel-border bg-[#070a12]">
          <canvas ref={canvasRef} data-sandbox-canvas aria-label={t('viewLabel')} className="absolute inset-0 h-full w-full" />
          <span className="pointer-events-none absolute right-3 top-3 rounded border border-panel-border bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground/65">{t('notToScale')}</span>
          {engine.state.ids.length === 0 ? <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-foreground/55">{t('emptySpace')}</p> : null}
        </section>

        <aside className="flex flex-col gap-4 rounded-lg border border-panel-border bg-background/50 p-4">
          <div>
            <h2 className="text-sm font-semibold">{presetName}</h2>
            <p className="mt-1 text-xs leading-relaxed text-foreground/55">{override?.kind === 'catalog' ? t('catalogNote') : t(`notes.${engine.info.note}`)}</p>
            {override?.kind === 'catalog' ? (
              <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-star-gold">
                <p>{t('catalogLoaded', { name: override.title ?? '' })}</p>
                {override.assumptions && override.assumptions.length > 0 ? <p>{t('assumptions', { list: override.assumptions.join(', ') })}</p> : null}
                <p>{t('unverified')}</p>
                <Link href="/catalog" className="inline-block text-accent-cyan underline">{t('backToCatalog')}</Link>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} className="inline-flex items-center gap-1.5 rounded border border-panel-border px-3 py-2 text-xs hover:border-accent-cyan/50">
              {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
              {playing ? t('pause') : t('run')}
            </button>
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded border border-panel-border px-3 py-2 text-xs hover:border-accent-cyan/50">
              <RotateCcw size={14} aria-hidden />{t('reset')}
            </button>
          </div>

          <label className="grid gap-1 text-xs text-foreground/60">
            {t('speed')}
            <select aria-label={t('speed')} value={speed} onChange={(event) => setSpeed(Number(event.target.value) as SandboxSpeed)} className="rounded border border-panel-border bg-background px-3 py-2 font-mono text-sm text-foreground">
              {SANDBOX_SPEEDS.map((option) => <option key={option} value={option}>{option}×</option>)}
            </select>
          </label>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-panel-border pt-3 text-xs">
            <dt className="text-foreground/55">{t('elapsed')}</dt><dd className="text-right font-mono">{snapshot.elapsedDays.toFixed(4)} d</dd>
            <dt className="text-foreground/55">{t('energyDrift')}</dt><dd className="text-right font-mono">{snapshot.energyAvailable ? formatDrift(snapshot.energyDriftPercent) : t('notAvailable')}</dd>
            <dt className="text-foreground/55">{t('angularMomentumDrift')}</dt><dd className="text-right font-mono">{snapshot.energyAvailable ? formatDrift(snapshot.angularMomentumDriftPercent) : t('notAvailable')}</dd>
            <dt className="text-foreground/55">{t('bodyCount')}</dt><dd className="text-right font-mono">{engine.state.ids.length}</dd>
          </dl>

          {engine.info.impact ? (
            <div className="border-t border-panel-border pt-3 text-xs">
              <h3 className="font-semibold">{t('impactSummary')}</h3>
              <p className="mt-1 text-foreground/60">{t('impactEnergy', { value: engine.info.impact.energyJoules.toExponential(3) })}</p>
              <p className="mt-1 text-foreground/60">{t('impactMegatons', { value: engine.info.impact.tntMegatons.toExponential(3) })}</p>
              <p className="mt-1 text-foreground/60">{t(engine.info.impact.airburstRisk ? 'airburstFlag' : 'noAirburstFlag')}</p>
            </div>
          ) : null}

          {engine.info.blackHole && validity ? (
            <div className="border-t border-panel-border pt-3 text-xs">
              <h3 className="font-semibold">{t('validityTitle')}</h3>
              <p className="mt-1 text-foreground/60">{t('schwarzschildDistance', { value: validity.distanceInSchwarzschildRadii.toFixed(1) })}</p>
              <p className={validity.status === 'invalid' ? 'mt-1 text-red-300' : 'mt-1 text-star-gold'}>{t(`validity.${validity.status}`)}</p>
            </div>
          ) : null}

          {snapshot.collision ? (
            <div role="alert" className="rounded border border-red-400/50 bg-red-400/10 p-3 text-xs">
              <h3 className="font-semibold text-red-300">{t('collisionTitle')}</h3>
              <p className="mt-1 text-foreground/75">{t('collisionBody', { days: snapshot.collision.elapsedDays.toFixed(4), speed: snapshot.collision.speedKmS.toFixed(1) })}</p>
            </div>
          ) : null}

          <div className="border-t border-panel-border pt-3" aria-live="polite">
            <h3 className="text-xs font-semibold">{t('stability')}</h3>
            {snapshot.warnings.length === 0 ? <p className="mt-1 text-xs text-foreground/55">{t('noWarnings')}</p> : (
              <ul className="mt-1 space-y-1 text-xs text-star-gold">
                {snapshot.warnings.map((warning) => <li key={`${warning.id}:${warning.kind}`}>{t(warning.kind === 'unbound' ? 'warningUnbound' : 'warningDistance', { body: warning.id, measured: warning.measured.toPrecision(4), limit: warning.limit.toPrecision(4), unit: warning.kind === 'unbound' ? 'AU/day' : 'AU' })}</li>)}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <section className="rounded-md border border-panel-border/70 bg-background/40 px-4 py-3 text-xs leading-relaxed text-foreground/50">
        {engine.info.note === 'starReplacement' ? t('starModelCard') : engine.info.note === 'blackHole' ? t('blackHoleModelCard') : engine.info.note === 'impact' ? t('impactModelCard') : t('newtonianModelCard')}
      </section>
    </main>
  );
}

export function Sandbox() {
  const router = useRouter();
  const catalogId = useSearchParams().get('catalog');
  const entry = catalogId ? getCatalogEntry(catalogId) : undefined;
  const catalogOverride = useMemo(() => (entry ? catalogScenario(entry) : null), [entry]);
  const presetParam = useSearchParams().get('preset');
  const [preset, setPreset] = useState<SandboxPreset>(() => SANDBOX_PRESETS.find((option) => option === presetParam) ?? 'stable-system');
  const [custom, setCustom] = useState<CustomBodySpec[]>([]);
  const fromCatalog = catalogOverride !== null;
  const editing = !fromCatalog && preset === 'empty-space';
  const customOverride = useMemo(() => (editing && custom.length > 0 ? customScenario(custom) : null), [editing, custom]);
  const override = catalogOverride ?? customOverride;

  function changePreset(next: SandboxPreset) {
    if (fromCatalog) router.replace('/sandbox');
    setPreset(next);
  }

  return (
    <>
      <SandboxWorkspace
        key={fromCatalog ? `catalog:${catalogId}` : `${preset}:${custom.map((body) => body.name).join(',')}`}
        preset={fromCatalog ? 'empty-space' : preset}
        override={override ?? undefined}
        onPresetChange={changePreset}
      />
      {editing ? (
        <div className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-8">
          <CustomBodyEditor bodies={custom} onChange={setCustom} />
        </div>
      ) : null}
    </>
  );
}
