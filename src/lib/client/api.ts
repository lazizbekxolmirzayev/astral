const CSRF_COOKIE = 'nexus_csrf';

function readCsrfCookie(): string | null {
  for (const pair of document.cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === CSRF_COOKIE) {
      return decodeURIComponent(pair.slice(separator + 1).trim()) || null;
    }
  }
  return null;
}

/** Returns the double-submit CSRF token, asking the server to issue one if the cookie is missing. */
export async function ensureCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  const response = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
  const body = (await response.json()) as { csrfToken?: string };
  return readCsrfCookie() ?? body.csrfToken ?? '';
}

/** fetch() for mutating API calls: same-origin cookies plus the x-csrf-token header. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await ensureCsrfToken();
  const headers = new Headers(init.headers);
  headers.set('x-csrf-token', token);
  if (init.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
