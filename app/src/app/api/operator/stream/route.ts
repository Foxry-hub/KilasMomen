/**
 * SSE antrean operator (§4.5, §9). Klien memakai EventSource.
 */
import type { NextRequest } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { subscribe } from "@/lib/events";

export async function GET(request: NextRequest) {
  const guard = await requireOperator();
  if (guard) return guard;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream sudah ditutup */
        }
      };

      send("retry: 3000\n\n");
      send(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

      unsubscribe = subscribe((event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      });

      heartbeat = setInterval(() => send(": ping\n\n"), 20_000);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* sudah tertutup */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
