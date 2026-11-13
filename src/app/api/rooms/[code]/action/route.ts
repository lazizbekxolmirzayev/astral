import { z } from 'zod';
import { sendAction } from '@/lib/server/rooms';
import { codeSchema, fail, limited, ok, readJson } from '@/lib/server/roomRoutes';


/** A player answers for a station; the host checks the answer and applies it. */
export async function POST(request: Request, ctx: RouteContext<'/api/rooms/[code]/action'>) {
  if (limited(request, 'action', 240, 60_000)) return fail('rate_limited', 429);
  const { code } = await ctx.params;
  const parsedCode = codeSchema.safeParse(code.toUpperCase());
  const parsed = z.object({ token: z.string().min(8).max(64), role: z.enum(['director', 'propulsion', 'power', 'comms']), choice: z.enum(['go', 'nogo', 'do']) }).strict().safeParse(await readJson(request));
  if (!parsedCode.success || !parsed.success) return fail('invalid', 400);
  return sendAction(parsedCode.data, parsed.data.token, { role: parsed.data.role, choice: parsed.data.choice }) ? ok({}) : fail('forbidden', 403);
}
