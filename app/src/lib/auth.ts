/**
 * Autentikasi ringan: sesi cookie operator + kunci kios (§11.1).
 * MVP lokal: PIN operator disimpan sebagai HMAC; kunci kios lewat header `X-Kiosk-Key`.
 */
import crypto from "crypto";
import { cookies } from "next/headers";
import { SETTING_KEYS, getSetting } from "./settings";

const OPERATOR_COOKIE = "hc_operator";
const SESSION_TTL_MS = 12 * 3_600_000;
const SECRET =
  process.env.OPERATOR_SESSION_SECRET || "happy-click-dev-secret-change-me";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Hash PIN operator (HMAC-SHA256). */
export function hashPin(pin: string): string {
  return crypto.createHmac("sha256", SECRET).update(`pin:${pin}`).digest("hex");
}

function defaultPinHash(): string {
  return hashPin(process.env.OPERATOR_PIN || "1234");
}

async function getStoredPinHash(): Promise<string> {
  return (await getSetting(SETTING_KEYS.OPERATOR_PIN_HASH)) || defaultPinHash();
}

/** PIN 4–6 digit, dibandingkan dengan hash tersimpan. */
export async function verifyPin(pin: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const stored = await getStoredPinHash();
  return safeEqual(hashPin(pin), stored);
}

/* --------------------------------------------------------------- Sesi */

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url"
  );
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function startOperatorSession(): Promise<void> {
  const store = await cookies();
  store.set(OPERATOR_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endOperatorSession(): Promise<void> {
  const store = await cookies();
  store.delete(OPERATOR_COOKIE);
}

export async function isOperatorAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(OPERATOR_COOKIE)?.value;
  return Boolean(token && verifySessionToken(token));
}

/* ---------------------------------------------------------------- Kios */

export async function getKioskKey(): Promise<string> {
  return (await getSetting(SETTING_KEYS.KIOSK_API_KEY)) || process.env.KIOSK_API_KEY || "";
}

/** Bila kunci kios belum dikonfigurasi, akses dibuka (mode pengembangan lokal). */
export async function verifyKioskRequest(request: Request): Promise<boolean> {
  const key = await getKioskKey();
  if (!key) return true;
  return request.headers.get("X-Kiosk-Key") === key;
}
