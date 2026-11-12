'use client';

import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { getDestination } from '@/mission/catalog';
import { setLauncher, setLaunchSite } from '@/mission/edit';
import type { Evaluation } from '@/mission/engine';
import { formatNumber, formatPercent, formatQuantity } from '@/mission/format';
import { compareLaunchers, compareSites, formatCoordinate } from '@/mission/launchView';
import type { Mission } from '@/mission/models/mission';
import { CheckList, StatusChip } from './CheckList';
import { EditNotice, Panel, ProvenanceBadge, useText } from './primitives';
import { SiteMap } from './SiteMap';
import { TONE_STYLES, barPercent } from './tone';

export function LaunchSection({ mission, evaluation, editor }: { mission: Mission; evaluation: Evaluation; editor: import('./hooks').Editor }) {
  const t = useTranslations('mission.launch');
  const { locale, text } = useText();
  const destination = getDestination(mission.objective.destinationId);
  const locked = mission.status !== 'draft';
  const launchers = compareLaunchers(mission, evaluation);
  const sites = compareSites(mission);
  const launchMass = evaluation.details?.mass.launch.value ?? null;
  const groups = evaluation.readiness.groups.filter((group) => group.group === 'launch-vehicle' || group.group === 'launch-site');
  const checks = groups.flatMap((group) => group.checks);
  const chosenSite = sites.find((row) => row.selected);

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('vehiclesTitle')} eyebrow={t('eyebrow')}>
        <p className="mb-1 text-sm text-foreground/70">{t('vehiclesHint', { target: destination ? text(destination.name) : mission.objective.destinationId })}</p>
        <p className="mb-3 text-xs text-foreground/60">{launchMass === null ? t('massUnknown') : t('massNow', { mass: formatQuantity(launchMass, 'kg', locale) })}</p>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {launchers.map((row) => {
            const tone = row.capacityKg === null ? 'critical' : row.fits ? (row.margin !== null && row.margin < 0.1 ? 'warning' : 'normal') : 'critical';
            const fill = row.capacityKg && launchMass !== null ? barPercent(launchMass / row.capacityKg) : 0;
            return (
              <li key={row.launcher.id} data-launcher={row.launcher.id} data-selected={row.selected} className={cn('flex flex-col gap-2 rounded-2xl border p-4', row.selected ? 'border-accent-cyan/55 bg-accent-cyan/[0.06]' : 'border-panel-border bg-white/[0.02]')}>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan/80">{t(`sizeClass.${row.launcher.sizeClass}`)}</p>
                  <p className="text-base font-semibold">{text(row.launcher.name)}</p>
                  <p className="mt-0.5 text-xs text-foreground/70">{text(row.launcher.summary)}</p>
                </div>
                <dl className="text-xs">
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5">
                    <dt className="text-foreground/65">{t('capacity')}</dt>
                    <dd className="flex items-center gap-1.5 font-mono">{row.capacityKg === null ? t('cannotReach') : formatQuantity(row.capacityKg, 'kg', locale)}{row.capacityKg === null ? null : <ProvenanceBadge provenance={row.launcher.capacity[destination?.deliveryTarget ?? 'leo']?.provenance ?? 'estimated'} />}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5">
                    <dt className="text-foreground/65">{t('price')}</dt>
                    <dd className="flex items-center gap-1.5 font-mono">{formatQuantity(row.costMusd, 'MUSD', locale)}<ProvenanceBadge provenance={row.launcher.cost.provenance} /></dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5">
                    <dt className="text-foreground/65">{t('reliability')}</dt>
                    <dd className="flex items-center gap-1.5 font-mono">{formatPercent(row.reliability, locale)}<ProvenanceBadge provenance={row.launcher.reliability.provenance} /></dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 py-0.5">
                    <dt className="text-foreground/65">{t('margin')}</dt>
                    <dd className={cn('font-mono', TONE_STYLES[tone].text)}>{row.margin === null ? '—' : formatPercent(row.margin, locale)}</dd>
                  </div>
                </dl>
                {row.capacityKg !== null ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="presentation"><div className={cn('h-full', TONE_STYLES[tone].bar)} style={{ width: `${fill}%` }} /></div>
                ) : null}
                <p className={cn('text-xs', row.fits ? 'text-emerald-200' : 'text-red-200')} role="status">{row.capacityKg === null ? t('noTarget') : row.fits ? t('fits') : t('tooHeavy')}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">{t('reaches')}</p>
                  <ul className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-foreground/75">
                    {row.capacities.map((entry) => <li key={entry.target.id}>{t(`target.${entry.target.id}`)}: <span className="font-mono">{formatQuantity(entry.capacityKg, 'kg', locale)}</span></li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">{t('launchesFrom')}</p>
                  <p className="text-[11px] text-foreground/75">{row.sites.map((site) => text(site.name)).join(', ')}</p>
                </div>
                <p className="text-[10px] text-foreground/55">{t('assignmentNote')}</p>
                <button type="button" disabled={locked || row.selected} aria-pressed={row.selected} onClick={() => editor.apply((m) => setLauncher(m, row.launcher.id))} className={cn('mt-auto rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-60', row.selected ? 'border-accent-cyan/55 text-accent-cyan' : 'border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan', focusRing())}>
                  {row.selected ? t('selected') : t('choose')}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2"><EditNotice error={editor.error} /></div>
      </Panel>

      <Panel title={t('sitesTitle')}>
        <p className="mb-3 text-sm text-foreground/70">{t('sitesHint')}</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <SiteMap rows={sites} disabled={locked} onSelect={(siteId) => editor.apply((m) => setLaunchSite(m, siteId))} />
            <p className="text-[11px] text-foreground/60">{t('mapNote')}</p>
            {chosenSite ? <p className="text-xs text-foreground/75">{t('chosenSite', { name: text(chosenSite.site.name) })}</p> : null}
          </div>
          <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {sites.map((row) => (
              <li key={row.site.id} data-site={row.site.id} data-selected={row.selected} className={cn('flex flex-col gap-1.5 rounded-2xl border p-3 text-xs', row.selected ? 'border-accent-cyan/55 bg-accent-cyan/[0.06]' : 'border-panel-border bg-white/[0.02]')}>
                <div>
                  <p className="text-sm font-semibold">{text(row.site.name)}</p>
                  <p className="text-foreground/60">{text(row.site.country)}</p>
                </div>
                <p className="text-foreground/75">{text(row.site.summary)}</p>
                <dl>
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5">
                    <dt className="text-foreground/65">{t('coordinates')}</dt>
                    <dd className="flex items-center gap-1.5 font-mono">{formatCoordinate(row.latitudeDeg, 'lat')}, {formatCoordinate(row.longitudeDeg, 'lon')}<ProvenanceBadge provenance={row.site.latitude.provenance} /></dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5">
                    <dt className="text-foreground/65">{t('corridor')}</dt>
                    <dd className="flex items-center gap-1.5 font-mono">{formatNumber(row.minInclinationDeg, locale)}–{formatNumber(row.maxInclinationDeg, locale)} °<ProvenanceBadge provenance={row.site.inclinationRange.min.provenance} /></dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 py-0.5">
                    <dt className="text-foreground/65">{t('hostsVehicle')}</dt>
                    <dd>{row.site.launcherIds.length > 0 ? row.site.launcherIds.map((id) => launchers.find((entry) => entry.launcher.id === id)).map((entry) => entry ? text(entry.launcher.name) : '').join(', ') : '—'}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center gap-2" data-site-effect={row.reach.kind}>
                  {row.reach.kind === 'orbit' ? (
                    <>
                      <StatusChip status={row.reach.status} />
                      <span className="text-foreground/80">{row.reach.shortfallDeg <= 1e-9 ? t('effectDirect', { inclination: formatNumber(mission.orbit.inclinationDeg, locale) }) : t('effectShort', { delivered: formatNumber(row.reach.deliveryDeg, locale), shortfall: formatNumber(row.reach.shortfallDeg, locale) })}</span>
                    </>
                  ) : row.reach.kind === 'geostationary' ? (
                    <span className="text-foreground/80">{t('effectGeo', { delivered: formatNumber(row.reach.deliveryDeg, locale) })}</span>
                  ) : (
                    <span className="text-foreground/80">{t('effectEscape')}</span>
                  )}
                </div>
                <p className={cn('text-foreground/75', !row.hostsLauncher && 'text-red-200')} role="status">{row.hostsLauncher ? t('hostsChosen') : t('doesNotHostChosen')}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">{t('restrictions')}</p>
                  <ul className="mt-0.5 list-inside list-disc text-foreground/75">{row.site.restrictions.map((restriction) => <li key={restriction.en}>{text(restriction)}</li>)}</ul>
                </div>
                <button type="button" disabled={locked || row.selected} aria-pressed={row.selected} onClick={() => editor.apply((m) => setLaunchSite(m, row.site.id))} className={cn('mt-auto self-start rounded-full border px-3 py-1.5 font-medium disabled:opacity-60', row.selected ? 'border-accent-cyan/55 text-accent-cyan' : 'border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan', focusRing())}>
                  {row.selected ? t('selected') : t('choose')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title={t('compatibilityTitle')}>
        <p className="mb-3 text-sm text-foreground/70">{t('compatibilityHint')}</p>
        {checks.length > 0 ? <CheckList checks={checks} /> : <p role="status" className="text-sm text-amber-200">{t('unavailable')}</p>}
      </Panel>
    </div>
  );
}
