import { NextResponse } from "next/server";
import { resolveStoragePath, serveStorageFile } from "@/lib/media";

/** GET /api/media/<path> — menyajikan berkas dari `storage/` (splash, qris, thumbnail frame). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await ctx.params;
  const absolute = resolveStoragePath(segments.join("/"));
  if (!absolute) {
    return new NextResponse("Path tidak valid", { status: 400 });
  }
  return serveStorageFile(absolute);
}
