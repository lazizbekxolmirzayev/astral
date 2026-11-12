'use client';

import dynamic from 'next/dynamic';
import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { focusRing } from '@/components/ui/FocusRing';
import { isWebGLAvailable } from '@/lib/webgl';
import { cn } from '@/lib/utils';
import type { Vec3 } from '@/physics/orbits';
import type { SceneFrame } from '@/mission/sim';

const SimulationScene = dynamic(() => import('./SimulationScene'), { ssr: false, loading: () => null });

let webglProbe: boolean | null = null;
const getSnapshot = () => (webglProbe ??= isWebGLAvailable());
const subscribe = () => () => {};

/** The 3D view of the running simulation. Everything drawn comes from the frame and the spacecraft position it is given. */
export function SimulationPreview({ frame, craft, trail, lost, stageLabel, timeLabel, className }: { frame: SceneFrame; craft: Vec3; trail: Vec3[]; lost: boolean; stageLabel: string; timeLabel: string; className?: string }) {
  const t = useTranslations('mission.sim.scene');
  const webgl = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [resetNonce, setResetNonce] = useState(0);
  const message = (key: string) => <p className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/65">{t(key)}</p>;
  return (
    <div className={cn('relative overflow-hidden rounded-[18px] border border-panel-border bg-[#070a10]', className)}>
      <div role="img" aria-label={t('label')} className="h-[320px] sm:h-[400px] lg:h-[460px]" data-sim-scene data-frame={frame.key}>
        {webgl === false ? message('unavailable') : webgl ? (
          <ErrorBoundary fallback={message('error')}>
            <SimulationScene key={`${frame.key}-${resetNonce}`} frame={frame} craft={craft} trail={trail} lost={lost} />
          </ErrorBoundary>
        ) : message('loading')}
      </div>
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-col gap-1 text-[11px]">
          <span className="rounded-full border border-panel-border bg-background/80 px-2.5 py-0.5 font-semibold" data-sim-stage>{stageLabel}</span>
          <span className="rounded-full border border-panel-border bg-background/80 px-2.5 py-0.5 font-mono text-foreground/80" data-sim-time>{timeLabel}</span>
        </div>
        <button type="button" onClick={() => setResetNonce((value) => value + 1)} aria-label={t('resetView')} title={t('resetView')} className={cn('pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-panel-border bg-background/75', focusRing())}>
          <RotateCcw size={14} />
        </button>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-panel-border px-3 py-1.5 text-[11px] text-foreground/70">
        <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-white" />{t('legendCraft')}</li>
        <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-pink-400" />{t('legendTrail')}</li>
        <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan-300" />{t('legendOrbit')}</li>
        <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-amber-300" />{t('legendTransfer')}</li>
        <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-full border border-emerald-400" />{t('legendTarget')}</li>
        <li className="basis-full">{frame.unit === 'AU' ? t('unitAu') : t('unitRadii')} {t('hint')}</li>
      </ul>
    </div>
  );
}
