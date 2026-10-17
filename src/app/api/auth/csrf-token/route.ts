import { NextResponse } from 'next/server';
import { generateCsrfToken, attachCsrfCookie } from '@/lib/server/csrf';

/**
 * Issues a CSRF token to the client via a non-HttpOnly cookie (`nexus_csrf`)
 * and returns it in the response body. The client reads the cookie (or the
 * body) and echoes it back in the `X-CSRF-Token` header on mutating requests
 * (double-submit cookie pattern). SameSite=Lax prevents the cookie from being
 * sent on cross-site top-level navigations.
 */
export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  return attachCsrfCookie(response, token);
}
