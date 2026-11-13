'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { GamePhase } from '@/game/gameStore';

const GLOSSARY = ['dv', 'leo', 'geo', 'maxq', 'fairing', 'downlink'] as const;

/** The button that opens the help box, and the box: what to do now, the controls and a short glossary. */
export function HelpBox({ phase }: { phase: GamePhase }) {
  const t = useTranslations('game.help');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if (event.key === 'h' || event.key === 'H' || event.key === '?') setOpen((value) => !value);
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" data-action="toggle-help" aria-expanded={open} aria-controls="game-help" title={t('hint')} onClick={() => setOpen((value) => !value)} className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md transition ${open ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-black/40 text-white/70 hover:border-white/40 hover:text-white'}`}>?</button>
      {open ? (
        <aside id="game-help" role="dialog" aria-label={t('title')} data-testid="help-box" className="pointer-events-auto fixed right-3 top-[52px] z-50 max-h-[calc(100dvh-72px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-cyan-300/25 bg-[linear-gradient(170deg,rgba(8,14,26,0.94),rgba(8,10,20,0.9))] p-4 shadow-[0_0_50px_rgba(0,200,255,0.12)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">{t('title')}</p>
            <button type="button" data-action="close-help" aria-label={t('close')} onClick={() => setOpen(false)} className="rounded-full px-2 text-lg leading-none text-white/60 hover:text-white">×</button>
          </div>

          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/50">{t('now')}</p>
          <p className="mt-1 text-[13px] font-semibold text-white">{t(`phases.${phase}.title`)}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-white/75">
            {[1, 2, 3].map((index) => <li key={index}>{t(`phases.${phase}.step${index}`)}</li>)}
          </ol>

          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/50">{t('controls')}</p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-white/75">
            {(['help', 'camera', 'pause', 'crew', 'sound'] as const).map((key) => (
              <li key={key} className="flex items-start gap-2"><kbd className="mt-px shrink-0 rounded border border-white/20 bg-white/10 px-1.5 text-[10px] text-white/90">{t(`keys.${key}.key`)}</kbd><span>{t(`keys.${key}.text`)}</span></li>
            ))}
          </ul>

          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/50">{t('glossary')}</p>
          <dl className="mt-1.5 space-y-1.5 text-[12px]">
            {GLOSSARY.map((key) => (
              <div key={key}><dt className="font-semibold text-white/90">{t(`terms.${key}.name`)}</dt><dd className="leading-snug text-white/65">{t(`terms.${key}.text`)}</dd></div>
            ))}
          </dl>
          <p className="mt-4 border-t border-white/10 pt-2 text-[11px] leading-snug text-white/45">{t('honest')}</p>
        </aside>
      ) : null}
    </>
  );
}
