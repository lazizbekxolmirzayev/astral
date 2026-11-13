import { z } from 'zod';
import { createRoom } from '@/lib/server/rooms';
import { fail, limited, nameSchema, ok, readJson } from '@/lib/server/roomRoutes';


/** Creates a room. The caller becomes the host (player 1) and gets the secret host token. */
export async function POST(request: Request) {
  if (limited(request, 'create', 8, 60_000)) return fail('rate_limited', 429);
  const parsed = z.object({ name: nameSchema }).strict().safeParse(await readJson(request));
  if (!parsed.success) return fail('invalid', 400);
  const room = createRoom(parsed.data.name);
  return room ? ok(room) : fail('busy', 503);
}
