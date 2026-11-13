'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { CREW_ROLES, PLAYER_COLORS, isAiRole, playerOfRole, type CrewRole } from '@/game/crew';
import { crewStore, useCrewStore, type CrewTask } from '@/game/crewStore';
import { blip, unlock } from '@/game/audio';
import { simStore } from '@/stores/simStore';
import { isRemoteRole } from './OnlineHost';
import { useOnline } from '@/game/online';

const RESULT_FLASH_S = 3;

export function usePlayerName(player: number): string {
  const t = useTranslations('game.crew');
  const name = useCrewStore((state) => state.names[player]);
  return name?.trim() || t('player', { n: player + 1 });
}

function answer(role: CrewRole, choice: 'go' | 'nogo' | 'do') {
  if (isRemoteRole(role)) return;
  unlock();
  const { clockT } = simStore.getState();
  const entry = crewStore.getState().respond(role, choice, clockT);
  if (entry) blip(entry.points >= 0 ? 760 : 220, 0.08);
}

function RoleCard({ role, task, compact }: { role: CrewRole; task: CrewTask | undefined; compact: boolean }) {
  const t = useTranslations('game.crew');
  const count = useCrewStore((state) => state.playerCount);
  const clockS = useCrewStore((state) => state.clockS);
  const lastEntry = useCrewStore((state) => [...state.log].reverse().find((entry) => entry.role === role));
  const player = playerOfRole(role, count);
  const names = useCrewStore((state) => state.names);
  const remote = useOnline((state) => state.mode === 'host' && player !== 0);
  const name = usePlayerName(player);
  const ai = isAiRole(role, count);
  const color = ai ? '#94a3b8' : PLAYER_COLORS[player]!;
  const key = CREW_ROLES.indexOf(role) + 1;
  const left = task ? Math.max(0, task.deadlineS - clockS) : 0;
  const flash = !task && lastEntry && lastEntry.points !== 0 && clockS - lastEntry.atS < RESULT_FLASH_S ? lastEntry : null;
  if (compact && !task) return null;
  return (
    <div data-crew-role={role} data-active={Boolean(task)} className={`rounded-xl border px-2.5 py-1.5 backdrop-blur-md transition ${task ? 'border-amber-300/70 bg-[rgba(44,34,10,0.94)] shadow-[0_0_22px_rgba(251,191,36,0.3)]' : 'border-white/10 bg-black/45'}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black" style={{ background: color }}>{ai ? 'AI' : player + 1}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-white">{t(`roles.${role}.name`)}</p>
          <p className="truncate text-[10px] text-white/50">{ai ? t('aiSeat') : names[player]?.trim() || t('humanSeat')}{!task ? <> · {flash ? <span className={flash.points >= 0 ? 'text-emerald-300' : 'text-red-300'}>{flash.points >= 0 ? '✓' : '✗'} {flash.points > 0 ? '+' : ''}{flash.points}</span> : t('standby')}</> : null}</p>
        </div>
        <span aria-hidden data-testid="crew-lamp" className={`h-2 w-2 shrink-0 rounded-full ${task ? 'animate-pulse bg-amber-300 shadow-[0_0_8px_2px_rgba(251,191,36,0.8)]' : ai ? 'bg-slate-500' : 'bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.6)]'}`} />
        <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/60">{key}</kbd>
      </div>
      {task ? (
        <div className="mt-1.5">
          <p className="text-[11px] leading-snug text-amber-100">{t(`tasks.${task.defId}.name`)}</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.max(0, Math.min(1, left / task.windowS)) * 100}%` }} /></div>
          {ai ? <p data-testid="crew-ai-note" className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">🤖 {t('aiAuto')}</p> : remote ? <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">🌐 {t('onlineWaiting', { name })}</p> : <div className="mt-1.5 flex gap-1.5">
            {task.kind === 'poll' ? (
              <>
                <button type="button" data-action={`crew-go-${role}`} onClick={() => answer(role, 'go')} className="flex-1 rounded-lg border border-emerald-300/60 bg-emerald-400/25 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50 transition hover:bg-emerald-400/45">{t('go')}</button>
                <button type="button" data-action={`crew-nogo-${role}`} onClick={() => answer(role, 'nogo')} className="flex-1 rounded-lg border border-red-300/60 bg-red-500/25 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-red-50 transition hover:bg-red-500/45">{t('nogo')}</button>
              </>
            ) : (
              <button type="button" data-action={`crew-do-${role}`} onClick={() => answer(role, 'do')} className="flex-1 rounded-lg border border-amber-300/60 bg-amber-400/25 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-50 transition hover:bg-amber-400/45">{t(`tasks.${task.defId}.action`)}</button>
            )}
          </div>}
        </div>
      ) : null}
    </div>
  );
}

