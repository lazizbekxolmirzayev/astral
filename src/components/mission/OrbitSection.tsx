'use client';

import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { DESTINATIONS, getDestination } from '@/mission/catalog';
import { setDestination, setOrbit, setSunSynchronousInclination } from '@/mission/edit';
import type { Evaluation } from '@/mission/engine';
import { formatNumber, formatQuantity } from '@/mission/format';
import { getModelCard, type ModelCardId } from '@/mission/modelCards';
import type { Mission } from '@/mission/models/mission';
import { orbitChange, orbitInputs, durationParts, type OrbitField } from '@/mission/orbitView';
import { convert, type UnitSymbol } from '@/mission/units';
import type { Editor } from './hooks';
import { CheckList } from './CheckList';
import { OrbitPreview } from './OrbitPreview';
import { EditNotice, NumberField, Panel, ProvenanceBadge, useText } from './primitives';

const MODELS: ModelCardId[] = ['orbit-geometry', 'transfer-approximation'];

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 text-sm">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="flex items-center gap-2 text-right font-mono">{children}{hint}</dd>
    </div>
  );
}

export function OrbitSection({ mission, evaluation, editor }: { mission: Mission; evaluation: Evaluation; editor: Editor }) {
  const t = useTranslations('mission.orbit');
  const step = useTranslations('mission.overview.step');
  const { locale, text } = useText();
  const destination = getDestination(mission.objective.destinationId);
  const inputs = orbitInputs(mission);
  const details = evaluation.details;
  const orbit = details?.orbit;
  const deltaV = details?.deltaV;
  const locked = mission.status !== 'draft';
  const helio = inputs.heliocentric;
  const distanceUnit: UnitSymbol = helio ? 'AU' : 'km';
  const q = (value: number, from: UnitSymbol, to: UnitSymbol = from) => formatQuantity(convert(value, from, to), to, locale);
  const period = orbit ? durationParts(orbit.period.value) : null;
  const sunSync = orbit?.sunSynchronous ?? null;
  const orbitChecks = evaluation.readiness.groups.find((group) => group.group === 'orbit')?.checks ?? [];

  const field = (kind: OrbitField, label: string) => {
    const range = kind === 'periapsis' ? inputs.periapsis : kind === 'apoapsis' ? inputs.apoapsis : inputs.inclination;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-foreground/60">
            {range.locked ? t('fixedValue', { value: formatNumber(range.min, locale), unit: range.unit === 'deg' ? '°' : range.unit }) : t('allowed', { min: formatNumber(range.min, locale), max: formatNumber(range.max, locale), unit: range.unit === 'deg' ? '°' : range.unit })}
          </p>
        </div>
        <NumberField label={label} value={range.value} min={range.min} max={range.max} step={range.step} unit={range.unit === 'deg' ? '°' : range.unit} onCommit={(value) => editor.apply((m) => setOrbit(m, orbitChange(m, kind, value)))} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('typeTitle')} eyebrow={t('eyebrow')}>
        <p className="mb-3 text-sm text-foreground/70">{t('typeHint')}</p>
        <div role="group" aria-label={t('typeTitle')} className="flex flex-wrap gap-2">
          {DESTINATIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={entry.id === mission.objective.destinationId}
              data-orbit-type={entry.id}
              disabled={locked}
              onClick={() => editor.apply((m) => setDestination(m, entry.id))}
              className={cn('rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.12em] disabled:opacity-40', entry.id === mission.objective.destinationId ? 'border-accent-cyan/55 bg-accent-cyan/12 text-accent-cyan' : 'border-panel-border text-foreground/75 hover:text-foreground', focusRing())}
            >
              {text(entry.name)}
            </button>
          ))}
        </div>
        {destination ? <p className="mt-3 text-sm text-foreground/75">{text(destination.summary)}</p> : null}
        <p className="mt-2 text-xs text-foreground/60">{t('changeResets')}</p>
        <div className="mt-2"><EditNotice error={editor.error} /></div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t('parameters')}>
            {field('periapsis', helio ? t('perihelion') : t('periapsis'))}
            {field('apoapsis', helio ? t('aphelion') : t('apoapsis'))}
            {field('inclination', helio ? t('inclinationEcliptic') : t('inclination'))}
            {sunSync ? (
              <div className="mt-3 rounded-xl border border-panel-border bg-white/[0.02] p-3" data-sun-sync>
                <p className="text-sm font-semibold">{t('sunSyncTitle')}</p>
                {sunSync.requiredInclinationDeg === null ? (
                  <p className="mt-1 text-xs text-amber-200">{t('sunSyncNone')}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-foreground/75">{t('sunSyncRequired', { value: formatNumber(sunSync.requiredInclinationDeg, locale) })}</p>
                    <p className="text-xs text-foreground/75">{t('sunSyncDrift', { value: formatNumber(sunSync.localTimeDriftMinPerDay, locale) })}</p>
                    <button type="button" disabled={locked} onClick={() => editor.apply((m) => setSunSynchronousInclination(m))} className={cn('mt-2 rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan disabled:opacity-40', focusRing())}>
                      {t('sunSyncSet')}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </Panel>

          <Panel title={t('results')}>
            {orbit ? (
              <dl>
                <Row label={helio ? t('perihelionDistance') : t('periapsisRadius')} hint={<ProvenanceBadge provenance={orbit.periapsisRadius.provenance} />}>{q(orbit.periapsisRadius.value, 'm', distanceUnit)}</Row>
                <Row label={helio ? t('aphelionDistance') : t('apoapsisRadius')}>{q(orbit.apoapsisRadius.value, 'm', distanceUnit)}</Row>
                <Row label={t('semiMajorAxis')}>{q(orbit.semiMajorAxis.value, 'm', distanceUnit)}</Row>
                <Row label={t('eccentricity')}>{formatNumber(orbit.eccentricity.value, locale)}</Row>
                <Row label={t('inclinationValue')}>{`${formatNumber(orbit.inclinationDeg, locale)} °`}</Row>
                <Row label={t('period')} hint={<ProvenanceBadge provenance={orbit.period.provenance} />}>{period ? formatQuantity(period.value, period.unit, locale) : '—'}</Row>
                <Row label={t('speedPeriapsis')}>{q(orbit.speedAtPeriapsis.value, 'm/s', 'km/s')}</Row>
                <Row label={t('speedApoapsis')}>{q(orbit.speedAtApoapsis.value, 'm/s', 'km/s')}</Row>
                <Row label={t('speedCircular')}>{q(orbit.circularSpeed.value, 'm/s', 'km/s')}</Row>
              </dl>
            ) : <p role="status" className="text-sm text-amber-200">{t('unavailable')}</p>}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <OrbitPreview mission={mission} />
          <Panel title={t('deltaVTitle')}>
            {deltaV ? (
              <dl data-delta-v>
                {deltaV.steps.map((entry) => (
                  <Row key={entry.id} label={step(entry.id)}>{q(entry.value.value, 'm/s')}</Row>
                ))}
                <Row label={t('deltaVRequired')} hint={<ProvenanceBadge provenance={deltaV.required.provenance} />}>{q(deltaV.required.value, 'm/s')}</Row>
                <Row label={t('deltaVAvailable')}>{q(deltaV.available.value, 'm/s')}</Row>
                {deltaV.departureC3 ? <Row label={t('c3')}>{`${formatNumber(deltaV.departureC3.required.value / 1e6, locale)} / ${q(deltaV.departureC3.provided.value, 'm^2/s^2', 'km^2/s^2')}`}</Row> : null}
                {deltaV.site && deltaV.site.shortfallDeg > 1e-9 ? <Row label={t('sitePlaneChange')}>{q(deltaV.site.extra.value, 'm/s')}</Row> : null}
              </dl>
            ) : <p role="status" className="text-sm text-amber-200">{t('unavailable')}</p>}
          </Panel>
        </div>
      </div>

      <Panel title={t('fitTitle')}>
        <p className="mb-3 text-sm text-foreground/70">{t('fitHint')}</p>
        {orbitChecks.length > 0 ? <CheckList checks={orbitChecks} /> : <p role="status" className="text-sm text-amber-200">{t('unavailable')}</p>}
      </Panel>

      <Panel title={t('modelTitle')}>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
          {MODELS.map((id) => {
            const card = getModelCard(id);
            if (!card) return null;
            return (
              <li key={id} className="rounded-xl border border-panel-border p-3 text-xs" data-model={id}>
                <p className="text-sm font-semibold">{text(card.title)}</p>
                <p className="mt-0.5 text-foreground/70">{text(card.scope)}</p>
                <p className="mt-2 font-semibold text-foreground/80">{t('equations')}</p>
                <ul className="mt-0.5 space-y-0.5 font-mono text-[11px] text-foreground/75">{card.equations.map((equation) => <li key={equation}>{equation}</li>)}</ul>
                <p className="mt-2 font-semibold text-foreground/80">{t('assumptions')}</p>
                <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-foreground/75">{card.assumptions.map((item) => <li key={item.en}>{text(item)}</li>)}</ul>
                <p className="mt-2 font-semibold text-foreground/80">{t('limitations')}</p>
                <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-foreground/75">{card.limitations.map((item) => <li key={item.en}>{text(item)}</li>)}</ul>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
