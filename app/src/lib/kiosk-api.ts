/**
 * Guard + util respons untuk rute `/api/kiosk/*` (peran K, §9).
 * Mandiri (tidak mengimpor modul operator) agar kios tetap terisolasi.
 */
import { NextResponse } from "next/server";
import { verifyKioskRequest } from "./auth";
import type { ServiceResult } from "./transaction-service";

/** Kembalikan respons 403 bila kunci kios tidak cocok, selain itu `null`. */
export async function requireKiosk(request: Request): Promise<NextResponse | null> {
  if (await verifyKioskRequest(request)) return null;
  return NextResponse.json({ error: "Akses kios ditolak" }, { status: 403 });
}

/** Respons 409 konflik status, menyertakan status terkini di body (§7.10). */
export function conflict(status: string, error = "Status transaksi sudah berubah"): NextResponse {
  return NextResponse.json({ error, status }, { status: 409 });
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound(error = "Data tidak ditemukan"): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}

export function unprocessable(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 422 });
}

/** Ubah `ServiceResult` dari TransactionService menjadi respons HTTP. */
export function fromService<T>(result: ServiceResult<T>): NextResponse {
  if (result.ok) return NextResponse.json(result.data);
  return NextResponse.json(
    { error: result.error, status: result.status },
    { status: result.httpStatus }
  );
}
