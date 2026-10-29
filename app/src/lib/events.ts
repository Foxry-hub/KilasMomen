/**
 * Pub/sub sederhana untuk SSE operator (§4.5).
 * Disimpan di `globalThis` agar bertahan melewati HMR Turbopack.
 */
export type OperatorEventType = "transaction" | "session" | "kiosk" | "settings";

export interface OperatorEvent {
  type: OperatorEventType;
  at: string;
  data: Record<string, unknown>;
}

type Listener = (event: OperatorEvent) => void;

const globalForBus = globalThis as unknown as {
  __happyClickBus?: Set<Listener>;
};

const listeners: Set<Listener> =
  globalForBus.__happyClickBus ?? (globalForBus.__happyClickBus = new Set<Listener>());

/** Daftarkan listener SSE. Kembalikan fungsi `unsubscribe`. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Kirim event ke semua listener SSE. */
export function publish(type: OperatorEventType, data: Record<string, unknown> = {}): void {
  const event: OperatorEvent = { type, at: new Date().toISOString(), data };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Operator event listener failed:", error);
    }
  }
}
