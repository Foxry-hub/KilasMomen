/**
 * Halaman cetak per profil frame (§6.3.2, §6.4).
 * Fungsi murni: dipakai di browser operator untuk membangun iframe `window.print()`.
 */
import type { PrintProfileConfig } from "../frames/analyze";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * HTML cetak: `@page` mengikuti ukuran fisik profil, `copies` lembar (satu halaman per lembar).
 * `src` berupa blob/data URL dari `final.jpg`.
 */
export function buildPrintHtml(
  src: string,
  profile: PrintProfileConfig,
  copies: number
): string {
  const pages = Math.max(1, Math.floor(copies));
  const img = `<img src="${escapeAttr(src)}" alt="" />`;
  const body = Array.from({ length: pages }, () => `<section>${img}</section>`).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${profile.widthIn}in ${profile.heightIn}in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${profile.widthIn}in; height: ${profile.heightIn}in; }
  section {
    width: ${profile.widthIn}in;
    height: ${profile.heightIn}in;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  section:last-child { page-break-after: auto; break-after: auto; }
  img {
    width: 100%;
    height: 100%;
    object-fit: ${profile.fit === "COVER" ? "cover" : "contain"};
    display: block;
  }
</style>
</head>
<body>${body}</body>
</html>`;
}
