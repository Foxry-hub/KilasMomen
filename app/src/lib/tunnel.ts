/**
 * Pemantauan tunnel Cloudflare (§4.7).
 * Mode `QUICK`: URL diambil otomatis dari `logs/cloudflared.log`.
 */
import fs from "fs/promises";
import path from "path";
import { SETTING_KEYS, getSetting, setSetting } from "./settings";

const LOG_PATH = path.resolve(process.cwd(), "logs", "cloudflared.log");
const TRYCLOUDFLARE_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

export interface TunnelStatus {
  mode: string;
  online: boolean;
  publicBaseUrl: string | null;
  detectedUrl: string | null;
}

/** URL Quick Tunnel terakhir yang tampak di log. */
export async function detectQuickTunnelUrl(): Promise<string | null> {
  try {
    const content = await fs.readFile(LOG_PATH, "utf8");
    const matches = content.match(TRYCLOUDFLARE_RE);
    if (!matches || matches.length === 0) return null;
    return matches[matches.length - 1];
  } catch {
    return null;
  }
}

async function pingMetrics(): Promise<boolean> {
  const metricsUrl =
    (await getSetting("tunnel.metricsUrl")) || "http://127.0.0.1:20241/ready";
  try {
    const res = await fetch(metricsUrl, { signal: AbortSignal.timeout(1200) }); // allow-dimension-literal (timeout ms)
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Status tunnel. Bila Quick Tunnel aktif dan URL dari log berbeda dari
 * `publicBaseUrl`, URL tersimpan diperbarui otomatis.
 */
export async function getTunnelStatus(): Promise<TunnelStatus> {
  const mode = (await getSetting(SETTING_KEYS.TUNNEL_MODE)) || "QUICK";
  let publicBaseUrl = await getSetting(SETTING_KEYS.PUBLIC_BASE_URL);

  const detectedUrl = mode === "QUICK" ? await detectQuickTunnelUrl() : null;
  if (detectedUrl && detectedUrl !== publicBaseUrl) {
    publicBaseUrl = detectedUrl;
    await setSetting(SETTING_KEYS.PUBLIC_BASE_URL, detectedUrl);
  }

  const online = await pingMetrics();
  return { mode, online, publicBaseUrl, detectedUrl };
}

/** URL publik untuk QR; null bila belum dikonfigurasi. */
export async function getPublicBaseUrl(): Promise<string | null> {
  const value = await getSetting(SETTING_KEYS.PUBLIC_BASE_URL);
  if (!value) return null;
  return value.replace(/\/+$/, "");
}
