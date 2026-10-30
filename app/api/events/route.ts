import { events, getVersion, syncMode } from "@/lib/server/db";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Server-sent events: pushes the new version number whenever the board changes (long-running server only). */
export const GET = handle(async (req: Request) => {
  // on Vercel each request may hit a different short-lived copy, so screens poll /api/version instead
  if (syncMode().mode !== "sse") return new Response(null, { status: 204 });
  const version = await getVersion();
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const onChange = (v: number) => send(`data: ${JSON.stringify({ version: v })}\n\n`);
      const ping = setInterval(() => send(": ping\n\n"), 20000);
      cleanup = () => {
        clearInterval(ping);
        events.off("change", onChange);
      };
      events.on("change", onChange);
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
      send(`retry: 2000\ndata: ${JSON.stringify({ version })}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
