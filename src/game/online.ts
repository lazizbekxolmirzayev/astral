/**
 * The client side of online rooms (peer-to-peer, no game server): create or join a room and relay answers directly between browsers. In a room one browser is the host (it runs the simulation and the 3D flight and publishes a small
 * snapshot of the game state); the others are players, who answer for their stations on a console screen.
 */
import { useSyncExternalStore } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Localized } from '@/mission';
import type { CrewRole } from './crew';

export type RoomSnapshot = {
  v: 1;
  phase: 'map' | 'hangar' | 'flight' | 'result' | 'replay';
  stage: string;
  stageTitle: Localized | null;
  clock: string;
  tm: { altitudeKm: number | null; distanceKm: number; speedKms: number; battery: number; health: number };
  tasks: { key: string; defId: string; role: CrewRole; kind: 'poll' | 'action'; leftS: number; windowS: number }[];
  points: number;
  names: string[];
  playerCount: number;
  lost: boolean;
  result: { outcome: 'success' | 'partial' | 'failure'; grade: string; total: number; max: number; players: { player: number; points: number }[]; mvp: number | null } | null;
};

export type RosterEntry = { index: number; name: string; connected: boolean };
export type RoomError = 'full' | 'not-found' | 'invalid' | 'rate_limited' | 'busy' | 'network' | 'closed';

export type OnlineState = {
  mode: 'off' | 'host' | 'client';
  code: string;
  token: string;
  /** This browser's player number (0 = host). */
  index: number;
  roster: RosterEntry[];
  /** The event stream is open. */
  connected: boolean;
  snapshot: RoomSnapshot | null;
  error: RoomError | null;
  busy: boolean;
};

const initial: OnlineState = { mode: 'off', code: '', token: '', index: 0, roster: [], connected: false, snapshot: null, error: null, busy: false };
export const onlineStore: StoreApi<OnlineState> = createStore<OnlineState>()(() => ({ ...initial }));
const set = (patch: Partial<OnlineState>) => onlineStore.setState(patch);

export type IncomingAction = { player: number; role: CrewRole; choice: 'go' | 'nogo' | 'do' };
let actionHandler: ((action: IncomingAction) => void) | null = null;
/** The host registers how answers from players are applied. */
export function setActionHandler(handler: ((action: IncomingAction) => void) | null) {
  actionHandler = handler;
}

type Wire =
  | { t: 'join'; name: string }
  | { t: 'welcome'; index: number; roster: RosterEntry[]; snapshot: RoomSnapshot | null }
  | { t: 'roster'; roster: RosterEntry[] }
  | { t: 'snapshot'; snapshot: RoomSnapshot }
  | { t: 'action'; role: CrewRole; choice: 'go' | 'nogo' | 'do' }
  | { t: 'full' }
  | { t: 'closed' };

/** The browsers talk to each other directly (WebRTC through PeerJS); there is no game server. PeerJS's public broker only introduces the peers. */
const MAX_PLAYERS = 4;
const ROLES: ReadonlySet<string> = new Set(['director', 'propulsion', 'power', 'comms']);
const CHOICES: ReadonlySet<string> = new Set(['go', 'nogo', 'do']);
const ID_PREFIX = 'nexus-room-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Conn = { send(data: unknown): void; close(): void; on(event: string, cb: (...args: never[]) => void): void; open: boolean };
type PeerLike = { destroy(): void; on(event: string, cb: (...args: never[]) => void): void; connect(id: string, options?: unknown): Conn };

let peer: PeerLike | null = null;
let hostLink: Conn | null = null;
const guests = new Map<number, { conn: Conn; name: string }>();
let hostName = '';
let lastSnapshot: RoomSnapshot | null = null;

const peerOptions = () => {
  const host = process.env.NEXT_PUBLIC_PEER_HOST;
  return host ? { host, port: Number(process.env.NEXT_PUBLIC_PEER_PORT ?? 443), path: process.env.NEXT_PUBLIC_PEER_PATH ?? '/', secure: process.env.NEXT_PUBLIC_PEER_SECURE !== 'false' } : {};
};
async function newPeer(id?: string): Promise<PeerLike> {
  const { Peer } = await import('peerjs');
  return (id ? new Peer(id, peerOptions()) : new Peer(peerOptions())) as unknown as PeerLike;
}
const randomCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const cleanName = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, 14) : '');

function rosterOf(): RosterEntry[] {
  const list: RosterEntry[] = [{ index: 0, name: hostName, connected: true }];
  for (let index = 1; index < MAX_PLAYERS; index += 1) { const guest = guests.get(index); if (guest) list.push({ index, name: guest.name, connected: guest.conn.open }); }
  return list;
}
function broadcast(message: Wire) { for (const { conn } of guests.values()) if (conn.open) conn.send(message); }
function pushRoster() { const roster = rosterOf(); set({ roster }); broadcast({ t: 'roster', roster }); }

function leaveLocal() {
  broadcast({ t: 'closed' });
  guests.clear();
  hostLink = null;
  peer?.destroy();
  peer = null;
  lastSnapshot = null;
  setActionHandler(null);
  onlineStore.setState({ ...initial });
}

