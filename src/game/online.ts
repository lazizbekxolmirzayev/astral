/**
 * The client side of online rooms (see `src/lib/server/rooms.ts`): create or join a room, keep the event stream open,
 * and relay answers. In a room one browser is the host (it runs the simulation and the 3D flight and publishes a small
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

let source: EventSource | null = null;
const closeStream = () => { source?.close(); source = null; };

function openStream(code: string, token: string) {
  closeStream();
  const stream = new EventSource(`/api/rooms/${code}/events?token=${encodeURIComponent(token)}`);
  source = stream;
  stream.onopen = () => set({ connected: true });
  stream.onerror = () => set({ connected: false });
  const parse = (event: Event) => { try { return JSON.parse((event as MessageEvent<string>).data) as unknown; } catch { return null; } };
  stream.addEventListener('roster', (event) => { const data = parse(event); if (Array.isArray(data)) set({ roster: data as RosterEntry[] }); });
  stream.addEventListener('snapshot', (event) => { const data = parse(event); if (data && typeof data === 'object') set({ snapshot: data as RoomSnapshot }); });
  stream.addEventListener('action', (event) => { const data = parse(event) as IncomingAction | null; if (data && actionHandler) actionHandler(data); });
  stream.addEventListener('closed', () => { leaveLocal(); set({ error: 'closed' }); });
}

function leaveLocal() {
  closeStream();
  setActionHandler(null);
  onlineStore.setState({ ...initial });
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    const json = (await response.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: { code?: string } } | null;
    return json?.success ? { ok: true, data: json.data } : { ok: false, error: json?.error?.code ?? 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
const asError = (code: string | undefined): RoomError => (['full', 'not-found', 'invalid', 'rate_limited', 'busy'].includes(code ?? '') ? (code as RoomError) : 'network');

export async function createRoom(name: string): Promise<boolean> {
  set({ busy: true, error: null });
  const result = await post('/api/rooms', { name });
  if (!result.ok) { set({ busy: false, error: asError(result.error) }); return false; }
  const { code, hostToken } = result.data as { code: string; hostToken: string };
  set({ mode: 'host', code, token: hostToken, index: 0, busy: false, snapshot: null });
  openStream(code, hostToken);
  return true;
}

export async function joinRoom(code: string, name: string): Promise<boolean> {
  set({ busy: true, error: null });
  const clean = code.trim().toUpperCase();
  const result = await post(`/api/rooms/${clean}/join`, { name });
  if (!result.ok) { set({ busy: false, error: asError(result.error) }); return false; }
  const data = result.data as { code: string; index: number; token: string; roster: RosterEntry[]; snapshot: RoomSnapshot | null };
  set({ mode: 'client', code: data.code, token: data.token, index: data.index, roster: data.roster, snapshot: data.snapshot, busy: false });
  openStream(data.code, data.token);
  return true;
}

export async function leaveRoom(): Promise<void> {
  const { mode, code, token } = onlineStore.getState();
  if (mode === 'host') await post(`/api/rooms/${code}/state`, { token, close: true });
  leaveLocal();
}

export async function publishSnapshot(snapshot: RoomSnapshot): Promise<void> {
  const { mode, code, token } = onlineStore.getState();
  if (mode !== 'host') return;
  await post(`/api/rooms/${code}/state`, { token, snapshot });
}

export async function sendAnswer(role: CrewRole, choice: 'go' | 'nogo' | 'do'): Promise<void> {
  const { mode, code, token } = onlineStore.getState();
  if (mode !== 'client') return;
  await post(`/api/rooms/${code}/action`, { token, role, choice });
}

export function useOnline<T>(selector: (state: OnlineState) => T): T {
  const read = () => selector(onlineStore.getState());
  return useSyncExternalStore(onlineStore.subscribe, read, read);
}
