'use client';

import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { pickText, type Localized } from '@/mission/i18n';
import { formatNumber, formatQuantity } from '@/mission/format';
import type { Provenance } from '@/mission/models/quantity';
import type { EditError } from '@/mission/edit';
import type { ParamRow, Tone } from '@/mission/view';
import { TONE_STYLES } from './tone';

export function useText() {
  const locale = useLocale();
  return { locale, text: (value: Localized) => pickText(value, locale) };
}

export function Panel({ title, eyebrow, children, className, actions }: { title?: string; eyebrow?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn('rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(14,19,30,0.92),rgba(9,12,19,0.88))] shadow-[0_14px_40px_rgba(3,7,18,0.4)]', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow ? <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan/80">{eyebrow}</p> : null}
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const t = useTranslations('mission.tone');
  const Icon = tone === 'normal' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : OctagonAlert;
  return <Icon size={14} className={cn(TONE_STYLES[tone].text, className)} aria-label={t(tone)} role="img" />;
}

const PROVENANCE_STYLE: Record<Provenance, string> = {
  measured: 'border-emerald-400/40 text-emerald-200',
  derived: 'border-cyan-300/40 text-cyan-200',
  estimated: 'border-amber-300/40 text-amber-200',
  fictional: 'border-violet-300/40 text-violet-200',
  artistic: 'border-white/30 text-foreground/70',
};

/** Where a number comes from, using the app's existing provenance vocabulary. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const t = useTranslations('provenance');
  return <span className={cn('inline-flex rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em]', PROVENANCE_STYLE[provenance])}>{t(provenance)}</span>;
}

/** Shows why an edit was refused, in the player's language. Renders nothing when there is no error. */
export function EditNotice({ error }: { error: EditError | null }) {
  const t = useTranslations('mission.editError');
  if (!error) return null;
  return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{t(error)}</p>;
}

/**
 * A number input that keeps a text draft while typing and commits on Enter or blur.
 * `onCommit` returns an edit error (shown by the caller) or null. The draft resets to
 * the stored value whenever that changes.
 */
export function NumberField({ label, value, onCommit, min, max, step, unit, width = 'w-28' }: { label: string; value: number; onCommit: (value: number) => void; min?: number; max?: number; step?: number; unit?: string; width?: string }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Follow the stored value when it changes from outside (derived during render, not in an effect).
  if (seen !== value) {
    setSeen(value);
    setDraft(String(value));
  }
  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() === '' || !Number.isFinite(parsed)) return setDraft(String(value));
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
        className={cn('rounded-md border border-panel-border bg-background/70 px-2 py-1 font-mono text-sm', width, focusRing())}
      />
      {unit ? <span className="font-mono text-xs text-foreground/60">{unit}</span> : null}
    </div>
  );
}

/** Technical parameters of a part, each with its unit. */
export function ParamList({ rows, columns = false }: { rows: ParamRow[]; columns?: boolean }) {
  const { locale } = useText();
  const param = useTranslations('mission.param');
  const enums = useTranslations('mission.enum');
  return (
    <dl className={cn('grid gap-x-4 gap-y-1 text-xs', columns ? 'sm:grid-cols-2' : 'grid-cols-1')}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-0.5">
          <dt className="text-foreground/65">{param(row.key)}</dt>
          <dd className="font-mono text-foreground">
            {row.enumValue ? enums(`${row.enumValue.group}.${row.enumValue.id}`) : formatQuantity(row.number ?? null, row.unit ?? '1', locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { formatNumber };
