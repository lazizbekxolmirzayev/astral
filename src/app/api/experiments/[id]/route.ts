import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { scenarioSchema } from '@/lib/schemas/scenario';
import { connectMongo } from '@/lib/server/mongodb';
import { validateCsrf } from '@/lib/server/csrf';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  schemaVersion: z.literal(1).optional(),
  data: scenarioSchema.optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function jsonError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: { code, message, ...(extra ?? {}) } }, { status });
}

async function loadOwnedExperiment(userId: string, id: string) {
  const experiment = await SavedExperiment.findOne({ _id: id }).lean();
  if (!experiment) return { experiment: null, forbidden: false };
  if (String(experiment.owner) !== String(userId)) {
    return { experiment, forbidden: true };
  }
  return { experiment, forbidden: false };
}

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError('unauthorized', 'Authentication required.', 401);
  }

  const { id } = await context.params;
  await connectMongo();

  const result = await loadOwnedExperiment(session.user.id, id);
  if (result.experiment === null) {
    return jsonError('not_found', 'Experiment not found.', 404);
  }
  if (result.forbidden) {
    return jsonError('forbidden', 'You do not have access to this experiment.', 403);
  }

  const parsed = scenarioSchema.safeParse(result.experiment.data);
  if (!parsed.success || result.experiment.schemaVersion !== 1) {
    return jsonError('invalid_scenario', 'Experiment data is invalid.', 422);
  }

  return NextResponse.json({ success: true, data: { ...result.experiment, data: parsed.data } });
}

export async function PATCH(request: Request, context: Context) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return jsonError('unauthorized', 'Authentication required.', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('invalid_input', 'The request payload is invalid.', 400, {
      fields: parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
    });
  }

  const { id } = await context.params;
  await connectMongo();

  const result = await loadOwnedExperiment(session.user.id, id);
  if (result.experiment === null) {
    return jsonError('not_found', 'Experiment not found.', 404);
  }
  if (result.forbidden) {
    return jsonError('forbidden', 'You do not have permission to edit this experiment.', 403);
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (update.visibility === 'private') {
    update.shareToken = undefined;
  }
  if (update.visibility && update.visibility !== 'private') {
    update.shareToken = (await import('nanoid')).nanoid(22);
  }

  const experiment = await SavedExperiment.findOneAndUpdate(
    { _id: id, owner: session.user.id },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();

  return NextResponse.json({ success: true, data: experiment });
}

export async function DELETE(request: Request, context: Context) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return jsonError('unauthorized', 'Authentication required.', 401);
  }

  const { id } = await context.params;
  await connectMongo();

  const result = await loadOwnedExperiment(session.user.id, id);
  if (result.experiment === null) {
    return jsonError('not_found', 'Experiment not found.', 404);
  }
  if (result.forbidden) {
    return jsonError('forbidden', 'You do not have permission to delete this experiment.', 403);
  }

  await SavedExperiment.findOneAndDelete({ _id: id, owner: session.user.id });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
