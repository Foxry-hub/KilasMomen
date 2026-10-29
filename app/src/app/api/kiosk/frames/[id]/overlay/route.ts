import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoragePath, serveStorageFile } from "@/lib/media";

/** GET /api/kiosk/frames/:id/overlay — berkas PNG overlay frame (§9). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const frame = await prisma.frame.findUnique({ where: { id } });
  if (!frame) {
    return new NextResponse("Frame tidak ditemukan", { status: 404 });
  }

  const absolute = resolveStoragePath(frame.overlayPath);
  if (!absolute) {
    return new NextResponse("Path overlay tidak valid", { status: 404 });
  }
  return serveStorageFile(absolute);
}
