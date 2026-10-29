/**
 * Penyajian berkas runtime dari folder `storage/` lewat route handler.
 * Berkas yang ditambahkan setelah build tidak dijamin tersaji dari `public/` (§6.3.1).
 */
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Ubah path relatif (mis. `frames/abc.png`) menjadi path absolut di dalam `storage/`. */
export function resolveStoragePath(relativePath: string): string | null {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/^storage[\\/]/, "");
  const absolute = path.resolve(STORAGE_ROOT, cleaned);
  if (absolute !== STORAGE_ROOT && !absolute.startsWith(`${STORAGE_ROOT}${path.sep}`)) {
    return null; // cegah path traversal
  }
  return absolute;
}

export async function serveStorageFile(
  absolutePath: string,
  options: { downloadName?: string } = {}
): Promise<NextResponse> {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch {
    return new NextResponse("Berkas tidak ditemukan", { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    "Content-Length": buffer.length.toString(),
    "Cache-Control": "public, max-age=3600",
  });
  if (options.downloadName) {
    headers.set("Content-Disposition", `attachment; filename="${options.downloadName}"`);
  }

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
