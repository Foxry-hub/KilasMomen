/**
 * Output hard copy & soft copy (§6.4): jalur final, ekspor fotokopi, URL WhatsApp.
 */
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { prisma } from "./prisma";
import { SETTING_KEYS, getSetting } from "./settings";
import { getEventInfo, isPublicLinkValid } from "./event-window";

export const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export function sessionFinalAbsolutePath(sessionId: string): string {
  return path.join(STORAGE_ROOT, "sessions", sessionId, "final.jpg");
}

/** Direktori kerja sesi (foto mentah + final). */
export function sessionDirAbsolutePath(sessionId: string): string {
  return path.join(STORAGE_ROOT, "sessions", sessionId);
}

/** Path absolut foto mentah `shot-N.jpg` (N = 1..6). */
export function sessionShotAbsolutePath(sessionId: string, shotIndex: number): string {
  return path.join(sessionDirAbsolutePath(sessionId), `shot-${shotIndex}.jpg`);
}

/** Path relatif terhadap `storage/` untuk disimpan di `Photo.filePath`. */
export function sessionShotRelativePath(sessionId: string, shotIndex: number): string {
  return `sessions/${sessionId}/shot-${shotIndex}.jpg`;
}

/** Path relatif terhadap `storage/` untuk disimpan di `finalImagePath`. */
export function sessionFinalRelativePath(sessionId: string): string {
  return `sessions/${sessionId}/final.jpg`;
}

/** Normalisasi nomor telepon Indonesia ke digit internasional tanpa `+`. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let value = digits;
  if (value.startsWith("0")) value = `62${value.slice(1)}`;
  else if (value.startsWith("8")) value = `62${value}`;
  if (!/^62\d{8,13}$/.test(value)) return null;
  return value;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

export interface FotocopyResult {
  fileName: string;
  absolutePath: string;
  waUrl: string | null;
  numberMissing: boolean;
}

/**
 * Salin final.jpg ke `storage/output_fotocopy/` lalu (opsional) buka Explorer
 * dengan berkas terpilih. Idempoten: tulis ke berkas sementara lalu rename.
 */
export async function exportForFotocopy(input: {
  sessionId: string;
  code: string;
  strips: number;
  paper: string;
  openExplorer?: boolean;
}): Promise<FotocopyResult> {
  const { sessionId, code, strips, paper } = input;
  const source = sessionFinalAbsolutePath(sessionId);
  const dir = path.join(STORAGE_ROOT, "output_fotocopy");
  await fs.mkdir(dir, { recursive: true });

  const safePaper = paper.replace(/[^A-Za-z0-9]/g, "");
  const fileName = `${code}_x${strips}_${safePaper}.jpg`;
  const target = path.join(dir, fileName);
  const temp = `${target}.tmp`;

  await fs.copyFile(source, temp);
  await fs.rename(temp, target);

  if (input.openExplorer !== false) {
    try {
      spawn("explorer.exe", [`/select,${target}`], { detached: true, stdio: "ignore" }).unref();
    } catch {
      /* Explorer tidak tersedia (mis. non-Windows) */
    }
  }

  const number = await getSetting(SETTING_KEYS.FOTOCOPY_WA_NUMBER);
  const template =
    (await getSetting(SETTING_KEYS.FOTOCOPY_MESSAGE_TEMPLATE)) ||
    "Halo, tolong cetak foto berikut ({code}, {strips} strip, kertas {paper}).";
  const normalized = number ? normalizePhone(number) : null;

  const waUrl = normalized
    ? `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(
        renderTemplate(template, { code, strips, paper: safePaper })
      )}`
    : null;

  return { fileName, absolutePath: target, waUrl, numberMissing: !normalized };
}

/** Muat sesi beserta transaksi dan frame terkait. */
export async function getSession(id: string) {
  return prisma.photoSession.findUnique({
    where: { id },
    include: { transaction: true, frame: true },
  });
}

/**
 * Cari transaksi publik lewat token acak DAN periksa jendela event (§6.6).
 * Mengembalikan `null` untuk semua kegagalan agar jawaban 404 seragam (anti-enumerasi).
 */
export async function findPublicTransaction(token: string) {
  if (!token) return null;
  const transaction = await prisma.transaction.findUnique({
    where: { publicToken: token },
    include: {
      session: { include: { photos: { orderBy: { shotIndex: "asc" } } } },
    },
  });
  if (!transaction) return null;

  const info = await getEventInfo();
  if (!isPublicLinkValid(transaction, info)) return null;
  return transaction;
}
