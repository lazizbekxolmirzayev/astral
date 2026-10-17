import { NextResponse } from 'next/server';
import { getShareableExperiment } from '@/lib/server/experiment-sharing';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: RouteContext<'/api/experiments/share/[shareToken]'>) {
  const { shareToken } = await context.params;
  const experiment = await getShareableExperiment(shareToken);
  if (!experiment) return NextResponse.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
  return NextResponse.json({ success: true, data: experiment });
}
