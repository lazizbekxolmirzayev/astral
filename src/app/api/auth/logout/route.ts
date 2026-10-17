import { NextResponse } from 'next/server';
import { authAdapter } from '@/lib/server/auth-mongo';
import { clearSessionCookie, readSessionToken, requestHasSameOrigin, revokeDatabaseSession } from '@/lib/server/auth-api';
import { validateCsrf } from '@/lib/server/csrf';

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const sessionToken = readSessionToken(request);
  if (sessionToken && authAdapter.deleteSession) {
    await revokeDatabaseSession(authAdapter.deleteSession, sessionToken);
  }
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
