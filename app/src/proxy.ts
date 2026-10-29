/**
 * Proxy (dahulu middleware) — §4.7.
 *
 * Pada mode Quick Tunnel tidak ada ingress path whitelist, jadi satu-satunya
 * pembatas adalah lapis ini: request yang datang lewat Cloudflare (memiliki
 * header `cf-*`) hanya boleh menyentuh path publik. Semua path lain → 404
 * seragam, sehingga `/operator` dan `/api/kiosk/*` tidak dapat dijangkau
 * dari internet.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Prefix path yang boleh diakses publik lewat tunnel. */
const PUBLIC_PREFIXES = [
  "/invoice",
  "/api/public",
];

/** Nama berkas yang selalu boleh (PWA + aset root). */
const PUBLIC_FILES = ["/manifest.webmanifest", "/favicon.ico", "/robots.txt"];

/** Ekstensi aset statis yang dilewatkan. */
const STATIC_ASSET =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf|mp4|webm|json|txt|webmanifest)$/i;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (STATIC_ASSET.test(pathname)) return true;
  return false;
}

function isFromCloudflare(request: NextRequest): boolean {
  const h = request.headers;
  return h.has("cf-ray") || h.has("cf-connecting-ip") || h.has("cf-visitor");
}

export function proxy(request: NextRequest): NextResponse {
  // Trafik LAN lokal (kiosk/operator) tidak melewati Cloudflare: lewatkan.
  if (!isFromCloudflare(request)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  return new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  // Jalankan pada semua rute kecuali aset build internal Next.js.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
