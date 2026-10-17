import { NextResponse } from 'next/server';
import { listPublicExperiments } from '@/lib/server/experiment-sharing';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await listPublicExperiments(url.searchParams.get('q') ?? '', page, 12);
  return NextResponse.json({ success: true, data: result });
}
