'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { getDestination } from '@/mission/catalog';
import type { Mission } from '@/mission/models/mission';
import { missionStore, useMissionStore } from '@/stores/missionStore';
import { useEditor, useEvaluation, useMission } from './hooks';
import { LiveResourcePanel, ResourceBar } from './LiveResourcePanel';
import { LaunchSection } from './LaunchSection';
import { OrbitSection } from './OrbitSection';
import { ReadinessSection } from './ReadinessSection';
import { SimulationSection } from './SimulationSection';
import { OverviewSection } from './OverviewSection';
import { PayloadSection } from './PayloadSection';
import { ToneIcon, useText } from './primitives';
import { RequirementsSection } from './RequirementsSection';
import { ResourcesSection } from './ResourcesSection';
import { SpacecraftSection } from './SpacecraftSection';
import { TONE_STYLES } from './tone';
import { buildIndicators } from '@/mission/view';

export const WORKSPACE_TABS = ['overview', 'spacecraft', 'payload', 'orbit', 'launch', 'resources', 'requirements', 'readiness', 'simulation'] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** Layout classes, exported so the responsive contract can be tested without a browser. */
export const WORKSPACE_CLASSES = {
  main: 'mx-auto w-full max-w-[1500px] px-3 pb-28 pt-4 sm:px-6 lg:pb-8',
  grid: 'grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]',
  tabs: 'flex gap-1.5 overflow-x-auto pb-1',
  aside: 'hidden lg:sticky lg:top-20 lg:block lg:self-start',
} as const;

function Workspace({ mission, initialTab }: { mission: Mission; initialTab: WorkspaceTab }) {
  const t = useTranslations('mission');
  const { text } = useText();
  const evaluation = useEvaluation(mission);
  const editor = useEditor(mission.id);
  const selectedPartId = useMissionStore((state) => state.selectedPartId);
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const destination = getDestination(mission.objective.destinationId);
  const readiness = buildIndicators(evaluation).find((indicator) => indicator.id === 'readiness');
  const readinessTone = readiness?.tone ?? 'critical';
  const selectPart = (itemId: string | null) => missionStore.getState().selectPart(itemId);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? WORKSPACE_TABS.length - 1 : (index + step + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    const id = WORKSPACE_TABS[next] as WorkspaceTab;
    setTab(id);
    refs.current[id]?.focus();
  };

  return (
    <main className={WORKSPACE_CLASSES.main}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-panel-border bg-[linear-gradient(135deg,rgba(12,17,27,0.98),rgba(8,12,18,0.92))] px-4 py-3">
        <div className="min-w-0">
          <Link href="/missions" className={cn('inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-foreground/60 hover:text-accent-cyan', focusRing())}>
            <ArrowLeft size={12} aria-hidden /> {t('workspace.backToCenter')}
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{mission.title}</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/60">
            {destination ? text(destination.name) : mission.objective.destinationId} · {t(`status.${mission.status}`)} · {t('center.revision', { revision: mission.revision })}
          </p>
        </div>
        <span className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', TONE_STYLES[readinessTone].border, TONE_STYLES[readinessTone].surface, TONE_STYLES[readinessTone].text)} data-tone={readinessTone}>
          <ToneIcon tone={readinessTone} />
          {t(`readiness.${evaluation.status}`)}
        </span>
      </header>

      <div className={WORKSPACE_CLASSES.grid}>
        <div className="min-w-0">
          <div role="tablist" aria-label={t('workspace.sections')} className={WORKSPACE_CLASSES.tabs}>
            {WORKSPACE_TABS.map((id, index) => (
              <button
                key={id}
                ref={(node) => { refs.current[id] = node; }}
                role="tab"
                id={`mission-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`mission-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn('shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors', tab === id ? 'border-accent-cyan/50 bg-accent-cyan/12 text-accent-cyan' : 'border-panel-border text-foreground/70 hover:text-foreground', focusRing())}
              >
                {t(`tab.${id}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`mission-panel-${tab}`} aria-labelledby={`mission-tab-${tab}`} className="mt-3" tabIndex={0}>
            {tab === 'overview' ? <OverviewSection mission={mission} evaluation={evaluation} editor={editor} /> : null}
            {tab === 'spacecraft' ? <SpacecraftSection mission={mission} editor={editor} selectedPartId={selectedPartId} onSelectPart={selectPart} /> : null}
            {tab === 'payload' ? <PayloadSection mission={mission} evaluation={evaluation} editor={editor} selectedPartId={selectedPartId} onSelectPart={selectPart} /> : null}
            {tab === 'orbit' ? <OrbitSection mission={mission} evaluation={evaluation} editor={editor} /> : null}
            {tab === 'launch' ? <LaunchSection mission={mission} evaluation={evaluation} editor={editor} /> : null}
            {tab === 'resources' ? <ResourcesSection evaluation={evaluation} /> : null}
            {tab === 'requirements' ? <RequirementsSection mission={mission} evaluation={evaluation} editor={editor} /> : null}
            {tab === 'readiness' ? <ReadinessSection evaluation={evaluation} /> : null}
            {tab === 'simulation' ? <SimulationSection mission={mission} evaluation={evaluation} editor={editor} /> : null}
          </div>
        </div>

        <aside className={WORKSPACE_CLASSES.aside} aria-label={t('panel.title')}>
          <LiveResourcePanel evaluation={evaluation} />
        </aside>
      </div>

      <ResourceBar evaluation={evaluation} />
    </main>
  );
}

/** The mission workspace for one mission id; explains itself when the mission is not in this session. */
export function MissionWorkspace({ missionId, initialTab = 'overview' }: { missionId: string; initialTab?: WorkspaceTab }) {
  const t = useTranslations('mission.center');
  const mission = useMission(missionId);
  if (!mission) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">{t('notFound')}</h1>
        <p className="text-sm text-foreground/70">{t('notFoundHint')}</p>
        <Link href="/missions" className={cn('rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-4 py-2 text-sm text-accent-cyan', focusRing())}>{t('title')}</Link>
      </main>
    );
  }
  return <Workspace mission={mission} initialTab={initialTab} />;
}
