# Rate Limiting, Security Headers & CSRF

## Endpoints protected

| Endpoint | Method | Limit | Identifier | Purpose |
|---|---|---|---|---|
| `/api/auth/login` | POST | 5 req / 60 s | IP address | Brute-force / credential-stuffing protection |
| `/api/auth/register` | POST | 3 req / 60 s | IP address | Account creation spam / enumeration |
| `/api/experiments` | POST | 30 req / 60 s | Authenticated user id | Save experiment spam |
| `/api/experiments/share/[token]/report` | POST | 10 req / 60 s | IP address | Report spam |

When the user is logged in, save/report endpoints use the user id (`uid:...`);
anonymous endpoints fall back to the IP address (`ip:...`, taken from
`x-forwarded-for` / `x-real-ip`).

## How it works

- **Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`) implements fixed-window
  rate limiting. The client is identified by IP (or user id when authenticated).
- **Fail-open**: if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not
  configured, or Upstash is unreachable, every request is allowed. Rate limiting
  is defense-in-depth and never takes the site offline.
- **429 response**: when the limit is exceeded, the endpoint returns HTTP 429
  with a `Retry-After` header (seconds until the window resets) and a JSON body
  describing the limit.

## CSRF protection

All mutating routes (POST/PATCH/DELETE on auth and experiment endpoints) require
a double-submit CSRF token:

1. Client fetches `GET /api/auth/csrf-token`, which sets a non-HttpOnly
   `nexus_csrf` cookie and returns the token.
2. Client sends the cookie value in the `X-CSRF-Token` header on every
   mutating request.
3. Server rejects requests where the header does not match the cookie (HTTP 403).

Existing `Origin` same-origin checks remain in place as a second layer.

## Security headers (all responses)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

## Cost impact (Upstash)

Upstash Redis serverless is priced by **request count** and **data transfer**.
Rate-limit checks are tiny Redis commands (~100 bytes each). Estimated usage:

- 1 rate-limit `INCR`-equivalent per protected request.
- At 100k protected requests/month: ~100k rate-limit requests, well within
  Upstash's free tier (10k requests/day, ~300k/month). Paid tiers start at
  usage above the free allowance.
- No storage is consumed — rate-limit counters expire with the window.

If cost is a concern, raise the window sizes or lower `maxRequests` in
`src/lib/server/ratelimit.ts` (`RATE_LIMITS`).

## Privacy impact

- **IP addresses**: used only as an ephemeral rate-limit key, hashed in transit
  to Upstash over TLS. IPs are not stored long-term; Upstash expires counters
  at the end of each window.
- **User IDs**: for authenticated save endpoints, the identifier is `uid:<userId>`,
  not the IP. No additional personal data is sent to Upstash beyond the
  identifier string.
- **Cookies**: `nexus_csrf` is non-HttpOnly (readable by client JS) and
  SameSite=Lax. It contains a random token, not personal data.
- Upstash is a third-party subprocessor. If your deployment processes EU
  personal data, add Upstash to your data-processing agreements and privacy
  notice. Rate limiting can be disabled entirely by omitting the Upstash env
  vars (fail-open).

## Files changed

- `src/lib/server/ratelimit.ts` — Upstash rate-limit client, fail-open wrapper,
  per-endpoint limits
- `src/lib/server/csrf.ts` — double-submit CSRF token generation/validation
- `src/app/api/auth/csrf-token/route.ts` — issues the CSRF cookie
- `src/app/api/auth/login/route.ts` — CSRF + rate limit
- `src/app/api/auth/register/route.ts` — CSRF + rate limit
- `src/app/api/auth/logout/route.ts` — CSRF
- `src/app/api/experiments/route.ts` — CSRF + rate limit (save)
- `src/app/api/experiments/[id]/route.ts` — CSRF (PATCH, DELETE)
- `src/app/api/experiments/share/[shareToken]/report/route.ts` — CSRF + rate limit
- `next.config.ts` — CSP, HSTS, X-Content-Type-Options, Referrer-Policy
- `.env.example` — Upstash env vars
