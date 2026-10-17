import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { AdapterSession } from 'next-auth/adapters';

export const SESSION_COOKIE = process.env.AUTH_COOKIE_SECURE === 'false'
  ? 'authjs.session-token'
  : '__Secure-authjs.session-token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function requestHasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === new URL(request.url).origin;
}

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    const value = pair.slice(separator + 1).trim();
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  return null;
}

export async function createDatabaseSession(
  createSession: (session: { sessionToken: string; userId: string; expires: Date }) => unknown | Promise<unknown>,
  userId: string,
): Promise<string> {
  const sessionToken = randomBytes(32).toString('hex');
  await createSession({
    sessionToken,
    userId,
    expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return sessionToken;
}

export async function revokeDatabaseSession(
  deleteSession: (sessionToken: string) => unknown | Promise<unknown>,
  sessionToken: string,
): Promise<void> {
  await deleteSession(sessionToken);
}

export function attachSessionCookie(response: NextResponse, sessionToken: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: SESSION_COOKIE.startsWith('__Secure-'),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: SESSION_COOKIE.startsWith('__Secure-'),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function isAdapterSession(value: unknown): value is AdapterSession {
  return typeof value === 'object' && value !== null && 'sessionToken' in value;
}
