import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SavedExperiment } from '@/lib/models/SavedExperiment';
import { connectMongo } from '@/lib/server/mongodb';

function sanitizeFilter(raw: string | null): Record<string, unknown> | undefined {
  if (!raw || raw.trim() === '') return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid_filter');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('invalid_filter');
  }

  const filter = parsed as Record<string, unknown>;
  const hasDangerousKey = Object.keys(filter).some((key) => key.startsWith('$'));
  if (hasDangerousKey) {
    throw new Error('invalid_filter');
  }

  for (const [key, value] of Object.entries(filter)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (Object.keys(nested).some((nestedKey) => nestedKey.startsWith('$'))) {
        throw new Error('invalid_filter');
      }
    }
  }

  return filter;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: { code: 'unauthorized', message: 'Authentication required.' } }, { status: 401 });
  }

  let filter: Record<string, unknown> | undefined;
  try {
    const rawFilter = new URL(request.url).searchParams.get('filter');
    filter = sanitizeFilter(rawFilter);
  } catch {
    return NextResponse.json({ success: false, error: { code: 'invalid_filter', message: 'Query filter is invalid.' } }, { status: 400 });
  }

  await connectMongo();
  const records = await SavedExperiment.find({ owner: session.user.id, ...(filter ?? {}) }).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ success: true, data: records });
}
