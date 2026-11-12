'use client';

import dynamic from 'next/dynamic';
import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { focusRing } from '@/components/ui/FocusRing';
import { isWebGLAvailable } from '@/lib/webgl';
import { cn } from '@/lib/utils';
import type { Mission } from '@/mission';
import { layoutOrbit } from '@/mission/orbitLayout';

const OrbitScene = dynamic(() => import('./OrbitScene'), { ssr: false, loading: () => null });

let webglProbe: boolean | null = null;
const getSnapshot = () => (webglProbe ??= isWebGLAvailable());
const subscribe = () => () => {};

/**
 * The orbit drawn from the mission document: the ellipse is the one the numbers describe
 * (same apsides, same inclination), so editing a parameter changes the picture. Green marks
 * the periapsis, orange the apoapsis; the grey line is the line of nodes in the reference plane.
 */
export function OrbitPreview({ mission, className }: { mission: Mission; className?: string }) {
  const t = useTranslations('mission.orbit');
  const webgl = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [resetNonce, setResetNonce] = useState(0);
  const layout = useMemo(() => layoutOrbit(mission), [mission]);
  const message = (key: string) => <p className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/65">{t(key)}</p>;

  return (
    <div className={cn('relative overflow-hidden rounded-[18px] border border-panel-border bg-[#070a10]', className)}>
      <div role="img" aria-label={t('previewLabel')} className="h-[300px] sm:h-[380px] lg:h-[420px]" data-orbit-preview data-inclination={layout.inclinationDeg}>
        {webgl === false ? message('previewUnavailable') : webgl ? (
          <ErrorBoundary fallback={message('previewError')}>
            <OrbitScene key={resetNonce} layout={layout} />
          </ErrorBoundary>
        ) : message('previewLoading')}
      </div>
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <ul className="pointer-events-auto flex flex-wrap gap-1 text-[10px] text-foreground/80">
          <li className="flex items-center gap-1 rounded-full border border-panel-border bg-background/75 px-2 py-0.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan-300" />{t('legendOrbit')}</li>
          <li className="flex items-center gap-1 rounded-full border border-panel-border bg-background/75 px-2 py-0.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-emerald-400" />{t('legendPeriapsis')}</li>
          <li className="flex items-center gap-1 rounded-full border border-panel-border bg-background/75 px-2 py-0.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-orange-400" />{t('legendApoapsis')}</li>
        </ul>
        <button type="button" onClick={() => setResetNonce((value) => value + 1)} aria-label={t('resetView')} title={t('resetView')} className={cn('pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-panel-border bg-background/75', focusRing())}>
          <RotateCcw size={14} />
        </button>
      </div>
      <p className="border-t border-panel-border px-3 py-1.5 text-[11px] text-foreground/65">
        {t('previewHint')} {layout.unit === 'AU' ? t('unitAu') : t('unitRadii')}{layout.bodyScaled ? ` ${t('bodyScaled')}` : ''}
      </p>
    </div>
  );
}
