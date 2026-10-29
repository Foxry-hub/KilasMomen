"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueuePayload } from "@/lib/operator-types";

export type ConnectionState = "connecting" | "live" | "polling";

/**
 * Berlangganan antrean operator lewat SSE, dengan fallback polling 2 detik
 * bila SSE terputus (matriks kegagalan §11.2).
 */
export function useOperatorStream() {
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const listeners = useRef(new Set<() => void>());

  const onEvent = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/transactions", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/operator/login";
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat antrean");
      setQueue((await res.json()) as QueuePayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat antrean");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let source: EventSource | null = null;
    let pollTimer: number | null = null;
    let retryTimer: number | null = null;
    let closed = false;

    const fanOut = () => {
      void load();
      for (const fn of listeners.current) fn();
    };

    const startPolling = () => {
      if (pollTimer !== null) return;
      setConnection("polling");
      pollTimer = window.setInterval(fanOut, 2000);
    };

    const stopPolling = () => {
      if (pollTimer === null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/operator/stream");
      source.onopen = () => {
        setConnection("live");
        stopPolling();
        fanOut();
      };
      for (const name of ["ready", "transaction", "session", "kiosk", "settings"]) {
        source.addEventListener(name, fanOut);
      }
      source.onerror = () => {
        setConnection("connecting");
        startPolling();
        source?.close();
        source = null;
        retryTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      source?.close();
      stopPolling();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [load]);

  return { queue, connection, error, reload: load, onEvent };
}
