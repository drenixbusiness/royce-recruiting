import { events, getStored } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Server-sent events: pushes the new version number whenever the board changes. */
export async function GET(req: Request) {
  const { version } = await getStored();
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
}
