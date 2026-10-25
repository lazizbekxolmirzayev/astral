'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Box, Radio } from 'lucide-react';
import { isWebGLAvailable } from '@/lib/webgl';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useSelectionStore } from '@/stores/selectionStore';
import { SCALE_LEVELS } from './layout';
import { PulsarExperience } from '../ui/PulsarExperience';

const SceneCanvas = dynamic(() => import('../3d/SceneCanvas'), {
  ssr: false,
  loading: () => null,
});

// Probed once and cached: browser WebGL support cannot change mid-session, and
// the probe allocates a throwaway canvas.
let webglProbe: boolean | null = null;

function getWebglSnapshot(): boolean | null {
  if (webglProbe === null) webglProbe = isWebGLAvailable();
  return webglProbe;
}

const nothingToSubscribeTo = () => () => {};

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <AlertTriangle size={20} className="text-star-gold" aria-hidden />
      <p className="max-w-sm text-sm text-foreground/60">{children}</p>
    </div>
  );
}

export function UniverseViewport() {
  const t = useTranslations();
  const pulsarText = useTranslations('pulsar');
  // null = not probed yet; the probe needs a DOM, so it cannot run on the server.
  const webglOk = useSyncExternalStore(nothingToSubscribeTo, getWebglSnapshot, () => null);
  const [sceneReady, setSceneReady] = useState(false);
  const scale = useSelectionStore((state) => state.scale);
  const selectedId = useSelectionStore((state) => state.selectedId);
  const hoveredId = useSelectionStore((state) => state.hoveredId);
  const setScale = useSelectionStore((state) => state.setScale);
  const select = useSelectionStore((state) => state.select);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== 'galaxy') return;
    setScale('galaxy');
    const selected = params.get('select');
    if (selected === 'vela-pulsar' || selected === 'crab-pulsar') select(selected);
  }, [select, setScale]);

  if (webglOk === false) {
    return (
      <div className="relative min-h-0 flex-1 bg-background">
        <Notice>{t('viewport.webglUnsupported')}</Notice>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <ErrorBoundary fallback={<Notice>{t('viewport.sceneError')}</Notice>}>
        {webglOk ? (
          <SceneCanvas onReady={() => setSceneReady(true)} />
        ) : null}
      </ErrorBoundary>

      {/* Kept until the first frame exists, so the corner never shows a hole. */}
      {sceneReady ? null : <Notice>{t('viewport.loading')}</Notice>}

      {sceneReady ? (
        <>
          {scale === 'galaxy' ? <PulsarExperience /> : null}
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_left,_rgba(0,240,255,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(108,92,231,0.08),transparent_28%)]" />

          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.9),rgba(9,12,18,0.8))] p-2 shadow-[0_18px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/55">System</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-200">Live</span>
            </div>
            <div className="flex items-center gap-1.5">
            <div role="radiogroup" aria-label={t('scale.label')} className="flex gap-1 rounded-full border border-panel-border bg-background/70 p-1">
              {SCALE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={scale === level}
                  onClick={() => setScale(level)}
                  className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-all ${scale === level ? 'bg-accent-cyan/20 text-accent-cyan shadow-[0_0_18px_rgba(0,240,255,0.12)]' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  {t(`scale.${level}`)}
                </button>
              ))}
            </div>
              <button
                type="button"
                onClick={() => { setScale('galaxy'); select('vela-pulsar'); }}
                aria-label={pulsarText('open')}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 transition-colors hover:bg-cyan-300/20"
              >
                <Radio size={12} aria-hidden />{pulsarText('button')}
              </button>
            </div>
          </div>

          {scale !== 'system' ? (
            <p className="pointer-events-none absolute left-3 top-[5.9rem] z-20 max-w-[22rem] rounded-2xl border border-panel-border bg-background/75 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-star-gold backdrop-blur-sm">
              {t(`scale.${scale}Note`)}
            </p>
          ) : null}

          <div className="pointer-events-none absolute right-3 top-3 z-20 w-[15.5rem] rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.9),rgba(9,12,18,0.8))] p-3 shadow-[0_18px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/55">Target</span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/50">
                <Box size={10} aria-hidden />
                {t('viewport.notToScale')}
              </span>
            </div>
            <div className="mt-2 rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent-cyan">
              {selectedId ?? hoveredId ?? 'SOLAR SYSTEM'}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] uppercase tracking-[0.18em] text-foreground/50">
              <div className="rounded-lg border border-panel-border bg-white/[0.02] px-2 py-1.5">Mode <span className="mt-1 block text-[10px] text-foreground/75">{scale}</span></div>
              <div className="rounded-lg border border-panel-border bg-white/[0.02] px-2 py-1.5">Status <span className="mt-1 block text-[10px] text-emerald-300">Stable</span></div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[22rem] rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(12,17,27,0.86),rgba(9,12,18,0.76))] p-3 shadow-[0_18px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/55">Flight deck</div>
            <p className="font-mono text-[10px] leading-relaxed text-foreground/60">
              {t('viewport.controlsHint')}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
