"use client";

/** Utilitas bersama panel operator. */

export function rupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function mmss(ms: number | null): string {
  if (ms === null || ms < 0) return "--:--";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function dayStamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

/** Panggilan JSON ke API operator; mengembalikan `{ ok, status, data }`. */
export async function apiJson<T = Record<string, unknown>>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<ApiResult<T>> {
  const { body, headers, ...rest } = init ?? {};
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");

  const res = await fetch(url, {
    ...rest,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: finalHeaders,
    cache: "no-store",
  });
  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    /* respons tanpa badan JSON */
  }
  if (res.status === 401) window.location.href = "/operator/login";
  return { ok: res.ok, status: res.status, data };
}