/** The crew's stations during the flight: who sits where, the open job of each, and the points so far. */
export function CrewPanel() {
  const t = useTranslations('game.crew');
  const open = useCrewStore((state) => state.open);
  const points = useCrewStore((state) => state.log.reduce((sum, entry) => sum + entry.points, 0));
  const count = useCrewStore((state) => state.playerCount);

  // keys 1-4 answer for the station; Shift+key is NO-GO
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
      if (index < 0 || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      const role = CREW_ROLES[index]!;
      const task = crewStore.getState().open.find((entry) => entry.role === role);
      if (!task) return;
      event.preventDefault();
      answer(role, task.kind === 'poll' ? (event.shiftKey ? 'nogo' : 'go') : 'do');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byRole = (role: CrewRole) => [...open].filter((task) => task.role === role).sort((a, b) => a.openedAtS - b.openedAtS)[0];
  return (
    <>
      <aside data-testid="crew-panel" className="pointer-events-auto absolute left-3 top-[64px] z-30 hidden w-[218px] flex-col gap-1.5 sm:flex">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/45 px-2.5 py-1 backdrop-blur-md">
          <span className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{t('title')}</span>
          <span data-testid="crew-points" className="text-[11px] font-semibold tabular-nums text-amber-200">{points} {t('pts')}</span>
        </div>
        {CREW_ROLES.map((role) => <RoleCard key={role} role={role} task={byRole(role)} compact={false} />)}
        <p className="hidden px-1 text-[10px] text-white/40 min-[1180px]:block">{count > 1 ? t('keysMulti') : t('keys')}</p>
      </aside>
      <div className="pointer-events-auto absolute inset-x-3 bottom-[250px] z-30 flex flex-col gap-1.5 sm:hidden">
        {CREW_ROLES.map((role) => <RoleCard key={role} role={role} task={byRole(role)} compact />)}
      </div>
    </>
  );
}

/** Used by the hangar: how many players and who sits where. */
export function CrewSetup() {
  const t = useTranslations('game.crew');
  const count = useCrewStore((state) => state.playerCount);
  const names = useCrewStore((state) => state.names);
  return (
    <div data-testid="crew-setup" className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{t('setup.title')}</p>
      <div role="group" aria-label={t('setup.players')} className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} type="button" data-action={`players-${n}`} aria-pressed={count === n} onClick={() => crewStore.getState().setPlayerCount(n)} className={`h-7 w-8 rounded-lg border text-xs font-semibold transition ${count === n ? 'border-cyan-300/70 bg-cyan-400/25 text-cyan-50' : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40'}`}>{n}</button>
        ))}
        <span className="ml-1 text-[11px] text-white/55">{t('setup.count', { count })}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {CREW_ROLES.map((role, seat) => {
          const ai = seat >= count;
          return (
            <li key={role} className="flex items-center gap-2" data-player={seat} data-ai={ai}>
              <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-black" style={{ background: ai ? '#94a3b8' : PLAYER_COLORS[seat] }}>{ai ? 'AI' : seat + 1}</span>
              {ai ? (
                <span className="w-24 truncate text-[11px] text-white/45">{t('setup.ai')}</span>
              ) : (
                <input aria-label={t('setup.name', { n: seat + 1 })} value={names[seat] ?? ''} maxLength={14} placeholder={t(`roles.${role}.name`)} onChange={(event) => crewStore.getState().setName(seat, event.target.value)} className="w-24 rounded-md border border-white/15 bg-black/40 px-1.5 py-1 text-[11px] text-white placeholder:text-white/30" />
              )}
              <span className={`min-w-0 flex-1 truncate text-[10px] ${ai ? 'text-white/35' : 'text-white/70'}`}>{t(`roles.${role}.name`)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-white/40" title={t('setup.note')}>{t('setup.note')}</p>
    </div>
  );
}
