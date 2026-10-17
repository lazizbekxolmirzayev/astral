import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ModerationRecord } from '@/lib/models/ModerationRecord';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { connectMongo } from '@/lib/server/mongodb';
import { reportReasonSchema } from '@/lib/server/experiment-sharing';
import { requestHasSameOrigin } from '@/lib/server/auth-api';
import { rateLimit, rateLimitIdentifier } from '@/lib/server/ratelimit';
import { validateCsrf } from '@/lib/server/csrf';

function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: { code: 'rate_limited', message: 'Too many report attempts. Please try again later.' } },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

export async function POST(request: Request, context: RouteContext<'/api/experiments/share/[shareToken]/report'>) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;
  if (!requestHasSameOrigin(request)) return NextResponse.json({ success: false, error: { code: 'invalid_origin' } }, { status: 403 });

  const rate = await rateLimit(request, {
    identifier: rateLimitIdentifier(request),
    cost: 1,
  });
  if (!rate.allowed) return rateLimitResponse(rate.reset);
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const parsed = reportReasonSchema.safeParse(body?.reason);
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'invalid_reason' } }, { status: 400 });

  const { shareToken } = await context.params;
  await connectMongo();
  const experiment = await SavedExperiment.findOne({ shareToken, visibility: { $in: ['public', 'unlisted'] } }).select('_id shareToken').lean();
  if (!experiment) return NextResponse.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
  const session = await auth();
  await ModerationRecord.create({
    experimentId: experiment._id,
    shareToken,
    reporterId: session?.user?.id ?? null,
    reason: parsed.data,
  });
  return NextResponse.json({ success: true, data: { submitted: true } }, { status: 201 });
}
