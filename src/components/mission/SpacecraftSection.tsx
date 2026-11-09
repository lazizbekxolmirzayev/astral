'use client';

import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { BATTERIES, BUSES, ADCS, COMMS, OBCS, PROPULSION, SOLAR_ARRAYS, getPart } from '@/mission/catalog';
import { addPart, removePart, setBus, setPropellantMass, setPropulsion } from '@/mission/edit';
import { formatNumber, formatPercent, formatQuantity } from '@/mission/format';
import type { Mission } from '@/mission/models/mission';
import type { Part } from '@/mission/models/catalog';
import { layoutSpacecraft } from '@/mission/spacecraftLayout';
import { describePart } from '@/mission/view';
import { valueIn } from '@/mission/units';
import type { Editor } from './hooks';
import { EditNotice, NumberField, Panel, ParamList, useText } from './primitives';
import { QuantityControl } from './PartControls';
import { SpacecraftPreview } from './SpacecraftPreview';

type Category = 'solar-array' | 'battery' | 'comms' | 'obc' | 'adcs';
const GROUPS: Array<{ category: Category; parts: readonly Part[] }> = [
  { category: 'solar-array', parts: SOLAR_ARRAYS },
  { category: 'battery', parts: BATTERIES },
  { category: 'comms', parts: COMMS },
  { category: 'obc', parts: OBCS },
  { category: 'adcs', parts: ADCS },
];

/** The three parameters shown on a part's row: the ones that matter most when choosing. */
const HIGHLIGHT: Record<Part['category'], string[]> = {
  bus: ['mass', 'payloadLimit', 'basePower'],
  propulsion: ['isp', 'propellantCapacity', 'mass'],
  'solar-array': ['area', 'mass', 'cost'],
  battery: ['capacity', 'mass', 'cost'],
  comms: ['maxRate', 'power', 'mass'],
  obc: ['storage', 'power', 'mass'],
  adcs: ['pointing', 'power', 'mass'],
  instrument: ['mass', 'power', 'science'],
};

function Highlights({ part }: { part: Part }) {
  const { locale } = useText();
  const param = useTranslations('mission.param');
  const rows = describePart(part).filter((row) => HIGHLIGHT[part.category].includes(row.key));
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground/70">
      {rows.map((row) => (
        <li key={row.key}>
          {param(row.key)}: <span className="font-mono text-foreground/90">{formatQuantity(row.number ?? null, row.unit ?? '1', locale)}</span>
        </li>
      ))}
    </ul>
  );
}

function PickRow({ part, chosen, onChoose, onSelect, selected, locked, label }: { part: Part; chosen: boolean; onChoose: () => void; onSelect: () => void; selected: boolean; locked: boolean; label: string }) {
  const { text } = useText();
  return (
    <li className={cn('flex items-start gap-2 rounded-xl border px-3 py-2', chosen ? 'border-accent-cyan/55 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02]', selected && 'ring-1 ring-accent-cyan/60')}>
      <button type="button" onClick={onSelect} className={cn('min-w-0 flex-1 text-left', focusRing())}>
        <span className="block text-sm font-semibold">{text(part.name)}</span>
        <span className="block text-xs text-foreground/65">{text(part.summary)}</span>
        <Highlights part={part} />
      </button>
      <button type="button" onClick={onChoose} disabled={locked || chosen} aria-pressed={chosen} className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium disabled:cursor-default', chosen ? 'border-accent-cyan/50 text-accent-cyan' : 'border-panel-border hover:border-accent-cyan/50', focusRing())}>
        {label}
      </button>
    </li>
  );
}

