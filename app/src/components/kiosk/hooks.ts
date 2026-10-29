"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { kioskJson } from "./api";
import type { KioskConfig, KioskDevice, KioskStatusView } from "./types";

/** Ambil konfigurasi kios (§6.3). Mendukung penyegaran berkala bila idle. */
export function useConfig(pollIntervalMs = 0): {
  config: KioskConfig | null;
  error: boolean;
  refresh: () => void;
} {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    kioskJson<KioskConfig>("/api/kiosk/config").then((res) => {
      if (res.ok && res.data) {
        setConfig(res.data);
        setError(false);
      } else {
        setError(true);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    if (pollIntervalMs > 0) {
      const timer = setInterval(refresh, pollIntervalMs);
      return () => clearInterval(timer);
    }
  }, [refresh, pollIntervalMs]);

  return { config, error, refresh };
}

/** Kirim heartbeat berkala agar operator melihat status kios (§6.1). */
export function useHeartbeat(
  activeScreen: string,
  extra?: { devices?: KioskDevice[]; cameraStatus?: string }
): void {
  const extraRef = useRef(extra);
  extraRef.current = extra;

  useEffect(() => {
    let cancelled = false;

    const send = () => {
      if (cancelled) return;
      const current = extraRef.current;
      kioskJson("/api/kiosk/heartbeat", {
        method: "POST",
        body: {
          devices: current?.devices,
          activeScreen,
          cameraStatus: current?.cameraStatus, // Biarkan undefined bila tidak ada data baru
        },
      });
    };

    send();
    const timer = setInterval(send, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeScreen]);
}

export type PollConnection = "live" | "connecting" | "offline";

interface StatusPollOptions {
  /** Dipanggil sekali saat status berubah menjadi CANCELLED (§7.10). */
  onCancelled?: () => void;
  enabled?: boolean;
  intervalMs?: number;
}

/** Polling status transaksi tiap 2 detik dengan overlay "Menghubungkan ulang..." (§7.3). */
export function useStatusPoll(
  transactionId: string | null,
  options: StatusPollOptions = {}
): {
  data: KioskStatusView | null;
  connection: PollConnection;
  refresh: () => void;
} {
  const { onCancelled, enabled = true, intervalMs = 2000 } = options;
  const [data, setData] = useState<KioskStatusView | null>(null);
  const [connection, setConnection] = useState<PollConnection>("connecting");
  const cancelledRef = useRef(false);
  const failsRef = useRef(0);
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  const tick = useCallback(async () => {
    if (!transactionId) return;
    const res = await kioskJson<KioskStatusView>(
      `/api/kiosk/transactions/${transactionId}/status`
    );
    if (!res.ok || !res.data) {
      failsRef.current += 1;
      if (failsRef.current >= 3) setConnection("offline");
      return;
    }
    failsRef.current = 0;
    setConnection("live");
    setData(res.data);
    if (res.data.status === "CANCELLED" && !cancelledRef.current) {
      cancelledRef.current = true;
      onCancelledRef.current?.();
    }
  }, [transactionId]);

  useEffect(() => {
    if (!transactionId || !enabled) return;
    cancelledRef.current = false;
    failsRef.current = 0;
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [transactionId, enabled, intervalMs, tick]);

  return { data, connection, refresh: tick };
}

/** Polling status via id sesi (layar sesi tidak menyimpan id transaksi) (§7.10). */
export function useKioskSession(
  sessionId: string | null,
  options: StatusPollOptions = {}
): {
  data: KioskStatusView | null;
  connection: PollConnection;
  refresh: () => void;
} {
  const { onCancelled, enabled = true, intervalMs = 2000 } = options;
  const [data, setData] = useState<KioskStatusView | null>(null);
  const [connection, setConnection] = useState<PollConnection>("connecting");
  const cancelledRef = useRef(false);
  const failsRef = useRef(0);
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  const tick = useCallback(async () => {
    if (!sessionId) return;
    const res = await kioskJson<KioskStatusView>(`/api/kiosk/sessions/${sessionId}`);
    if (!res.ok || !res.data) {
      failsRef.current += 1;
      if (failsRef.current >= 3) setConnection("offline");
      return;
    }
    failsRef.current = 0;
    setConnection("live");
    setData(res.data);
    if (res.data.status === "CANCELLED" && !cancelledRef.current) {
      cancelledRef.current = true;
      onCancelledRef.current?.();
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !enabled) return;
    cancelledRef.current = false;
    failsRef.current = 0;
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [sessionId, enabled, intervalMs, tick]);

  return { data, connection, refresh: tick };
}

/** Hitung mundur ke sebuah tenggat; menghitung dari selisih serverTime (§7.3). */
export function useDeadline(expiresAt: string | null, serverTime: string | null): number {
  const [remaining, setRemaining] = useState(0);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!expiresAt || !serverTime) {
      deadlineRef.current = null;
      setRemaining(0);
      return;
    }
    const offset = new Date(expiresAt).getTime() - new Date(serverTime).getTime();
    deadlineRef.current = Date.now() + offset;
  }, [expiresAt, serverTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      const deadline = deadlineRef.current;
      setRemaining(deadline ? Math.max(0, deadline - Date.now()) : 0);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return remaining;
}
