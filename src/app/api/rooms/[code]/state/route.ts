import { z } from 'zod';
import { closeRoom, publishSnapshot } from '@/lib/server/rooms';
import { codeSchema, fail, limited, MAX_SNAPSHOT_BYTES, ok, readJson } from '@/lib/server/roomRoutes';


/** The host publishes the current game state; the server relays it to the players. */
export async function POST(request: Request, ctx: RouteContext<'/api/rooms/[code]/state'>) {
  if (limited(request, 'state', 600, 60_000)) return fail('rate_limited', 429);
  const { code } = await ctx.params;
  const parsedCode = codeSchema.safeParse(code.toUpperCase());
  const body = await readJson(request, MAX_SNAPSHOT_BYTES);
  const parsed = z.object({ token: z.string().min(8).max(64), snapshot: z.record(z.string(), z.unknown()).optional(), close: z.boolean().optional() }).strict().safeParse(body);
  if (!parsedCode.success || !parsed.success) return fail('invalid', 400);
  if (parsed.data.close) return closeRoom(parsedCode.data, parsed.data.token) ? ok({}) : fail('forbidden', 403);
  if (!parsed.data.snapshot) return fail('invalid', 400);
  return publishSnapshot(parsedCode.data, parsed.data.token, parsed.data.snapshot) ? ok({}) : fail('forbidden', 403);
}
