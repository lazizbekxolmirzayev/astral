'use client';

import { Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogEntry } from '@/data/catalog/entries';
import { CustomBodyEditor } from './CustomBodyEditor';
import { createSandboxView, formatDistanceAu } from './sandboxView';
import { orbitReadout, type OrbitReadout } from '@/physics/orbitReadout';
import { kineticEnergyJoules, tntEquivalentMegatons } from '@/physics/impact';
import { catalogScenario, createSandboxSimulation, customScenario, IMPACT_TARGET_IDS, type ImpactTargetId, type CustomBodySpec, SANDBOX_PRESETS, SANDBOX_SPEEDS, type SandboxPreset, type SandboxSpeed } from '@/lib/sandboxSimulation';
import type { SandboxPresetInfo, SandboxSnapshot } from '@/lib/sandboxSimulation';

function formatDrift(value: number) {
  return `${value.toExponential(3)}%`;
}

export function SandboxWorkspace({ preset, onPresetChange, override, impactTargetId, onImpactTargetChange }: {
  preset: SandboxPreset;
  onPresetChange: (preset: SandboxPreset) => void;
  /** A scenario built from a catalogue record; replaces the preset's own setup. */
  override?: SandboxPresetInfo;
  impactTargetId: ImpactTargetId;
  onImpactTargetChange: (target: ImpactTargetId) => void;
}) {
  const t = useTranslations('sandbox');
  const bodyNames = useTranslations('bodies');
  const [engine] = useState(() => createSandboxSimulation(preset, override));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<SandboxSpeed>(() => (!override && (preset === 'stable-system' || preset === 'star-replacement') ? 100 : 1));
  const [snapshot, setSnapshot] = useState<SandboxSnapshot>(() => engine.snapshot());
  const [view] = useState(() => createSandboxView());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readout, setReadout] = useState<OrbitReadout | null>(null);
  const [showTrails, setShowTrails] = useState(true);
  const [showVectors, setShowVectors] = useState(false);
  const driftHistory = useRef<number[]>([]);
  const impactStartedAt = useRef<number | null>(null);
  const [drift, setDrift] = useState<number[]>([]);

  useEffect(() => {
    view.setOptions({ selectedId, showTrails, showVectors });
  }, [view, selectedId, showTrails, showVectors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetCanvas = canvas;
    let animationFrame = 0;
    let previousFrame = 0;
    let lastPublish = 0;
    let lastSampled = -1;
    view.sample(engine.state, engine.info.centerId);

    function frame(now: number) {
      let frameSnapshot = engine.snapshot();
      if (previousFrame > 0 && playing) {
        const delta = Math.min((now - previousFrame) / 1000, 0.1);
        engine.advance(delta, speed);
        frameSnapshot = engine.snapshot();
        const elapsed = frameSnapshot.elapsedDays;
        if (elapsed !== lastSampled) {
          view.sample(engine.state, engine.info.centerId);
          lastSampled = elapsed;
        }
      }
      previousFrame = now;
      const collision = frameSnapshot.collision;
      if (collision && impactStartedAt.current === null) impactStartedAt.current = now;
      const targetId = engine.info.collision?.bodyB;
      view.draw(
        targetCanvas,
        engine.state,
        engine.info.centerId,
        '',
        collision && targetId && impactStartedAt.current !== null
          ? { targetId, startedAt: impactStartedAt.current, now }
          : undefined,
      );
      if (now - lastPublish >= 250) {
        const snap = engine.snapshot();
        setSnapshot(snap);
        if (snap.energyAvailable && playing) {
          driftHistory.current = [...driftHistory.current.slice(-59), snap.energyDriftPercent];
          setDrift(driftHistory.current);
        }
        const centerIndex = Math.max(0, engine.info.centerId ? engine.state.ids.indexOf(engine.info.centerId) : 0);
        const index = view.selectedId ? engine.state.ids.indexOf(view.selectedId) : -1;
        setReadout(index >= 0 ? orbitReadout(engine.state, index, centerIndex) : null);
        lastPublish = now;
      }
      animationFrame = requestAnimationFrame(frame);
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      view.zoomAt(targetCanvas, event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
    }
    targetCanvas.addEventListener('wheel', onWheel, { passive: false });
    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      targetCanvas.removeEventListener('wheel', onWheel);
    };
  }, [engine, view, playing, speed]);

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    view.dragStart(event.clientX, event.clientY);
  }
  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    view.dragMove(event.clientX, event.clientY);
  }
  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const moved = view.dragEnd();
    if (!moved && canvasRef.current) {
      const id = view.pick(canvasRef.current, engine.state, engine.info.centerId, event.clientX, event.clientY);
      setSelectedId(id);
      if (!id) setReadout(null);
    }
  }

  function reset() {
    engine.reset();
    impactStartedAt.current = null;
    view.clearTrails();
    view.fit();
    driftHistory.current = [];
    setDrift([]);
    view.sample(engine.state, engine.info.centerId);
    setPlaying(false);
    setSnapshot(engine.snapshot());
  }

  function fitView() {
    view.fit();
  }

  const validity = engine.info.blackHole?.validity;
  const presetName = override?.kind === 'catalog' ? (override.title ?? '') : t(`presets.${preset}`);
  const impactEnergy = engine.info.impact
    ? snapshot.collision
      ? kineticEnergyJoules(engine.info.impact.impactorMassKg, snapshot.collision.speedKmS * 1000)
      : engine.info.impact.energyJoules
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-5 py-7 text-foreground sm:px-8">
      <header className="relative overflow-hidden rounded-[26px] border border-panel-border bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.12),transparent_25%),linear-gradient(135deg,rgba(10,14,22,0.96),rgba(14,20,30,0.88))] p-5 shadow-[0_20px_60px_rgba(4,8,16,0.6)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-4 h-28 w-28 rounded-full border border-accent-cyan/15" />
          <div className="absolute right-6 top-3 h-24 w-24 rounded-full border border-nebula-purple/20" style={{ transform: 'rotate(32deg)' }} />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-accent-cyan">NEXUS</p>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-cyan-200">Realtime</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-foreground/55">{t('subtitle')}</p>
          </div>
          <label className="grid gap-1 text-[10px] uppercase tracking-[0.18em] text-foreground/60">
            {t('presetLabel')}
            <select
              aria-label={t('presetLabel')}
              value={override?.kind === 'catalog' ? '' : preset}
              onChange={(event) => onPresetChange(event.target.value as SandboxPreset)}
              className="min-w-56 rounded-full border border-panel-border bg-background/70 px-3 py-2 text-xs uppercase tracking-[0.12em] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
            >
              {override?.kind === 'catalog' ? <option value="" disabled>{override.title}</option> : null}
              {SANDBOX_PRESETS.map((option) => <option key={option} value={option}>{t(`presets.${option}`)}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="relative min-h-[22rem] overflow-hidden rounded-[28px] border border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.09),transparent_26%),linear-gradient(180deg,#070b13,#090d16)] shadow-[0_20px_70px_rgba(5,9,18,0.72)]">
          <canvas
            ref={canvasRef}
            data-sandbox-canvas
            aria-label={t('viewLabel')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={fitView}
            className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.07),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(108,92,231,0.06),transparent_28%)]" />

          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 text-[11px]">
            <button type="button" onClick={fitView} className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-panel-border bg-background/75 px-2.5 py-1.5 text-foreground/80 shadow-[0_8px_25px_rgba(0,0,0,0.2)] backdrop-blur-sm hover:border-accent-cyan/60"><Maximize2 size={12} aria-hidden />{t('view.fit')}</button>
            <button type="button" aria-pressed={showTrails} onClick={() => setShowTrails((v) => !v)} className={`pointer-events-auto rounded-full border px-2.5 py-1.5 ${showTrails ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan' : 'border-panel-border bg-background/75 text-foreground/75'}`}>{t('view.trails')}</button>
            <button type="button" aria-pressed={showVectors} onClick={() => setShowVectors((v) => !v)} className={`pointer-events-auto rounded-full border px-2.5 py-1.5 ${showVectors ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan' : 'border-panel-border bg-background/75 text-foreground/75'}`}>{t('view.vectors')}</button>
          </div>

          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.86),rgba(9,12,18,0.78))] px-3 py-2 shadow-[0_18px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/55">Status</div>
            <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" aria-hidden="true" />
              stable
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[22rem] rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.86),rgba(9,12,18,0.74))] px-3 py-2 shadow-[0_18px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/55">Flight deck</div>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-foreground/60">{t('view.hint')}</p>
          </div>

          <span className="pointer-events-none absolute right-3 top-20 z-10 rounded-full border border-panel-border bg-background/75 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground/65">{t('notToScale')}</span>
          {engine.state.ids.length === 0 ? <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-foreground/55">{t('emptySpace')}</p> : null}
        </section>

        <aside className="flex flex-col gap-4 rounded-[28px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.96),rgba(8,11,18,0.82))] p-4 shadow-[0_18px_50px_rgba(4,7,14,0.6)]">
          <div className="rounded-[20px] border border-panel-border bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">{presetName}</h2>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200">live</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/55">{override?.kind === 'catalog' ? t('catalogNote') : t(`notes.${engine.info.note}`)}</p>
            {override?.kind === 'catalog' ? (
              <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-star-gold">
                <p>{t('catalogLoaded', { name: override.title ?? '' })}</p>
                {override.assumptions && override.assumptions.length > 0 ? <p>{t('assumptions', { list: override.assumptions.join(', ') })}</p> : null}
                <p>{t('unverified')}</p>
                <Link href="/catalog" className="inline-block text-accent-cyan underline">{t('backToCatalog')}</Link>
              </div>
            ) : null}
          </div>

          {override?.note === 'impact' ? (
            <label className="grid gap-1 text-xs text-foreground/60">
              {t('impactTargetLabel')}
              <select
                aria-label={t('impactTargetLabel')}
                value={impactTargetId}
                onChange={(event) => onImpactTargetChange(event.target.value as ImpactTargetId)}
                className="rounded-2xl border border-accent-cyan/40 bg-background px-3 py-2 text-sm text-foreground"
              >
                {IMPACT_TARGET_IDS.map((id) => <option key={id} value={id}>{bodyNames(id)}</option>)}
              </select>
            </label>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-white/[0.02] px-3 py-2 text-xs text-foreground transition hover:border-accent-cyan/50 hover:text-accent-cyan">
              {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
              {playing ? t('pause') : t('run')}
            </button>
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-white/[0.02] px-3 py-2 text-xs text-foreground transition hover:border-accent-cyan/50 hover:text-accent-cyan">
              <RotateCcw size={14} aria-hidden />{t('reset')}
            </button>
          </div>

          <label className="grid gap-1 text-xs text-foreground/60">
            {t('speed')}
            <select aria-label={t('speed')} value={speed} onChange={(event) => setSpeed(Number(event.target.value) as SandboxSpeed)} className="rounded-2xl border border-panel-border bg-background px-3 py-2 font-mono text-sm text-foreground">
              {SANDBOX_SPEEDS.map((option) => <option key={option} value={option}>{option}×</option>)}
            </select>
          </label>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[18px] border border-panel-border bg-white/[0.02] p-3 text-xs">
            <dt className="text-foreground/55">{t('elapsed')}</dt><dd className="text-right font-mono">{snapshot.elapsedDays.toFixed(4)} d</dd>
            <dt className="text-foreground/55">{t('energyDrift')}</dt><dd className="text-right font-mono">{snapshot.energyAvailable ? formatDrift(snapshot.energyDriftPercent) : t('notAvailable')}</dd>
            <dt className="text-foreground/55">{t('angularMomentumDrift')}</dt><dd className="text-right font-mono">{snapshot.energyAvailable ? formatDrift(snapshot.angularMomentumDriftPercent) : t('notAvailable')}</dd>
            <dt className="text-foreground/55">{t('bodyCount')}</dt><dd className="text-right font-mono">{engine.state.ids.length}</dd>
          </dl>

          {selectedId ? (
            <div className="border-t border-panel-border pt-3 text-xs" aria-live="polite">
              <h3 className="font-semibold text-accent-cyan">{t('orbit.title', { name: selectedId })}</h3>
              {readout ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <dt className="text-foreground/55">{t('orbit.distance')}</dt><dd className="text-right font-mono">{formatDistanceAu(readout.distanceAu)}</dd>
                  <dt className="text-foreground/55">{t('orbit.speed')}</dt><dd className="text-right font-mono">{readout.speedKmS.toPrecision(4)} km/s</dd>
                  <dt className="text-foreground/55">{t('orbit.status')}</dt><dd className={`text-right font-mono ${readout.bound ? 'text-accent-cyan' : 'text-star-gold'}`}>{readout.bound ? t('orbit.bound') : t('orbit.unbound')}</dd>
                  <dt className="text-foreground/55">{t('orbit.eccentricity')}</dt><dd className="text-right font-mono">{readout.eccentricity.toPrecision(4)}</dd>
                  {readout.semiMajorAxisAu !== null ? <><dt className="text-foreground/55">{t('orbit.semiMajor')}</dt><dd className="text-right font-mono">{formatDistanceAu(readout.semiMajorAxisAu)}</dd></> : null}
                  {readout.periodDays !== null ? <><dt className="text-foreground/55">{t('orbit.period')}</dt><dd className="text-right font-mono">{readout.periodDays >= 730 ? `${(readout.periodDays / 365.25).toPrecision(4)} ${t('orbit.years')}` : `${readout.periodDays.toPrecision(4)} d`}</dd></> : null}
                  <dt className="text-foreground/55">{t('orbit.periapsis')}</dt><dd className="text-right font-mono">{formatDistanceAu(readout.periapsisAu)}</dd>
                  {readout.apoapsisAu !== null ? <><dt className="text-foreground/55">{t('orbit.apoapsis')}</dt><dd className="text-right font-mono">{formatDistanceAu(readout.apoapsisAu)}</dd></> : null}
                </dl>
              ) : <p className="mt-1 text-foreground/55">{t('orbit.centre')}</p>}
              <p className="mt-2 text-[10px] leading-relaxed text-foreground/40">{t('orbit.note')}</p>
            </div>
          ) : <p className="border-t border-panel-border pt-3 text-xs text-foreground/45">{t('orbit.pickHint')}</p>}

          {drift.length > 1 ? (
            <div className="border-t border-panel-border pt-3 text-xs">
              <h3 className="font-semibold">{t('driftChart')}</h3>
              <svg viewBox="0 0 120 30" className="mt-1 h-8 w-full" role="img" aria-label={t('driftChart')}>
                {(() => {
                  const peak = Math.max(...drift.map((d) => Math.abs(d)), 1e-12);
                  const points = drift.map((d, i) => `${(i / (drift.length - 1)) * 120},${28 - (Math.abs(d) / peak) * 26}`).join(' ');
                  return <polyline points={points} fill="none" stroke="#00f0ff" strokeWidth="1.2" />;
                })()}
              </svg>
              <p className="mt-0.5 font-mono text-[10px] text-foreground/45">max |Δ| = {Math.max(...drift.map((d) => Math.abs(d))).toExponential(2)}%</p>
            </div>
          ) : null}

          {engine.info.impact ? (
            <div className="border-t border-panel-border pt-3 text-xs">
              <h3 className="font-semibold">{t('impactSummary')}</h3>
              <p className="mt-1 text-foreground/45">{t(snapshot.collision ? 'impactEnergyActual' : 'impactEnergyModelled')}</p>
              <p className="mt-1 text-foreground/60">{t('impactEnergy', { value: (impactEnergy ?? 0).toExponential(3) })}</p>
              <p className="mt-1 text-foreground/60">{t('impactMegatons', { value: tntEquivalentMegatons(impactEnergy ?? engine.info.impact.energyJoules).toExponential(3) })}</p>
              <p className="mt-1 text-foreground/60">{t(!engine.info.impact.airburstAssessed ? 'airburstUnsupported' : engine.info.impact.airburstRisk ? 'airburstFlag' : 'noAirburstFlag')}</p>
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
              <p className="mt-1 text-foreground/75">{t('collisionBody', { target: bodyNames(engine.info.collision?.bodyB ?? 'earth'), days: snapshot.collision.elapsedDays.toFixed(4), speed: snapshot.collision.speedKmS.toFixed(1) })}</p>
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
  const searchParams = useSearchParams();
  const catalogId = searchParams.get('catalog');
  const entry = catalogId ? getCatalogEntry(catalogId) : undefined;
  const requestedTarget = searchParams.get('target');
  const initialTarget = IMPACT_TARGET_IDS.find((id) => id === requestedTarget) ?? 'earth';
  const [impactTargetId, setImpactTargetId] = useState<ImpactTargetId>(initialTarget);
  const catalogOverride = useMemo(() => (entry ? catalogScenario(entry, undefined, impactTargetId) : null), [entry, impactTargetId]);
  const presetParam = searchParams.get('preset');
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
        key={fromCatalog ? `catalog:${catalogId}:${impactTargetId}` : `${preset}:${custom.map((body) => body.name).join(',')}`}
        preset={fromCatalog ? 'empty-space' : preset}
        override={override ?? undefined}
        onPresetChange={changePreset}
        impactTargetId={impactTargetId}
        onImpactTargetChange={setImpactTargetId}
      />
      {editing ? (
        <div className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-8">
          <CustomBodyEditor bodies={custom} onChange={setCustom} />
        </div>
      ) : null}
    </>
  );
}
