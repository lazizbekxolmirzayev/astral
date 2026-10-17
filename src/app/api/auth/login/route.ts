import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authAdapter } from '@/lib/server/auth-mongo';
import { connectMongo } from '@/lib/server/mongodb';
import { attachSessionCookie, createDatabaseSession, requestHasSameOrigin } from '@/lib/server/auth-api';
import { isPasswordLengthValid, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, verifyPassword } from '@/lib/server/password';
import { rateLimit, rateLimitIdentifier } from '@/lib/server/ratelimit';
import { validateCsrf } from '@/lib/server/csrf';
import User from '@/models/User';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().refine(isPasswordLengthValid, `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`),
}).strict();

function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many login attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });

  const rate = await rateLimit(request, {
    identifier: rateLimitIdentifier(request),
    cost: 1,
  });
  if (!rate.allowed) return rateLimitResponse(rate.reset);

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });

  try {
    await connectMongo();
    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const sessionToken = await createDatabaseSession(authAdapter.createSession!, user.id);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    return attachSessionCookie(response, sessionToken);
  } catch (error) {
    console.error('Login failed', error);
    return NextResponse.json({ error: 'Unable to sign in' }, { status: 500 });
  }
}
