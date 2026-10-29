import fs from "fs/promises";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { resolveStoragePath } from "@/lib/media";
import { findPublicTransaction } from "@/lib/session-output";

/**
 * GET /api/public/invoice/[token]/raw-photos — ZIP semua foto mentah (§6.4).
 * Validitas sama dengan halaman invoice; kegagalan apa pun → 404 seragam.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const transaction = await findPublicTransaction(token);
  const photos = transaction?.session?.photos ?? [];

  if (photos.length === 0) {
    return NextResponse.json({ error: "Foto mentah tidak ditemukan" }, { status: 404 });
  }

  const zip = new JSZip();
  let added = 0;
  for (const photo of photos) {
    const absolute = resolveStoragePath(photo.filePath);
    if (!absolute) continue;
    try {
      zip.file(`Foto-${photo.shotIndex}.jpg`, await fs.readFile(absolute));
      added += 1;
    } catch {
      /* lewati foto yang gagal dibaca */
    }
  }

  if (added === 0) {
    return NextResponse.json({ error: "Foto mentah tidak ditemukan" }, { status: 404 });
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Length": buffer.length.toString(),
    "Content-Disposition": `attachment; filename="HappyClick_${transaction?.code ?? token}.zip"`,
    "Cache-Control": "no-store",
  });

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
