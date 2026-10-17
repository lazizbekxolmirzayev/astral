import { describe, expect, it, vi } from 'vitest';
import { createDatabaseSession, readSessionToken, revokeDatabaseSession, SESSION_COOKIE } from './auth-api';

describe('database auth sessions', () => {
  it('creates a random opaque token and removes it on logout', async () => {
    const sessions = new Map<string, { userId: string; expires: Date }>();
    const create = vi.fn(async ({ sessionToken, userId, expires }: { sessionToken: string; userId: string; expires: Date }) => {
      sessions.set(sessionToken, { userId, expires });
    });
    const remove = vi.fn(async (token: string) => { sessions.delete(token); });

    const token = await createDatabaseSession(create, 'user-1');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions.get(token)?.userId).toBe('user-1');
    const parsed = readSessionToken(new Request('https://example.test/api/auth/me', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }));
    expect(parsed).toBe(token);

    await revokeDatabaseSession(remove, token);
    expect(sessions.has(token)).toBe(false);
  });
});
