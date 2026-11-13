import { subscribe, type RoomEvent } from '@/lib/server/rooms';
import { codeSchema } from '@/lib/server/roomRoutes';


/** Server-sent events: `roster`, `snapshot` (to players), `action` (to the host) and `closed`. */
export async function GET(request: Request, ctx: RouteContext<'/api/rooms/[code]/events'>) {
  const { code } = await ctx.params;
  const parsedCode = codeSchema.safeParse(code.toUpperCase());
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!parsedCode.success || token.length < 8 || token.length > 64) return new Response(null, { status: 400 });
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: RoomEvent, data: unknown) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* the client is gone */ }
      };
      const subscription = subscribe(parsedCode.data, token, send);
      if (!subscription.ok) { controller.close(); return; }
      send('roster', subscription.roster);
      if (subscription.index !== 0 && subscription.snapshot) send('snapshot', subscription.snapshot);
      const keepAlive = setInterval(() => { try { controller.enqueue(encoder.encode(': keep-alive\n\n')); } catch { /* closed */ } }, 15_000);
      cleanup = () => { clearInterval(keepAlive); subscription.unsubscribe(); try { controller.close(); } catch { /* already closed */ } };
      request.signal.addEventListener('abort', () => cleanup?.());
    },
    cancel() { cleanup?.(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
