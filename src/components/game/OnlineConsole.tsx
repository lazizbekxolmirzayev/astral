'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { CREW_ROLES, PLAYER_COLORS, playerOfRole, type CrewRole } from '@/game/crew';
import { formatNumber } from '@/game/format';
import { leaveRoom, sendAnswer, useOnline } from '@/game/online';
import { blip, unlock } from '@/game/audio';
import { speakLine, stopSpeaking } from '@/game/voice';
import { pickText } from '@/mission';

/** A joined player's screen: their own stations with big buttons, the flight's key numbers, and the result. Full screen over the game. */
export function OnlineConsole() {
  const t = useTranslations('game');
  const locale = useLocale();
  const snapshot = useOnline((state) => state.snapshot);
  const index = useOnline((state) => state.index);
  const roster = useOnline((state) => state.roster);
  const connected = useOnline((state) => state.connected);
  const code = useOnline((state) => state.code);
  const count = Math.max(1, snapshot?.playerCount ?? roster.length);
  const mine = CREW_ROLES.filter((role) => playerOfRole(role, count) === index);
  const spoken = useRef(new Set<string>());

  // call out each new job of my stations in my language
  useEffect(() => {
    if (!snapshot) return;
    for (const task of snapshot.tasks) {
      if (playerOfRole(task.role, count) !== index || spoken.current.has(task.key)) continue;
      spoken.current.add(task.key);
      const name = snapshot.names[index]?.trim() || t('crew.player', { n: index + 1 });
      speakLine(`console-${task.key}`, 'mcc', t(`crew.tasks.${task.defId}.call`, { name }), locale);
    }
  }, [snapshot, index, count, locale, t]);
  useEffect(() => () => stopSpeaking(), []);

  const answer = (role: CrewRole, choice: 'go' | 'nogo' | 'do') => { unlock(); blip(680, 0.08); void sendAnswer(role, choice); };
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length]!;
  const phase = snapshot?.phase;
  return (
    <div data-testid="online-console" className="absolute inset-0 z-[60] flex flex-col gap-3 overflow-y-auto bg-[#05070d]/96 p-3 sm:p-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span aria-hidden className="h-6 w-6 rounded-full text-center text-xs font-bold leading-6 text-black" style={{ background: color }}>{index + 1}</span><div><p className="text-sm font-semibold text-white">{roster[index]?.name ?? t('crew.player', { n: index + 1 })}</p><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">{t('online.room', { code })}</p></div></div>
        <div className="flex items-center gap-2"><span className={`text-[10px] uppercase tracking-[0.14em] ${connected ? 'text-emerald-300' : 'text-amber-300'}`}>{connected ? t('online.connected') : t('online.reconnecting')}</span><button type="button" data-action="leave-room" onClick={() => void leaveRoom()} className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/80 hover:text-white">{t('online.leave')}</button></div>
      </header>

      {!snapshot || phase === 'map' || phase === 'hangar' ? (
        <p className="m-auto max-w-sm text-center text-sm text-white/70" data-testid="console-waiting">{t('online.waiting')}</p>
      ) : (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white">{snapshot.stageTitle ? pickText(snapshot.stageTitle, locale) : ''}</p>
            <p className="font-mono text-[11px] text-cyan-200/80">{snapshot.clock}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/60">
              <div><p>{snapshot.tm.altitudeKm !== null ? t('flight.altitude') : t('flight.distance')}</p><p className="text-base font-semibold text-white">{formatNumber(snapshot.tm.altitudeKm ?? snapshot.tm.distanceKm, locale, 0)} km</p></div>
              <div><p>{t('flight.speed')}</p><p className="text-base font-semibold text-white">{formatNumber(snapshot.tm.speedKms, locale, 2)} km/s</p></div>
              <div><p>{t('flight.battery')}</p><p className="text-base font-semibold text-white">{formatNumber(snapshot.tm.battery * 100, locale, 0)}%</p></div>
            </div>
            {snapshot.lost ? <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] text-red-300">{t('flight.lost')}</p> : null}
            <p className="mt-2 text-[11px] text-amber-200">{t('crew.title')}: {snapshot.points} {t('crew.pts')}</p>
          </section>

          {phase === 'result' && snapshot.result ? (
            <section data-testid="console-result" className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4 text-center">
              <p className="text-lg font-bold uppercase tracking-[0.2em] text-white">{t(`result.${snapshot.result.outcome}`)}</p>
              <p className="mt-1 text-4xl font-black text-cyan-100">{snapshot.result.grade}</p>
              <p className="text-sm text-white/70">{snapshot.result.total} {t('score.of', { max: snapshot.result.max })}</p>
              <ul className="mt-3 space-y-1 text-left text-[12px]">{snapshot.result.players.map((entry) => <li key={entry.player} className="flex justify-between rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5"><span>{snapshot.names[entry.player]?.trim() || t('crew.player', { n: entry.player + 1 })}{snapshot.result?.mvp === entry.player ? ' ★' : ''}</span><b className={entry.points >= 0 ? 'text-emerald-300' : 'text-red-300'}>{entry.points}</b></li>)}</ul>
            </section>
          ) : (
            <section className="grid gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{t('online.yourStations')}</p>
              {mine.map((role) => {
                const task = snapshot.tasks.find((entry) => entry.role === role);
                return (
                  <div key={role} data-console-role={role} data-active={Boolean(task)} className={`rounded-2xl border p-3 ${task ? 'border-amber-300/70 bg-[rgba(44,34,10,0.94)] shadow-[0_0_24px_rgba(251,191,36,0.3)]' : 'border-white/10 bg-white/[0.04]'}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">{t(`crew.roles.${role}.name`)}</p>
                    {task ? (
                      <>
                        <p className="mt-1 text-sm text-amber-100">{t(`crew.tasks.${task.defId}.name`)}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-300" style={{ width: `${Math.max(0, Math.min(1, task.leftS / task.windowS)) * 100}%` }} /></div>
                        <div className="mt-2 flex gap-2">
                          {task.kind === 'poll' ? (
                            <>
                              <button type="button" data-action={`console-go-${role}`} onClick={() => answer(role, 'go')} className="flex-1 rounded-xl border border-emerald-300/60 bg-emerald-400/25 py-4 text-base font-bold uppercase tracking-[0.18em] text-emerald-50">{t('crew.go')}</button>
                              <button type="button" data-action={`console-nogo-${role}`} onClick={() => answer(role, 'nogo')} className="flex-1 rounded-xl border border-red-300/60 bg-red-500/25 py-4 text-base font-bold uppercase tracking-[0.18em] text-red-50">{t('crew.nogo')}</button>
                            </>
                          ) : (
                            <button type="button" data-action={`console-do-${role}`} onClick={() => answer(role, 'do')} className="flex-1 rounded-xl border border-amber-300/60 bg-amber-400/25 py-4 text-base font-bold uppercase tracking-[0.14em] text-amber-50">{t(`crew.tasks.${task.defId}.action`)}</button>
                          )}
                        </div>
                      </>
                    ) : <p className="mt-1 text-[12px] text-white/45">{t('crew.standby')}</p>}
                  </div>
                );
              })}
              {mine.length === 0 ? <p className="text-sm text-white/60">{t('online.noStations')}</p> : null}
            </section>
          )}
        </>
      )}
      <p className="mt-auto text-center text-[10px] text-white/35">{t('online.consoleNote')}</p>
    </div>
  );
}
