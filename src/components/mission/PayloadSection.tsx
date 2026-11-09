'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { DESTINATIONS, INSTRUMENTS, getDestination } from '@/mission/catalog';
import { addPart, removePart } from '@/mission/edit';
import type { Evaluation } from '@/mission/engine';
import { formatQuantity } from '@/mission/format';
import type { Instrument } from '@/mission/models/catalog';
import type { Mission } from '@/mission/models/mission';
import { valueIn } from '@/mission/units';
import { describePart } from '@/mission/view';
import { QuantityControl } from './PartControls';
import type { Editor } from './hooks';
import { EditNotice, Panel, ParamList, useText } from './primitives';

/** Parameters shown on every instrument card, in this order. */
const CARD_PARAMS = ['mass', 'power', 'dailyData', 'cost', 'science', 'dataHandling'];

function InstrumentCard({ instrument, mission, evaluation, editor, selected, onSelect }: { instrument: Instrument; mission: Mission; evaluation: Evaluation; editor: Editor; selected: boolean; onSelect: () => void }) {
  const t = useTranslations('mission.payload');
  const kind = useTranslations('mission.enum.instrumentKind');
  const { locale, text } = useText();
  const count = mission.spacecraft.parts.find((line) => line.itemId === instrument.id)?.quantity ?? 0;
  const destination = getDestination(mission.objective.destinationId);
  const available = instrument.destinations.includes(mission.objective.destinationId);
  const locked = mission.status !== 'draft';
  const places = instrument.destinations.map((id) => text(DESTINATIONS.find((entry) => entry.id === id)?.name ?? { en: id, uz: id })).join(', ');
  const rows = describePart(instrument).filter((row) => CARD_PARAMS.includes(row.key));
  const pointing = evaluation.details?.science.perInstrument.find((entry) => entry.instrumentId === instrument.id);
  const required = formatQuantity(valueIn(instrument.requiredPointing, 'deg'), 'deg', locale);

  return (
    <li className={cn('flex flex-col gap-2 rounded-2xl border p-4', count > 0 ? 'border-accent-cyan/50 bg-accent-cyan/[0.06]' : 'border-panel-border bg-white/[0.02]', selected && 'ring-1 ring-accent-cyan/60', !available && 'opacity-80')} data-instrument={instrument.id}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className={cn('min-w-0 text-left', focusRing())}>
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan/80">{kind(instrument.kind)}</span>
          <span className="block text-base font-semibold">{text(instrument.name)}</span>
        </button>
        {count > 0 ? <span className="shrink-0 rounded-full border border-accent-cyan/40 px-2 py-0.5 text-[11px] text-accent-cyan">{t('installed', { count })}</span> : null}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">{t('purpose')}</p>
        <p className="text-sm text-foreground/75">{text(instrument.summary)}</p>
      </div>
      <ParamList rows={rows} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/55">{t('requirements')}</p>
        <ul className="mt-0.5 list-inside list-disc text-xs text-foreground/75">
          <li>{t('needsPointing', { value: required })}</li>
          <li>{instrument.dataHandling === 'relay' ? t('relay') : t('storeForward')}</li>
          <li>{t('availableAt', { places })}</li>
        </ul>
        {count > 0 && pointing ? (
          <p role="status" className={cn('mt-1 text-xs', pointing.pointingOk ? 'text-emerald-200' : 'text-red-200')}>{pointing.pointingOk ? t('pointingOk') : t('pointingFail')}</p>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {available ? (
          <>
            <button type="button" onClick={() => editor.apply((m) => addPart(m, instrument.id))} disabled={locked} className={cn('rounded-full border border-accent-cyan/45 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan disabled:opacity-40', focusRing())}>
              {t('add')}
            </button>
            {count > 0 ? <QuantityControl name={text(instrument.name)} count={count} disabled={locked} onAdd={() => editor.apply((m) => addPart(m, instrument.id))} onRemove={() => editor.apply((m) => removePart(m, instrument.id))} /> : null}
          </>
        ) : (
          <>
            <p className="text-xs text-amber-200">{t('notAvailable', { destination: destination ? text(destination.name) : mission.objective.destinationId })}</p>
            {count > 0 ? <button type="button" onClick={() => editor.apply((m) => removePart(m, instrument.id))} disabled={locked} className={cn('rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-200', focusRing())}>{t('remove')}</button> : null}
          </>
        )}
      </div>
    </li>
  );
}

export function PayloadSection({ mission, evaluation, editor, selectedPartId, onSelectPart }: { mission: Mission; evaluation: Evaluation; editor: Editor; selectedPartId: string | null; onSelectPart: (itemId: string | null) => void }) {
  const t = useTranslations('mission.payload');
  const [onlyHere, setOnlyHere] = useState(false);
  const shown = INSTRUMENTS.filter((instrument) => !onlyHere || instrument.destinations.includes(mission.objective.destinationId) || mission.spacecraft.parts.some((line) => line.itemId === instrument.id));
  const science = evaluation.details?.science.total;
  const { locale } = useText();

  return (
    <div className="flex flex-col gap-4">
      <EditNotice error={editor.error} />
      <Panel title={t('title')} eyebrow={t('science')} actions={<span className="font-mono text-xs text-foreground/70">{science ? formatQuantity(science.value, 'pt', locale) : '—'}</span>}>
        <p className="mb-3 text-sm text-foreground/70">{t('subtitle', { count: INSTRUMENTS.length })}</p>
        <div role="group" aria-label={t('title')} className="mb-3 flex gap-2">
          {[false, true].map((value) => (
            <button key={String(value)} type="button" aria-pressed={onlyHere === value} onClick={() => setOnlyHere(value)} className={cn('rounded-full border px-3 py-1 text-xs', onlyHere === value ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan' : 'border-panel-border text-foreground/70', focusRing())}>
              {value ? t('filterHere') : t('filterAll')}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((instrument) => (
            <InstrumentCard key={instrument.id} instrument={instrument} mission={mission} evaluation={evaluation} editor={editor} selected={selectedPartId === instrument.id} onSelect={() => onSelectPart(instrument.id)} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}
