import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CODE_PATTERN, MAX_SNAPSHOT_BYTES, tooManyRequests } from './rooms';

export const nameSchema = z.string().trim().min(1).max(14);
export const codeSchema = z.string().regex(CODE_PATTERN);

export const fail = (code: string, status: number) => NextResponse.json({ success: false, error: { code } }, { status });
export const ok = (data: unknown) => NextResponse.json({ success: true, data });

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0]!.trim() : request.headers.get('x-real-ip') ?? 'unknown';
}

export const limited = (request: Request, bucket: string, limit: number, windowMs: number) => tooManyRequests(`${bucket}:${clientKey(request)}`, limit, windowMs);

/** Reads a small JSON body; null when it is too large or not JSON. */
export async function readJson(request: Request, maxBytes = 2000): Promise<unknown | null> {
  const text = await request.text().catch(() => '');
  if (text.length === 0 || text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}
export { MAX_SNAPSHOT_BYTES };
