import fs from "fs/promises";
import { NextResponse } from "next/server";
import { findPublicTransaction, sessionFinalAbsolutePath } from "@/lib/session-output";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/public/invoice/[token]/image — `final.jpg` (§6.4, §6.6).
 * `?download=1` memaksa unduhan. Kegagalan apa pun → 404 seragam.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const transaction = await findPublicTransaction(token);
  if (!transaction?.session) {
    return new NextResponse("Foto tidak ditemukan", { status: 404, headers: CORS_HEADERS });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(sessionFinalAbsolutePath(transaction.session.id));
  } catch {
    return new NextResponse("Foto tidak ditemukan", { status: 404, headers: CORS_HEADERS });
  }

  const isDownload = new URL(request.url).searchParams.get("download") === "1";
  const filename = `HappyClick_${transaction.code}.jpg`;

  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "image/jpeg");
  headers.set("Content-Length", buffer.length.toString());
  headers.set("Cache-Control", "no-store");
  headers.set(
    "Content-Disposition",
    `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
  );

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
