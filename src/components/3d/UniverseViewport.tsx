'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Box } from 'lucide-react';
import { isWebGLAvailable } from '@/lib/webgl';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useSelectionStore } from '@/stores/selectionStore';
import { SCALE_LEVELS } from './layout';

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
  // null = not probed yet; the probe needs a DOM, so it cannot run on the server.
  const webglOk = useSyncExternalStore(nothingToSubscribeTo, getWebglSnapshot, () => null);
  const [sceneReady, setSceneReady] = useState(false);
  const scale = useSelectionStore((state) => state.scale);
  const setScale = useSelectionStore((state) => state.setScale);

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
          {/* Opposite corners: the hint is wide and would collide with the
              badge on narrow viewports. */}
          <div role="radiogroup" aria-label={t('scale.label')} className="absolute left-3 top-3 z-10 flex gap-1 rounded-md border border-panel-border bg-background/75 p-1 backdrop-blur">
            {SCALE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={scale === level}
                onClick={() => setScale(level)}
                className={`rounded px-2.5 py-1 text-[11px] transition-colors ${scale === level ? 'bg-accent-cyan/20 text-accent-cyan' : 'text-foreground/60 hover:text-foreground'}`}
              >
                {t(`scale.${level}`)}
              </button>
            ))}
          </div>
          {scale !== 'system' ? (
            <p className="pointer-events-none absolute left-3 top-14 z-10 max-w-[22rem] rounded border border-panel-border bg-background/70 px-2 py-1 font-mono text-[10px] leading-relaxed text-star-gold">
              {t(`scale.${scale}Note`)}
            </p>
          ) : null}
          <p className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[19rem] font-mono text-[10px] leading-relaxed text-foreground/40">
            {t('viewport.controlsHint')}
          </p>
          <span className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded border border-panel-border bg-background/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
            <Box size={11} aria-hidden />
            {t('viewport.notToScale')}
          </span>
        </>
      ) : null}
    </div>
  );
}
