"use client";

import { useEffect, useState } from "react";
import type { OperatorStatus } from "@/lib/operator-types";
import { apiJson } from "./utils";

/** Poll status kiosk/event/tunnel untuk header dan panel kamera (§6.1). */
export function useKioskStatus(intervalMs = 5000): {
  status: OperatorStatus | null;
  reload: () => void;
} {
  const [status, setStatus] = useState<OperatorStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const { ok, data } = await apiJson<OperatorStatus>("/api/operator/kiosk/status");
      if (alive && ok) setStatus(data);
    };
    void pull();
    const timer = window.setInterval(pull, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return { status, reload: () => setStatus((s) => (s ? { ...s } : s)) };
}
