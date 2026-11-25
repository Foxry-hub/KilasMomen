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
  const fileName = segments[segments.length - 1] ?? "";
  const isSessionPhoto = segments[0] === "sessions" && /^shot-\d+\.jpg$/i.test(fileName);
  return serveStorageFile(absolute, {
    cacheControl: isSessionPhoto ? "no-store, no-cache, must-revalidate" : undefined,
  });
}
