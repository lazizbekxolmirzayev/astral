import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { scenarioSchema } from '@/lib/schemas/scenario';
import { connectMongo } from '@/lib/server/mongodb';
import { rateLimit, rateLimitIdentifier } from '@/lib/server/ratelimit';
import { validateCsrf } from '@/lib/server/csrf';

export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  schemaVersion: z.literal(1),
  data: scenarioSchema,
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
}).strict().transform((value) => ({
  ...value,
  owner: undefined,
}));

function jsonError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: { code, message, ...(extra ?? {}) } }, { status });
}

function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: { code: 'rate_limited', message: 'Too many save attempts. Please try again later.' } },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return jsonError('unauthorized', 'Authentication required.', 401);
  }

  const rate = await rateLimit(request, {
    identifier: rateLimitIdentifier(request, session.user.id),
    cost: 1,
  });
  if (!rate.allowed) return rateLimitResponse(rate.reset);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('invalid_input', 'The request payload is invalid.', 400, {
      fields: parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
    });
  }

  const { title, description, schemaVersion, data, visibility } = parsed.data;

  await connectMongo();
  const shareToken = visibility === 'private' ? undefined : (await import('nanoid')).nanoid(22);
  const experiment = await SavedExperiment.create({
    owner: String(session.user.id),
    title,
    description,
    schemaVersion,
    data,
    visibility,
    ...(shareToken ? { shareToken } : {}),
  });

  return NextResponse.json({ success: true, data: experiment.toObject() }, { status: 201 });
}
