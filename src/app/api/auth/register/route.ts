import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { authAdapter } from '@/lib/server/auth-mongo';
import { connectMongo } from '@/lib/server/mongodb';
import { attachSessionCookie, createDatabaseSession, requestHasSameOrigin } from '@/lib/server/auth-api';
import { hashPassword, isPasswordLengthValid, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/server/password';
import { rateLimit, rateLimitIdentifier } from '@/lib/server/ratelimit';
import { validateCsrf } from '@/lib/server/csrf';
import User from '@/models/User';

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().refine(isPasswordLengthValid, `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`),
  name: z.string().trim().max(80).optional(),
}).strict();

function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many registration attempts. Please try again later.' },
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

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  try {
    await connectMongo();
    await User.init();
    const existing = await User.exists({ email });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });

    const user = await authAdapter.createUser!({
      id: new ObjectId().toHexString(),
      name: parsed.data.name || null,
      email,
      emailVerified: null,
      image: null,
    });
    try {
      const passwordHash = await hashPassword(parsed.data.password);
      await User.updateOne({ _id: user.id }, { $set: { passwordHash, role: 'user' } });
      const sessionToken = await createDatabaseSession(authAdapter.createSession!, user.id);
      const response = NextResponse.json({ user: { id: user.id, email, name: user.name, role: 'user' } }, { status: 201 });
      return attachSessionCookie(response, sessionToken);
    } catch (error) {
      await authAdapter.deleteUser?.(user.id);
      throw error;
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    console.error('Registration failed', error);
    return NextResponse.json({ error: 'Unable to create the account' }, { status: 500 });
  }
}