export function SpacecraftSection({ mission, editor, selectedPartId, onSelectPart }: { mission: Mission; editor: Editor; selectedPartId: string | null; onSelectPart: (itemId: string | null) => void }) {
  const t = useTranslations('mission.spacecraft');
  const cat = useTranslations('mission.spacecraft.categories');
  const { locale, text } = useText();
  const locked = mission.status !== 'draft';
  const destinationId = mission.objective.destinationId;
  const quantityOf = (id: string) => mission.spacecraft.parts.find((line) => line.itemId === id)?.quantity ?? 0;

  const propulsion = mission.spacecraft.propulsionId ? getPart(mission.spacecraft.propulsionId) : undefined;
  const capacityKg = propulsion?.category === 'propulsion' ? valueIn(propulsion.propellantCapacity, 'kg') : 0;

  const selected = selectedPartId ? getPart(selectedPartId) : undefined;
  const selectedCount = selected ? (selected.id === mission.spacecraft.busId || selected.id === mission.spacecraft.propulsionId ? 1 : quantityOf(selected.id)) : 0;
  const tank = layoutSpacecraft(mission).shapes.find((shape) => shape.role === 'tank');
  const installed = mission.spacecraft.parts.map((line) => ({ line, part: getPart(line.itemId) })).filter((entry): entry is { line: (typeof mission.spacecraft.parts)[number]; part: Part } => entry.part !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <EditNotice error={editor.error} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 xl:order-2">
          <SpacecraftPreview mission={mission} selectedId={selectedPartId} onSelect={onSelectPart} />

          <Panel title={t('details')} eyebrow={t('selected')}>
            {selected ? (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-semibold">{text(selected.name)}</p>
                  <p className="text-xs text-foreground/65">{text(selected.summary)}</p>
                  <p className="mt-1 text-xs text-foreground/70">{selectedCount > 0 ? t('inDesign', { count: selectedCount }) : t('notInDesign')}</p>
                  {selected.category === 'propulsion' && tank?.fill !== undefined ? <p className="text-xs text-foreground/70">{t('tankFill', { percent: formatPercent(tank.fill, locale) })}</p> : null}
                </div>
                <ParamList rows={describePart(selected)} columns />
              </div>
            ) : (
              <p className="text-sm text-foreground/65">{t('noSelection')}</p>
            )}
          </Panel>

          <Panel title={t('installed')}>
            {installed.length === 0 && !propulsion ? (
              <p className="text-sm text-foreground/65">{t('nothingInstalled')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {installed.map(({ line, part }) => (
                  <li key={line.itemId} className={cn('flex items-center justify-between gap-2 rounded-lg border border-panel-border px-2 py-1', selectedPartId === line.itemId && 'ring-1 ring-accent-cyan/60')}>
                    <button type="button" onClick={() => onSelectPart(line.itemId)} className={cn('min-w-0 flex-1 truncate text-left text-sm', focusRing())}>
                      {text(part.name)}
                    </button>
                    <QuantityControl name={text(part.name)} count={line.quantity} disabled={locked} onAdd={() => editor.apply((m) => addPart(m, line.itemId))} onRemove={() => editor.apply((m) => removePart(m, line.itemId))} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4 xl:order-1">
          <Panel title={t('bus')}>
            <p className="mb-2 text-xs text-foreground/65">{t('busHint')}</p>
            <ul className="flex flex-col gap-2">
              {BUSES.filter((bus) => bus.destinations.includes(destinationId) || bus.id === mission.spacecraft.busId).map((bus) => (
                <PickRow key={bus.id} part={bus} chosen={bus.id === mission.spacecraft.busId} onChoose={() => editor.apply((m) => setBus(m, bus.id))} onSelect={() => onSelectPart(bus.id)} selected={selectedPartId === bus.id} locked={locked} label={bus.id === mission.spacecraft.busId ? t('chosen') : t('choose')} />
              ))}
            </ul>
          </Panel>

          <Panel title={t('propulsion')}>
            <p className="mb-2 text-xs text-foreground/65">{t('propulsionHint')}</p>
            <ul className="flex flex-col gap-2">
              <li className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2', mission.spacecraft.propulsionId === null ? 'border-accent-cyan/55 bg-accent-cyan/10' : 'border-panel-border bg-white/[0.02]')}>
                <span className="text-sm font-semibold">{t('noPropulsion')}</span>
                <button type="button" disabled={locked || mission.spacecraft.propulsionId === null} aria-pressed={mission.spacecraft.propulsionId === null} onClick={() => editor.apply((m) => setPropulsion(m, null))} className={cn('rounded-full border border-panel-border px-3 py-1 text-xs', focusRing())}>
                  {mission.spacecraft.propulsionId === null ? t('chosen') : t('choose')}
                </button>
              </li>
              {PROPULSION.map((system) => (
                <PickRow key={system.id} part={system} chosen={system.id === mission.spacecraft.propulsionId} onChoose={() => editor.apply((m) => setPropulsion(m, system.id))} onSelect={() => onSelectPart(system.id)} selected={selectedPartId === system.id} locked={locked} label={system.id === mission.spacecraft.propulsionId ? t('chosen') : t('choose')} />
              ))}
            </ul>
            {propulsion ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-panel-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
                  <span>{t('propellant')}</span>
                  <span className="font-mono">{t('propellantOf', { capacity: formatQuantity(capacityKg, 'kg', locale) })}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={capacityKg}
                  step={Math.max(capacityKg / 200, 0.1)}
                  value={Math.min(mission.spacecraft.propellantMassKg, capacityKg)}
                  disabled={locked}
                  aria-label={t('propellant')}
                  onChange={(event) => editor.apply((m) => setPropellantMass(m, Number(event.target.value)))}
                  className={cn('w-full accent-cyan-400', focusRing())}
                />
                <NumberField label={t('propellant')} value={Math.round(mission.spacecraft.propellantMassKg * 10) / 10} min={0} onCommit={(value) => editor.apply((m) => setPropellantMass(m, value))} unit={t('kg')} />
                <p className="text-[11px] text-foreground/60">{formatNumber(mission.spacecraft.propellantMassKg, locale)} kg</p>
              </div>
            ) : null}
          </Panel>

          {GROUPS.map(({ category, parts }) => (
            <Panel key={category} title={cat(category)}>
              <ul className="flex flex-col gap-2">
                {parts.map((part) => (
                  <li key={part.id} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2', quantityOf(part.id) > 0 ? 'border-accent-cyan/45 bg-accent-cyan/[0.07]' : 'border-panel-border bg-white/[0.02]', selectedPartId === part.id && 'ring-1 ring-accent-cyan/60')}>
                    <button type="button" onClick={() => onSelectPart(part.id)} className={cn('min-w-0 flex-1 text-left', focusRing())}>
                      <span className="block text-sm font-semibold">{text(part.name)}</span>
                      <span className="block text-xs text-foreground/65">{text(part.summary)}</span>
                      <Highlights part={part} />
                    </button>
                    <QuantityControl name={text(part.name)} count={quantityOf(part.id)} disabled={locked} onAdd={() => editor.apply((m) => addPart(m, part.id))} onRemove={() => editor.apply((m) => removePart(m, part.id))} />
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
