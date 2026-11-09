'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { DESTINATIONS, getDestination, getLauncher } from '@/mission/catalog';
import type { DestinationId } from '@/mission/models/catalog';
import { DEFAULT_MISSION_TITLES } from '@/mission/templates/defaults';
import { buildIndicators } from '@/mission/view';
import { missionStore, useMissionStore } from '@/stores/missionStore';
import { useEvaluation } from './hooks';
import { Panel, ToneIcon, useText } from './primitives';
import { TONE_STYLES } from './tone';
import type { Mission } from '@/mission/models/mission';

function MissionCard({ mission }: { mission: Mission }) {
  const t = useTranslations('mission');
  const { locale, text } = useText();
  const evaluation = useEvaluation(mission);
  const tone = buildIndicators(evaluation).find((indicator) => indicator.id === 'readiness')?.tone ?? 'critical';
  const [confirming, setConfirming] = useState(false);
  const destination = getDestination(mission.objective.destinationId);
  const launcher = getLauncher(mission.launch.vehicleId);
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(mission.updatedAt));

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-white/[0.02] p-4" data-mission={mission.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/missions/${mission.id}`} className={cn('block truncate text-base font-semibold hover:text-accent-cyan', focusRing())}>{mission.title}</Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/60">{destination ? text(destination.name) : mission.objective.destinationId} · {t(`status.${mission.status}`)}</p>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', TONE_STYLES[tone].border, TONE_STYLES[tone].surface, TONE_STYLES[tone].text)} data-tone={tone}>
          <ToneIcon tone={tone} />{t(`readiness.${evaluation.status}`)}
        </span>
      </div>
      <p className="text-xs text-foreground/65">{t('center.launcher')}: {launcher ? text(launcher.name) : mission.launch.vehicleId} · {t('center.revision', { revision: mission.revision })} · {t('center.updated', { time: updated })}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={`/missions/${mission.id}`} className={cn('rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-3 py-1 text-xs font-medium text-accent-cyan', focusRing())}>{t('center.open')}</Link>
        <button type="button" onClick={() => missionStore.getState().duplicate(mission.id, t('center.copyOf', { title: mission.title }))} className={cn('rounded-full border border-panel-border px-3 py-1 text-xs', focusRing())}>{t('center.duplicate')}</button>
        {confirming ? (
          <>
            <button type="button" onClick={() => missionStore.getState().remove(mission.id)} className={cn('rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs text-red-200', focusRing())}>{t('center.confirmDelete')}</button>
            <button type="button" onClick={() => setConfirming(false)} className={cn('rounded-full border border-panel-border px-3 py-1 text-xs', focusRing())}>{t('center.cancel')}</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={cn('rounded-full border border-panel-border px-3 py-1 text-xs text-foreground/70', focusRing())}>{t('center.delete')}</button>
        )}
      </div>
    </li>
  );
}

export function MissionCenter() {
  const t = useTranslations('mission.center');
  const { text } = useText();
  const router = useRouter();
  const order = useMissionStore((state) => state.order);
  const missions = useMissionStore((state) => state.missions);

  const open = (id: string) => router.push(`/missions/${id}`);
  const titleFor = (destinationId: DestinationId) => text(DEFAULT_MISSION_TITLES[destinationId]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8">
      <header className="relative overflow-hidden rounded-[26px] border border-panel-border bg-[radial-gradient(circle_at_12%_20%,rgba(0,240,255,0.22),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(108,92,231,0.2),transparent_30%),linear-gradient(135deg,rgba(12,17,27,0.98),rgba(8,12,18,0.92))] p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-cyan">{t('eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/70 sm:text-base">{t('subtitle')}</p>
        <p role="note" className="mt-4 max-w-2xl rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">{t('guestNote')}</p>
      </header>

      <Panel title={t('yourMissions')} eyebrow={String(order.length).padStart(2, '0')}>
        {order.length === 0 ? (
          <div className="flex flex-col items-start gap-1">
            <p className="text-sm font-semibold">{t('noMissions')}</p>
            <p className="text-sm text-foreground/65">{t('noMissionsHint')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {order.map((id) => (missions[id] ? <MissionCard key={id} mission={missions[id]} /> : null))}
          </ul>
        )}
      </Panel>

      <Panel title={t('templates')}>
        <p className="mb-3 text-sm text-foreground/70">{t('templatesHint')}</p>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.map((destination) => (
            <li key={destination.id} className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-white/[0.02] p-4" data-template={destination.id}>
              <p className="flex items-center gap-2 text-base font-semibold"><Rocket size={15} className="text-accent-cyan" aria-hidden />{text(destination.name)}</p>
              <p className="text-xs text-foreground/65">{text(destination.summary)}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => open(missionStore.getState().createFromTemplate(destination.id, titleFor(destination.id)))} className={cn('rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan', focusRing())}>
                  {t('useTemplate')}
                </button>
                <button type="button" onClick={() => open(missionStore.getState().createBlank(destination.id, t('newMissionTitle', { destination: text(destination.name) })))} className={cn('flex items-center gap-1 rounded-full border border-panel-border px-3 py-1.5 text-xs', focusRing())}>
                  <Plus size={12} aria-hidden />{t('createBlank')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-foreground/60">{t('blankHint')}</p>
      </Panel>
    </main>
  );
}
