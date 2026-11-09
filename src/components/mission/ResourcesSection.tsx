'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Evaluation } from '@/mission/engine';
import { formatQuantity } from '@/mission/format';
import { getModelCard, type ModelCardId } from '@/mission/modelCards';
import type { ResourceKey, ResourceLine } from '@/mission/models/resources';
import { convert, type UnitSymbol } from '@/mission/units';
import { toneOfMargin, type Tone } from '@/mission/view';
import { Panel, ProvenanceBadge, ToneIcon, useText } from './primitives';
import { TONE_STYLES, barPercent } from './tone';

const DISPLAY_UNIT: Record<ResourceKey, { from: UnitSymbol; to: UnitSymbol }> = {
  mass: { from: 'kg', to: 'kg' },
  power: { from: 'W', to: 'W' },
  budget: { from: 'USD', to: 'MUSD' },
  data: { from: 'bit', to: 'GB' },
  comms: { from: 'bit/s', to: 'kbit/s' },
  time: { from: 's', to: 'd' },
};

const STATUS_TONE: Record<ResourceLine['status'], Tone> = { ok: 'normal', tight: 'warning', over: 'critical' };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-0.5 text-sm">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="text-right font-mono">{children}</dd>
    </div>
  );
}

export function ResourcesSection({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations('mission.resources');
  const load = useTranslations('mission.resources.load');
  const tone = useTranslations('mission.tone');
  const { locale, text } = useText();
  const { resources, details } = evaluation;

  if (!resources || !details) {
    return <p role="status" className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">{t('unavailable')}</p>;
  }
  const q = (value: number, unit: UnitSymbol, as: UnitSymbol = unit) => formatQuantity(convert(value, unit, as), as, locale);
  const { mass, power, deltaV, link, data, cost, science } = details;
  const peak = Math.max(...power.loads.map((entry) => entry.peakW), 1);

  const models = new Set<ModelCardId>();
  for (const line of Object.values(resources)) models.add(line.model);
  for (const assumption of evaluation.assumptionsUsed) models.add(assumption.model);

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')}>
        <p className="mb-3 text-sm text-foreground/70">{t('subtitle')}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-[10px] uppercase tracking-[0.14em] text-foreground/60">
                <th className="py-1.5 pr-2 font-medium">{t('status')}</th>
                <th className="py-1.5 pr-2 font-medium">{t('used')}</th>
                <th className="py-1.5 pr-2 font-medium">{t('limit')}</th>
                <th className="py-1.5 pr-2 font-medium">{t('margin')}</th>
                <th className="py-1.5 font-medium">{t('provenance')}</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(resources) as ResourceKey[]).map((key) => {
                const line = resources[key];
                const unit = DISPLAY_UNIT[key];
                const lineTone = STATUS_TONE[line.status];
                const fraction = line.limit === null ? null : line.limit > 0 ? line.used / line.limit : line.used > 0 ? 2 : 0;
                return (
                  <tr key={key} className="border-b border-white/5 align-top" data-resource={key} data-tone={lineTone}>
                    <th scope="row" className="py-2 pr-2 font-medium">
                      <span className="flex items-center gap-1.5"><ToneIcon tone={lineTone} />{t(`lines.${key}`)}</span>
                      <span className={cn('block font-mono text-[10px] uppercase tracking-[0.12em]', TONE_STYLES[lineTone].text)}>{tone(lineTone)}</span>
                    </th>
                    <td className="py-2 pr-2 font-mono">{q(line.used, unit.from, unit.to)}</td>
                    <td className="py-2 pr-2 font-mono">{line.limit === null ? '—' : q(line.limit, unit.from, unit.to)}</td>
                    <td className="py-2 pr-2">
                      <span className="font-mono">{line.margin === null ? '—' : `${(line.margin * 100).toFixed(0)} %`}</span>
                      {fraction === null ? null : <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-white/10"><span className={cn('block h-full', TONE_STYLES[toneOfMargin(line.margin)].bar)} style={{ width: `${barPercent(fraction)}%` }} /></span>}
                    </td>
                    <td className="py-2"><ProvenanceBadge provenance={line.provenance} /><span className="mt-1 block max-w-[28ch] text-[11px] text-foreground/60">{line.basis}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={t('massBreakdown')}>
          <dl>
            <Row label={t('dry')}>{q(mass.dry.value, 'kg')}</Row>
            <Row label={t('payloadMass')}>{q(mass.payload.value, 'kg')}</Row>
            <Row label={t('propellantMass')}>{q(mass.propellant.value, 'kg')}</Row>
            <Row label={t('launchMass')}>{q(mass.launch.value, 'kg')}</Row>
            <Row label={t('launcherCapacity')}>{mass.launcherCapacity ? q(mass.launcherCapacity.value, 'kg') : '—'}</Row>
            <Row label={t('payloadLimit')}>{q(mass.payloadLimit.value, 'kg')}</Row>
          </dl>
        </Panel>

        <Panel title={t('deltaVBreakdown')}>
          <dl>
            <Row label={t('dvRequired')}>{q(deltaV.required.value, 'm/s')}</Row>
            <Row label={t('dvAvailable')}>{q(deltaV.available.value, 'm/s')}</Row>
            {deltaV.requiredPropellant ? <Row label={t('dvPropellant')}>{q(deltaV.requiredPropellant.value, 'kg')}</Row> : null}
            {deltaV.departureC3 ? <Row label={t('departureC3')}>{`${q(deltaV.departureC3.required.value, 'm^2/s^2', 'km^2/s^2')} / ${q(deltaV.departureC3.provided.value, 'm^2/s^2', 'km^2/s^2')}`}</Row> : null}
          </dl>
          {deltaV.available.value === 0 ? <p className="mt-2 text-xs text-amber-200">{t('dvNone')}</p> : null}
        </Panel>

        <Panel title={t('powerBreakdown')}>
          <dl>
            <Row label={t('irradiance')}>{q(power.irradiance.value, 'W/m^2')}</Row>
            <Row label={t('generationBol')}>{q(power.generationBol.value, 'W')}</Row>
            <Row label={t('generationEol')}>{q(power.generationEol.value, 'W')}</Row>
            <Row label={t('averageLoad')}>{q(power.averageLoad.value, 'W')}</Row>
            <Row label={t('peakLoad')}>{q(power.peakLoad.value, 'W')}</Row>
            <Row label={t('requiredGeneration')}>{q(power.requiredGeneration.value, 'W')}</Row>
            <Row label={t('eclipse')}>{q(power.eclipseDuration.value, 's', 'min')}</Row>
            <Row label={t('eclipseEnergy')}>{q(power.eclipseEnergy.value, 'J', 'Wh')}</Row>
            <Row label={t('batteryUsable')}>{q(power.batteryUsable.value, 'J', 'Wh')}</Row>
          </dl>
          <h3 className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/60">{t('loads')}</h3>
          <ul className="flex flex-col gap-1">
            {power.loads.map((entry) => (
              <li key={`${entry.kind}-${entry.source}`} className="text-xs">
                <div className="flex justify-between gap-2"><span>{load(entry.kind)} <span className="font-mono text-foreground/55">{entry.source}</span></span><span className="font-mono">{q(entry.averageW, 'W')} {t('average')} · {q(entry.peakW, 'W')} {t('peak')}</span></div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent-cyan/70" style={{ width: `${barPercent(entry.peakW / peak)}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t('linkBreakdown')}>
          <dl>
            <Row label={t('radio')}>{link.radioId ?? t('noRadio')}</Row>
            <Row label={t('distance')}>{q(link.distance.value, 'm', 'km')}</Row>
            <Row label={t('contact')}>{q(link.contactTime.value, 's', 'h')}</Row>
            <Row label={t('budgetRate')}>{q(link.budgetRate.value, 'bit/s', 'kbit/s')}</Row>
            <Row label={t('hardwareRate')}>{q(link.hardwareRate.value, 'bit/s', 'kbit/s')}</Row>
            <Row label={t('usableRate')}>{q(link.usableRate.value, 'bit/s', 'kbit/s')}</Row>
            <Row label={t('linkMargin')}>{Number.isFinite(link.marginDb) ? formatQuantity(link.marginDb, 'dB', locale) : '—'}</Row>
          </dl>
        </Panel>

        <Panel title={t('dataBreakdown')}>
          <dl>
            <Row label={t('generated')}>{q(data.dailyGenerated.value, 'bit', 'GB')}</Row>
            <Row label={t('capacity')}>{q(data.dailyCapacity.value, 'bit', 'GB')}</Row>
            <Row label={t('storage')}>{q(data.storage.value, 'bit', 'GB')}</Row>
            <Row label={t('peakQueue')}>{q(data.peakQueue.value, 'bit', 'GB')}</Row>
            <Row label={t('lost')}>{q(data.lost.value, 'bit', 'GB')}</Row>
            <Row label={t('backlog')}>{q(data.endBacklog.value, 'bit', 'GB')}</Row>
            <Row label={t('returned')}>{q(data.returnedTotal.value, 'bit', 'GB')}</Row>
            <Row label={t('returnFraction')}>{`${(data.returnFraction * 100).toFixed(1)} %`}</Row>
          </dl>
        </Panel>

        <Panel title={t('costBreakdown')}>
          <dl>
            <Row label={t('costHardware')}>{q(cost.spacecraft.value, 'USD', 'MUSD')}</Row>
            <Row label={t('costLaunch')}>{q(cost.launch.value, 'USD', 'MUSD')}</Row>
            <Row label={t('costOperations')}>{q(cost.operations.value, 'USD', 'MUSD')}</Row>
            <Row label={t('costTotal')}>{q(cost.total.value, 'USD', 'MUSD')}</Row>
            <Row label={t('sciencePoints')}>{formatQuantity(science.total.value, 'pt', locale)}</Row>
          </dl>
          <p className="mt-2 flex items-center gap-2 text-[11px] text-foreground/60"><ProvenanceBadge provenance={cost.total.provenance} />{t('scienceBreakdown')}</p>
        </Panel>
      </div>

      <Panel title={t('assumptions')}>
        <p className="mb-3 text-sm text-foreground/70">{t('assumptionsHint')}</p>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 lg:grid-cols-2">
          {evaluation.assumptionsUsed.map((assumption) => (
            <li key={assumption.id} className="flex items-start justify-between gap-3 border-b border-white/5 pb-1.5 text-xs">
              <span className="text-foreground/75">{text(assumption.description)}</span>
              <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-mono text-sm">{formatQuantity(assumption.quantity.value, assumption.quantity.unit as UnitSymbol, locale)}</span><ProvenanceBadge provenance={assumption.quantity.provenance} /></span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('models')}>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
          {[...models].map((id) => {
            const card = getModelCard(id);
            if (!card) return null;
            return (
              <li key={id} className="rounded-xl border border-panel-border p-3 text-xs">
                <p className="text-sm font-semibold">{text(card.title)}</p>
                <p className="mt-0.5 text-foreground/70">{text(card.scope)}</p>
                {card.implementedIn ? <p className="mt-1 font-mono text-[10px] text-foreground/55">{t('implementedIn', { file: card.implementedIn })}</p> : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
