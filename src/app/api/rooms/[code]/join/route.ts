import { z } from 'zod';
import { joinRoom } from '@/lib/server/rooms';
import { codeSchema, fail, limited, nameSchema, ok, readJson } from '@/lib/server/roomRoutes';


export async function POST(request: Request, ctx: RouteContext<'/api/rooms/[code]/join'>) {
  if (limited(request, 'join', 20, 60_000)) return fail('rate_limited', 429);
  const { code } = await ctx.params;
  const parsedCode = codeSchema.safeParse(code.toUpperCase());
  const parsed = z.object({ name: nameSchema }).strict().safeParse(await readJson(request));
  if (!parsedCode.success || !parsed.success) return fail('invalid', 400);
  const result = joinRoom(parsedCode.data, parsed.data.name);
  if (!result.ok) return fail(result.reason, result.reason === 'full' ? 409 : 404);
  return ok({ code: parsedCode.data, index: result.index, token: result.token, roster: result.roster, snapshot: result.snapshot });
}
