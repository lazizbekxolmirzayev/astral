import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

const CSRF_COOKIE = 'nexus_csrf';
const CSRF_HEADER = 'x-csrf-token';

/** CSRF tokens are 32 random bytes hex-encoded. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Attaches the CSRF token cookie to a response. The cookie is NOT HttpOnly so
 * the client-side JavaScript can read it and echo it back in the
 * `X-CSRF-Token` header (double-submit cookie pattern). SameSite=Lax prevents
 * the cookie from being sent on cross-site top-level navigations.
 */
export function attachCsrfCookie(response: NextResponse, token: string): NextResponse {
  const secure = process.env.AUTH_COOKIE_SECURE !== 'false';
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

/**
 * Reads the CSRF token from the request cookie.
 */
export function readCsrfCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== CSRF_COOKIE) continue;
    return pair.slice(separator + 1).trim() || null;
  }
  return null;
}

/**
 * Validates a double-submit CSRF token: the `X-CSRF-Token` header value must
 * match the `nexus_csrf` cookie value. Returns null on success or an error
 * response on failure.
 */
export function validateCsrf(request: Request): NextResponse | null {
  const cookieToken = readCsrfCookie(request);
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { success: false, error: { code: 'csrf_invalid', message: 'CSRF token missing or mismatched.' } },
      { status: 403 },
    );
  }
  return null;
}

export { CSRF_COOKIE, CSRF_HEADER };
