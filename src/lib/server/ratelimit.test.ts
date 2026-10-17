import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const limitMock = vi.fn();

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(vi.fn().mockImplementation(function () {
    return { limit: limitMock };
  }), { slidingWindow: vi.fn(() => vi.fn()) }),
}));
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function () {
    return { limit: limitMock };
  }),
}));

function requestWithHeaders(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function importRateLimit() {
  return import('./ratelimit');
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('fails open when Upstash is not configured', async () => {
    const { rateLimit } = await importRateLimit();
    const result = await rateLimit(requestWithHeaders(), {
      identifier: 'ip:127.0.0.1',
      cost: 1,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
    expect(result.reset).toBe(0);
  });

  it('allows requests under the limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    limitMock.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });

    const { rateLimit } = await importRateLimit();
    const result = await rateLimit(requestWithHeaders(), {
      identifier: 'ip:127.0.0.1',
      cost: 1,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(limitMock).toHaveBeenCalledWith('ip:127.0.0.1', { rate: 1 });
  });

  it('rejects requests over the limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const reset = Date.now() + 30_000;
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset });

    const { rateLimit } = await importRateLimit();
    const result = await rateLimit(requestWithHeaders(), {
      identifier: 'ip:127.0.0.1',
      cost: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBe(reset);
  });

  it('fails open when Upstash throws', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    limitMock.mockRejectedValue(new Error('network error'));

    const { rateLimit } = await importRateLimit();
    const result = await rateLimit(requestWithHeaders(), {
      identifier: 'ip:127.0.0.1',
      cost: 1,
    });

    expect(result.allowed).toBe(true);
  });

  it('uses user id when authenticated, IP otherwise', async () => {
    const { rateLimitIdentifier } = await importRateLimit();
    const req = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    expect(rateLimitIdentifier(req)).toBe('ip:203.0.113.10');
    expect(rateLimitIdentifier(req, 'user-abc')).toBe('uid:user-abc');
  });

  it('RATE_LIMITS has expected windows', async () => {
    const { RATE_LIMITS } = await importRateLimit();
    expect(RATE_LIMITS.login.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.windowMs).toBe(60 * 1000);
    expect(RATE_LIMITS.register.maxRequests).toBe(3);
    expect(RATE_LIMITS.save.maxRequests).toBe(30);
    expect(RATE_LIMITS.report.maxRequests).toBe(10);
  });
});
