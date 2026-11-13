import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Online rooms for the crew game. One player hosts (their browser runs the simulation and the 3D flight); up to three
 * more join with a short code and sit at stations on their own device. The server only relays messages: the host's
 * state snapshots go to the players, the players' answers go to the host. Rooms live in this server process's memory
 * (they disappear on restart and are not shared between several server instances), so the feature needs one
 * long-running Node server (`next start`), not a serverless deployment.
 */
export const MAX_ROOM_PLAYERS = 4;
export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
export const MAX_ROOMS = 300;
export const MAX_SNAPSHOT_BYTES = 16_000;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{5}$/;

export type RoomEvent = 'roster' | 'snapshot' | 'action' | 'closed';
type Send = (event: RoomEvent, data: unknown) => void;

type Player = { index: number; id: string; name: string; token: string };
type Room = { code: string; createdAt: number; lastSeen: number; hostToken: string; players: Player[]; snapshot: unknown; subscribers: Map<string, { index: number; send: Send }> };

const globalRooms = globalThis as unknown as { __nexusRooms?: Map<string, Room> };
const rooms = (globalRooms.__nexusRooms ??= new Map<string, Room>());

const token = () => randomBytes(18).toString('base64url');
const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function sweep(now: number) {
  for (const [code, room] of rooms) {
    if (now - room.lastSeen > ROOM_TTL_MS) {
      room.subscribers.forEach((subscriber) => subscriber.send('closed', {}));
      rooms.delete(code);
    }
  }
}

export type RosterEntry = { index: number; name: string; connected: boolean };
export const rosterOf = (room: Room): RosterEntry[] => room.players.map((player) => ({ index: player.index, name: player.name, connected: [...room.subscribers.values()].some((subscriber) => subscriber.index === player.index) }));
const broadcastRoster = (room: Room) => room.subscribers.forEach((subscriber) => subscriber.send('roster', rosterOf(room)));

export function createRoom(hostName: string, now = Date.now()): { code: string; hostToken: string } | null {
  sweep(now);
  if (rooms.size >= MAX_ROOMS) return null;
  let code = '';
  do { code = Array.from(randomBytes(5), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join(''); } while (rooms.has(code));
  const hostToken = token();
  rooms.set(code, { code, createdAt: now, lastSeen: now, hostToken, players: [{ index: 0, id: 'p0', name: hostName, token: hostToken }], snapshot: null, subscribers: new Map() });
  return { code, hostToken };
}

export type JoinResult = { ok: true; index: number; token: string; roster: RosterEntry[]; snapshot: unknown } | { ok: false; reason: 'not-found' | 'full' };

export function joinRoom(code: string, name: string, now = Date.now()): JoinResult {
  const room = rooms.get(code);
  if (!room) return { ok: false, reason: 'not-found' };
  if (room.players.length >= MAX_ROOM_PLAYERS) return { ok: false, reason: 'full' };
  const index = room.players.length;
  const player: Player = { index, id: `p${index}`, name, token: token() };
  room.players.push(player);
  room.lastSeen = now;
  broadcastRoster(room);
  return { ok: true, index, token: player.token, roster: rosterOf(room), snapshot: room.snapshot };
}

/** Which player a token belongs to (0 = host), or null. */
export function whoIs(code: string, tokenValue: string): number | null {
  const room = rooms.get(code);
  if (!room || tokenValue.length === 0) return null;
  return room.players.find((player) => sameToken(player.token, tokenValue))?.index ?? null;
}

export function publishSnapshot(code: string, hostTokenValue: string, snapshot: unknown, now = Date.now()): boolean {
  const room = rooms.get(code);
  if (!room || !sameToken(room.hostToken, hostTokenValue)) return false;
  room.snapshot = snapshot;
  room.lastSeen = now;
  room.subscribers.forEach((subscriber) => { if (subscriber.index !== 0) subscriber.send('snapshot', snapshot); });
  return true;
}

export type RoomAction = { role: 'director' | 'propulsion' | 'power' | 'comms'; choice: 'go' | 'nogo' | 'do' };

/** Forwards a player's answer to the host; the host decides whether it is valid. */
export function sendAction(code: string, tokenValue: string, action: RoomAction, now = Date.now()): boolean {
  const room = rooms.get(code);
  const index = whoIs(code, tokenValue);
  if (!room || index === null || index === 0) return false;
  room.lastSeen = now;
  room.subscribers.forEach((subscriber) => { if (subscriber.index === 0) subscriber.send('action', { player: index, ...action }); });
  return true;
}

export function subscribe(code: string, tokenValue: string, send: Send): { ok: true; unsubscribe: () => void; roster: RosterEntry[]; snapshot: unknown; index: number } | { ok: false } {
  const room = rooms.get(code);
  const index = whoIs(code, tokenValue);
  if (!room || index === null) return { ok: false };
  const id = token();
  room.subscribers.set(id, { index, send });
  room.lastSeen = Date.now();
  broadcastRoster(room);
  return { ok: true, index, roster: rosterOf(room), snapshot: room.snapshot, unsubscribe: () => { room.subscribers.delete(id); broadcastRoster(room); } };
}

export function closeRoom(code: string, hostTokenValue: string): boolean {
  const room = rooms.get(code);
  if (!room || !sameToken(room.hostToken, hostTokenValue)) return false;
  room.subscribers.forEach((subscriber) => subscriber.send('closed', {}));
  rooms.delete(code);
  return true;
}

export const roomCount = () => rooms.size;
export function resetRoomsForTests() { rooms.clear(); }

/** A small in-memory limiter per client address, for the endpoints that create or join rooms. */
const hits = new Map<string, number[]>();
export function tooManyRequests(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((time) => now - time >= windowMs)) hits.delete(k);
  return recent.length > limit;
}
