"use client";

/** Pembungkus fetch untuk rute kios: tidak melempar, mengembalikan hasil terstruktur. */
export interface KioskResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Status terkini bila server menjawab 409 (§7.10). */
  conflictStatus?: string;
  error?: string;
}

export async function kioskJson<T>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<KioskResult<T>> {
  const { body, headers, ...rest } = init ?? {};
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");

  try {
    const res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const status = res.status;
    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (res.ok) return { ok: true, status, data: (payload as T) ?? null };
    const obj = (payload ?? {}) as { error?: string; status?: string };
    return {
      ok: false,
      status,
      data: null,
      conflictStatus: obj.status,
      error: obj.error ?? "Terjadi kesalahan",
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "Tidak dapat menghubungi server" };
  }
}

export async function kioskUpload<T>(url: string, form: FormData): Promise<KioskResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
    const status = res.status;
    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (res.ok) return { ok: true, status, data: (payload as T) ?? null };
    const obj = (payload ?? {}) as { error?: string; status?: string };
    return {
      ok: false,
      status,
      data: null,
      conflictStatus: obj.status,
      error: obj.error ?? "Terjadi kesalahan",
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "Tidak dapat menghubungi server" };
  }
}

export function cacheBustedPhotoUrl(photo: { url: string; capturedAt: string }): string {
  const separator = photo.url.includes("?") ? "&" : "?";
  const version = Date.parse(photo.capturedAt);
  return `${photo.url}${separator}v=${encodeURIComponent(String(version))}`;
}
