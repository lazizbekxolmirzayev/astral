'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import { MAX_PART_QUANTITY } from '@/mission/models/mission';

/** Plus/minus buttons for the quantity of one part, with the count between them. */
export function QuantityControl({ name, count, onAdd, onRemove, disabled }: { name: string; count: number; onAdd: () => void; onRemove: () => void; disabled?: boolean }) {
  const t = useTranslations('mission.spacecraft');
  const button = 'flex h-8 w-8 items-center justify-center rounded-full border border-panel-border bg-white/[0.03] transition-colors hover:border-accent-cyan/50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={name}>
      <button type="button" onClick={onRemove} disabled={disabled || count === 0} aria-label={t('decrease', { name })} className={cn(button, focusRing())}>
        <Minus size={14} />
      </button>
      <span className="min-w-6 text-center font-mono text-sm" aria-live="polite">{count}</span>
      <button type="button" onClick={onAdd} disabled={disabled || count >= MAX_PART_QUANTITY} aria-label={t('increase', { name })} className={cn(button, focusRing())}>
        <Plus size={14} />
      </button>
    </div>
  );
}
