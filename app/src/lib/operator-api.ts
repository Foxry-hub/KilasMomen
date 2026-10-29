/**
 * Guard + util respons untuk rute `/api/operator/*` (peran O, §9).
 */
import { NextResponse } from "next/server";
import { isOperatorAuthenticated } from "./auth";
import type { ServiceResult } from "./transaction-service";

/** Kembalikan respons 401 bila operator tidak terautentikasi, selain itu `null`. */
export async function requireOperator(): Promise<NextResponse | null> {
  if (await isOperatorAuthenticated()) return null;
  return NextResponse.json({ error: "Tidak memiliki akses" }, { status: 401 });
}

/** Respons 409 konflik status, menyertakan status terkini di body (§9). */
export function conflict(status: string, error = "Status transaksi sudah berubah"): NextResponse {
  return NextResponse.json({ error, status }, { status: 409 });
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound(error = "Data tidak ditemukan"): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}

/** Ubah `ServiceResult` dari TransactionService menjadi respons HTTP. */
export function fromService<T>(result: ServiceResult<T>): NextResponse {
  if (result.ok) return NextResponse.json(result.data);
  return NextResponse.json(
    { error: result.error, status: result.status },
    { status: result.httpStatus }
  );
}
