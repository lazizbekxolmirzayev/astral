import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Shared Upstash rate-limiter client.
 *
 * When Upstash credentials are not configured (local development, tests, or a
 * Redis outage) the limiter fails open: `allow` always returns `{ success: true }`
 * so the site stays available. Rate limiting is a defense-in-depth layer, not a
 * hard availability gate.
 */
let ratelimit: Ratelimit | null = null;
export function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  if (!restUrl || !restToken) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url: restUrl, token: restToken }),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    // Upstash edge caching; false is fine for server-side Node routes.
    analytics: true,
  });
  return ratelimit;
}

/**
 * Identifier for rate limiting. Prefer the authenticated user id so a shared
 * IP (e.g. a school or office NAT) doesn't punish unrelated users; fall back to
 * the IP address for anonymous endpoints such as login/register.
 */
export function rateLimitIdentifier(request: Request, userId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') ?? 'unknown';
  return userId ? `uid:${userId}` : `ip:${ip}`;
}

/**
 * Runs a rate-limit check. Returns `{ allowed, remaining, reset }`.
 * Fails open (allowed: true) when Upstash is not configured or unreachable.
 */
export async function rateLimit(
  request: Request,
  options: { identifier: string; cost?: number },
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const rl = getRatelimit();
  if (!rl) {
    return { allowed: true, remaining: -1, reset: 0 };
  }
  try {
    const result = await rl.limit(options.identifier, { rate: options.cost ?? 1 });
    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch {
    // Upstash unreachable: fail open.
    return { allowed: true, remaining: -1, reset: 0 };
  }
}

/** Pre-configured rate-limit windows for each mutating endpoint family. */
export const RATE_LIMITS = {
  /** Login: brute-force protection. Strict per-IP window. */
  login: { maxRequests: 5, windowMs: 60 * 1000 },
  /** Registration: prevent account spam/enumeration. Strict per-IP window. */
  register: { maxRequests: 3, windowMs: 60 * 1000 },
  /** Saving experiments: generous per-user window. */
  save: { maxRequests: 30, windowMs: 60 * 1000 },
  /** Reporting: prevent spam. Per-IP window. */
  report: { maxRequests: 10, windowMs: 60 * 1000 },
} as const;
