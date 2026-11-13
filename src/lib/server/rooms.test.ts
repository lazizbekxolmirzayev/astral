import { beforeEach, describe, expect, it } from 'vitest';
import { closeRoom, createRoom, joinRoom, publishSnapshot, resetRoomsForTests, sendAction, subscribe, tooManyRequests, whoIs, CODE_PATTERN, MAX_ROOM_PLAYERS } from './rooms';

beforeEach(() => resetRoomsForTests());

describe('rooms', () => {
  it('creates a room with a valid code and lets up to four players in', () => {
    const room = createRoom('Host')!;
    expect(room.code).toMatch(CODE_PATTERN);
    for (let i = 1; i < MAX_ROOM_PLAYERS; i += 1) expect(joinRoom(room.code, `P${i}`)).toMatchObject({ ok: true, index: i });
    expect(joinRoom(room.code, 'Late')).toEqual({ ok: false, reason: 'full' });
    expect(joinRoom('AAAAA', 'X')).toEqual({ ok: false, reason: 'not-found' });
  });
  it('relays snapshots to players only and actions to the host only', () => {
    const room = createRoom('Host')!;
    const guest = joinRoom(room.code, 'Ali');
    if (!guest.ok) throw new Error('join');
    const host: string[] = [];
    const player: string[] = [];
    subscribe(room.code, room.hostToken, (event) => host.push(event));
    subscribe(room.code, guest.token, (event) => player.push(event));
    expect(publishSnapshot(room.code, room.hostToken, { phase: 'flight' })).toBe(true);
    expect(publishSnapshot(room.code, guest.token, { phase: 'hack' })).toBe(false);
    expect(player).toContain('snapshot');
    expect(host).not.toContain('snapshot');
    expect(sendAction(room.code, guest.token, { role: 'power', choice: 'go' })).toBe(true);
    expect(host).toContain('action');
    expect(sendAction(room.code, room.hostToken, { role: 'power', choice: 'go' })).toBe(false);
    expect(sendAction(room.code, 'wrong-token-xyz', { role: 'power', choice: 'go' })).toBe(false);
    expect(whoIs(room.code, guest.token)).toBe(1);
  });
  it('only the host can close a room', () => {
    const room = createRoom('Host')!;
    const guest = joinRoom(room.code, 'Ali');
    if (!guest.ok) throw new Error('join');
    expect(closeRoom(room.code, guest.token)).toBe(false);
    expect(closeRoom(room.code, room.hostToken)).toBe(true);
    expect(joinRoom(room.code, 'Z')).toEqual({ ok: false, reason: 'not-found' });
  });
  it('limits how often one address may call', () => {
    for (let i = 0; i < 3; i += 1) expect(tooManyRequests('k', 3, 1000, 100)).toBe(false);
    expect(tooManyRequests('k', 3, 1000, 200)).toBe(true);
    expect(tooManyRequests('k', 3, 1000, 5000)).toBe(false);
  });
});
