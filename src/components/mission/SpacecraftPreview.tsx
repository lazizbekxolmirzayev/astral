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
import { layoutSpacecraft } from '@/mission/spacecraftLayout';
import { ROLE_COLORS } from './SpacecraftScene';

const SpacecraftScene = dynamic(() => import('./SpacecraftScene'), { ssr: false, loading: () => null });

let webglProbe: boolean | null = null;
const getSnapshot = () => (webglProbe ??= isWebGLAvailable());
const subscribe = () => () => {};

/**
 * A 3D view of the design: the shapes come from `layoutSpacecraft` (plain data derived
 * from the mission), so the picture always matches what is installed. Clicking a
 * part selects it in the shared store. Without WebGL it says so; the part lists next
 * to it do the same job.
 */
export function SpacecraftPreview({ mission, selectedId, onSelect, className }: { mission: Mission; selectedId: string | null; onSelect: (itemId: string | null) => void; className?: string }) {
  const t = useTranslations('mission.spacecraft');
  const webgl = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [resetNonce, setResetNonce] = useState(0);
  const layout = useMemo(() => layoutSpacecraft(mission), [mission]);
  const roles = useMemo(() => [...new Set(layout.shapes.map((shape) => shape.role))].filter((role) => role !== 'mast' && role !== 'nozzle'), [layout]);

  return (
    <div className={cn('relative overflow-hidden rounded-[18px] border border-panel-border bg-[#070a10]', className)}>
      <div role="img" aria-label={t('previewLabel')} className="h-[300px] sm:h-[380px] lg:h-[420px]">
        {webgl === false ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/65">{t('previewUnavailable')}</p>
        ) : webgl ? (
          <ErrorBoundary fallback={<p className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/65">{t('previewError')}</p>}>
            <SpacecraftScene key={resetNonce} shapes={layout.shapes} extent={layout.extent} selectedId={selectedId} onSelect={onSelect} />
          </ErrorBoundary>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-foreground/60">{t('previewLoading')}</p>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <ul className="pointer-events-auto flex max-w-[75%] flex-wrap gap-1">
          {roles.map((role) => (
            <li key={role} className="flex items-center gap-1 rounded-full border border-panel-border bg-background/75 px-2 py-0.5 text-[10px] text-foreground/80">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ROLE_COLORS[role] }} />
              {t(`role.${role}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setResetNonce((value) => value + 1)}
          aria-label={t('resetView')}
          title={t('resetView')}
          className={cn('pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-panel-border bg-background/75', focusRing())}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <p className="border-t border-panel-border px-3 py-1.5 text-[11px] text-foreground/65">{t('previewHint')} {t('schematicNote')}</p>
    </div>
  );
}