function acceptGuest(conn: Conn) {
  conn.on('data', ((data: unknown) => {
    const message = data as Wire | null;
    if (!message || typeof message !== 'object') return;
    const existing = [...guests.entries()].find(([, guest]) => guest.conn === conn);
    if (message.t === 'join') {
      if (existing) return;
      const index = [1, 2, 3].find((slot) => !guests.has(slot) || !guests.get(slot)!.conn.open);
      const name = cleanName(message.name);
      if (index === undefined || !name) { conn.send({ t: 'full' } satisfies Wire); window.setTimeout(() => conn.close(), 300); return; }
      guests.set(index, { conn, name });
      pushRoster();
      conn.send({ t: 'welcome', index, roster: rosterOf(), snapshot: lastSnapshot } satisfies Wire);
    } else if (message.t === 'action' && existing && ROLES.has(message.role) && CHOICES.has(message.choice)) {
      actionHandler?.({ player: existing[0], role: message.role, choice: message.choice });
    }
  }) as never);
  conn.on('close', (() => { if ([...guests.values()].some((guest) => guest.conn === conn)) pushRoster(); }) as never);
}

export async function createRoom(name: string): Promise<boolean> {
  set({ busy: true, error: null });
  hostName = cleanName(name);
  if (!hostName) { set({ busy: false, error: 'invalid' }); return false; }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      const created = await newPeer(ID_PREFIX + code);
      const outcome = await new Promise<'open' | 'taken' | 'network'>((resolve) => {
        created.on('open', (() => resolve('open')) as never);
        created.on('error', ((error: { type?: string }) => resolve(error?.type === 'unavailable-id' ? 'taken' : 'network')) as never);
        window.setTimeout(() => resolve('network'), 12000);
      });
      if (outcome === 'taken') { created.destroy(); continue; }
      if (outcome === 'network') { created.destroy(); set({ busy: false, error: 'network' }); return false; }
      peer = created;
      created.on('connection', acceptGuest as never);
      created.on('disconnected', (() => set({ connected: false })) as never);
      set({ mode: 'host', code, token: '', index: 0, busy: false, snapshot: null, roster: rosterOf(), connected: true });
      return true;
    } catch {
      set({ busy: false, error: 'network' });
      return false;
    }
  }
  set({ busy: false, error: 'busy' });
  return false;
}

export async function joinRoom(code: string, name: string): Promise<boolean> {
  set({ busy: true, error: null });
  const clean = code.trim().toUpperCase();
  const player = cleanName(name);
  if (!/^[A-Z0-9]{5}$/.test(clean) || !player) { set({ busy: false, error: 'invalid' }); return false; }
  let created: PeerLike;
  try { created = await newPeer(); } catch { set({ busy: false, error: 'network' }); return false; }
  const result = await new Promise<'ok' | RoomError>((resolve) => {
    const fail = (reason: RoomError) => resolve(reason);
    created.on('error', ((error: { type?: string }) => fail(error?.type === 'peer-unavailable' ? 'not-found' : 'network')) as never);
    created.on('open', (() => {
      const conn = created.connect(ID_PREFIX + clean, { reliable: true });
      const timer = window.setTimeout(() => fail('not-found'), 12000);
      conn.on('open', (() => conn.send({ t: 'join', name: player } satisfies Wire)) as never);
      conn.on('data', ((data: unknown) => {
        const message = data as Wire;
        if (message.t === 'welcome') {
          window.clearTimeout(timer);
          hostLink = conn;
          set({ mode: 'client', code: clean, token: '', index: message.index, roster: message.roster, snapshot: message.snapshot, busy: false, connected: true });
          resolve('ok');
        } else if (message.t === 'full') { window.clearTimeout(timer); fail('full'); }
        else if (message.t === 'roster') set({ roster: message.roster });
        else if (message.t === 'snapshot') set({ snapshot: message.snapshot });
        else if (message.t === 'closed') { leaveLocal(); set({ error: 'closed' }); }
      }) as never);
      conn.on('close', (() => { if (onlineStore.getState().mode === 'client') { leaveLocal(); set({ error: 'closed' }); } }) as never);
    }) as never);
  });
  if (result !== 'ok') { created.destroy(); set({ busy: false, error: result }); return false; }
  peer = created;
  return true;
}

export async function leaveRoom(): Promise<void> {
  leaveLocal();
}

export async function publishSnapshot(snapshot: RoomSnapshot): Promise<void> {
  if (onlineStore.getState().mode !== 'host') return;
  lastSnapshot = snapshot;
  broadcast({ t: 'snapshot', snapshot });
}

export async function sendAnswer(role: CrewRole, choice: 'go' | 'nogo' | 'do'): Promise<void> {
  if (onlineStore.getState().mode !== 'client' || !hostLink?.open) return;
  hostLink.send({ t: 'action', role, choice } satisfies Wire);
}

export function useOnline<T>(selector: (state: OnlineState) => T): T {
  const read = () => selector(onlineStore.getState());
  return useSyncExternalStore(onlineStore.subscribe, read, read);
}
