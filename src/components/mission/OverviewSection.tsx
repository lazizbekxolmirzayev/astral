'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { DESTINATIONS, LAUNCHERS, getDestination, getLaunchTarget } from '@/mission/catalog';
import { renameMission, setDestination, setLauncher, setOperationsDays, setOrbit } from '@/mission/edit';
import type { Evaluation } from '@/mission/engine';
import { formatQuantity } from '@/mission/format';
import type { Mission } from '@/mission/models/mission';
import { valueIn } from '@/mission/units';
import { IssueList } from './IssueList';
import type { Editor } from './hooks';
import { EditNotice, NumberField, Panel, useText } from './primitives';

function RadioCard({ selected, onSelect, title, body, disabled }: { selected: boolean; onSelect: () => void; title: string; body?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn('rounded-xl border px-3 py-2 text-left transition-colors', focusRing(), selected ? 'border-accent-cyan/60 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02] hover:border-accent-cyan/35', disabled && 'cursor-not-allowed opacity-50')}
    >
      <span className="block text-sm font-semibold">{title}</span>
      {body ? <span className="mt-0.5 block text-xs text-foreground/65">{body}</span> : null}
    </button>
  );
}

export function OverviewSection({ mission, evaluation, editor }: { mission: Mission; evaluation: Evaluation; editor: Editor }) {
  const t = useTranslations('mission.overview');
  const w = useTranslations('mission.workspace');
  const { locale, text } = useText();
  const [title, setTitle] = useState(mission.title);
  const destination = getDestination(mission.objective.destinationId);
  const locked = mission.status !== 'draft';
  const deltaV = evaluation.details?.deltaV;
  const stepLabel = useTranslations('mission.overview.step');
  const status = useTranslations('mission.status');

  return (
    <div className="flex flex-col gap-4">
      {locked ? <p role="status" className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-200">{w('editsLocked', { status: status(mission.status) })}</p> : null}
      <EditNotice error={editor.error} />

      <Panel title={t('issues')} eyebrow={t('crumb')}>
        <IssueList evaluation={evaluation} />
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={t('identity')}>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              editor.apply((m) => renameMission(m, title));
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-foreground/70">
              {w('missionName')}
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} disabled={locked} className={cn('rounded-md border border-panel-border bg-background/70 px-2 py-1.5 text-sm text-foreground', focusRing())} />
            </label>
            <button type="submit" disabled={locked} className={cn('rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan', focusRing())}>{w('rename')}</button>
          </form>
        </Panel>

        <Panel title={t('orbit')}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 text-xs text-foreground/70">
              <span>{t('periapsis')}</span>
              <NumberField label={t('periapsis')} value={mission.orbit.periapsisAltKm} min={0} onCommit={(value) => editor.apply((m) => setOrbit(m, { periapsisAltKm: value }))} unit={t('km')} />
            </div>
            <div className="flex flex-col gap-1 text-xs text-foreground/70">
              <span>{t('apoapsis')}</span>
              <NumberField label={t('apoapsis')} value={mission.orbit.apoapsisAltKm} min={0} onCommit={(value) => editor.apply((m) => setOrbit(m, { apoapsisAltKm: value }))} unit={t('km')} />
            </div>
            <div className="flex flex-col gap-1 text-xs text-foreground/70">
              <span>{t('inclination')}</span>
              <NumberField label={t('inclination')} value={mission.orbit.inclinationDeg} min={0} max={180} step={0.1} onCommit={(value) => editor.apply((m) => setOrbit(m, { inclinationDeg: value }))} unit="°" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-xs text-foreground/70">
            <span>{t('operations')}</span>
            <NumberField label={t('operations')} value={mission.plannedOperationsDays} min={1} max={10000} onCommit={(value) => editor.apply((m) => setOperationsDays(m, Math.round(value)))} unit={t('days')} />
          </div>
        </Panel>
      </div>

      <Panel title={t('destination')}>
        <div role="radiogroup" aria-label={t('destination')} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {DESTINATIONS.map((candidate) => (
            <RadioCard key={candidate.id} selected={candidate.id === mission.objective.destinationId} onSelect={() => editor.apply((m) => setDestination(m, candidate.id))} title={text(candidate.name)} body={text(candidate.summary)} disabled={locked} />
          ))}
        </div>
        <p className="mt-2 text-xs text-foreground/60">{t('destinationHint')}</p>
      </Panel>

      <Panel title={t('launcher')}>
        <div role="radiogroup" aria-label={t('launcher')} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {LAUNCHERS.map((launcher) => {
            const target = destination ? getLaunchTarget(destination.deliveryTarget) : undefined;
            const capacity = destination ? launcher.capacity[destination.deliveryTarget] : undefined;
            const body = capacity && target ? t('launcherCapacity', { mass: formatQuantity(valueIn(capacity, 'kg'), 'kg', locale), target: text(target.name) }) : t('launcherCannot');
            return <RadioCard key={launcher.id} selected={launcher.id === mission.launch.vehicleId} onSelect={() => editor.apply((m) => setLauncher(m, launcher.id))} title={text(launcher.name)} body={body} disabled={locked} />;
          })}
        </div>
      </Panel>

      {deltaV ? (
        <Panel title={t('deltaVBudget')}>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {deltaV.steps.map((step) => (
              <div key={step.id} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-0.5">
                <dt className="text-foreground/70">{stepLabel(step.id)}</dt>
                <dd className="font-mono">{formatQuantity(step.value.value, 'm/s', locale)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-0.5 font-semibold">
              <dt>{t('withMargin')}</dt>
              <dd className="font-mono">{formatQuantity(deltaV.required.value, 'm/s', locale)}</dd>
            </div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}
