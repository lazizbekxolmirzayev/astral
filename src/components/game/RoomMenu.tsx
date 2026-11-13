'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { createRoom, joinRoom, leaveRoom, useOnline } from '@/game/online';
import { useCrewStore } from '@/game/crewStore';

/** The Online button in the top bar: create a room, join one with its code, see who is in, close it. */
export function RoomMenu() {
  const t = useTranslations('game.online');
  const mode = useOnline((state) => state.mode);
  const code = useOnline((state) => state.code);
  const roster = useOnline((state) => state.roster);
  const error = useOnline((state) => state.error);
  const busy = useOnline((state) => state.busy);
  const hostName = useCrewStore((state) => state.names[0] ?? '');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(hostName);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  // a link with ?room=CODE opens the menu with the code filled in
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('room');
    if (!fromLink || !/^[A-Za-z0-9]{5}$/.test(fromLink)) return;
    const id = window.setTimeout(() => { setJoinCode(fromLink.toUpperCase()); setOpen(true); }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/?room=${code}`;
  const valid = name.trim().length > 0;
  return (
    <div className="relative">
      <button type="button" data-action="toggle-online" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`rounded-full border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] backdrop-blur-md transition ${mode !== 'off' ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100' : 'border-white/15 bg-black/40 text-white/70 hover:border-white/40 hover:text-white'}`}>🌐 {mode === 'host' ? code : t('button')}</button>
      {open ? (
        <div data-testid="room-menu" className="absolute right-0 top-full z-50 mt-2 w-[300px] max-w-[88vw] rounded-2xl border border-white/10 bg-[rgba(8,12,22,0.96)] p-3 text-[12px] text-white/80 shadow-2xl backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{t('title')}</p>
          {mode === 'host' ? (
            <div className="mt-2">
              <p className="text-white/60">{t('shareCode')}</p>
              <p data-testid="room-code" className="mt-1 text-center font-mono text-3xl font-bold tracking-[0.3em] text-white">{code}</p>
              <button type="button" data-action="copy-room-link" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => undefined); }} className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 py-1.5 text-[11px] uppercase tracking-[0.12em] hover:border-white/40">{copied ? t('copied') : t('copyLink')}</button>
              <ul className="mt-3 space-y-1">{roster.map((entry) => <li key={entry.index} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1"><span>{entry.name}{entry.index === 0 ? ` · ${t('host')}` : ''}</span><span className={entry.connected ? 'text-emerald-300' : 'text-white/35'}>{entry.connected ? '●' : '○'}</span></li>)}</ul>
              <p className="mt-2 text-[11px] leading-snug text-white/50">{t('hostNote')}</p>
              <button type="button" data-action="close-room" onClick={() => { void leaveRoom(); setOpen(false); }} className="mt-2 w-full rounded-lg border border-red-300/50 bg-red-500/15 py-1.5 text-[11px] uppercase tracking-[0.12em] text-red-100">{t('close')}</button>
            </div>
          ) : mode === 'client' ? (
            <button type="button" onClick={() => { void leaveRoom(); setOpen(false); }} className="mt-2 w-full rounded-lg border border-white/20 py-1.5 text-[11px] uppercase tracking-[0.12em]">{t('leave')}</button>
          ) : (
            <div className="mt-2 space-y-3">
              <label className="block"><span className="text-white/55">{t('yourName')}</span><input data-testid="room-name" value={name} maxLength={14} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-white" /></label>
              <button type="button" data-action="create-room" disabled={!valid || busy} onClick={() => void createRoom(name.trim())} className="w-full rounded-lg border border-cyan-300/60 bg-cyan-400/20 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-50 disabled:opacity-40">{t('create')}</button>
              <div className="border-t border-white/10 pt-3">
                <label className="block"><span className="text-white/55">{t('joinCode')}</span><input data-testid="room-join-code" value={joinCode} maxLength={5} autoCapitalize="characters" onChange={(event) => setJoinCode(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-center font-mono text-lg tracking-[0.3em] text-white" /></label>
                <button type="button" data-action="join-room" disabled={!valid || busy || joinCode.length !== 5} onClick={() => void joinRoom(joinCode, name.trim()).then((done) => { if (done) setOpen(false); })} className="mt-2 w-full rounded-lg border border-emerald-300/60 bg-emerald-400/20 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-50 disabled:opacity-40">{t('join')}</button>
              </div>
            </div>
          )}
          {error ? <p role="alert" className="mt-2 text-[11px] text-red-300">{t(`errors.${error}`)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
