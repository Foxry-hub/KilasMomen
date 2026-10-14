import fs from "fs";
import path from "path";

export interface Transaction {
  id: string;
  code: string;
  amount: number;
  paymentMethod: string | null;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "COMPLETED";
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  sessionId: string;
  token: string;
  filter: string;
  imageData: string; // Base64 data URL or file path
  createdAt: string;
  expiresAt: string;
}

// Global singletons to persist across Next.js HMR/Turbopack re-evaluations
const globalForStore = globalThis as unknown as {
  transactions?: Map<string, Transaction>;
  invoicesByToken?: Map<string, Invoice>;
  invoicesBySession?: Map<string, Invoice>;
};

export const transactions =
  globalForStore.transactions ?? (globalForStore.transactions = new Map<string, Transaction>());
export const invoicesByToken =
  globalForStore.invoicesByToken ?? (globalForStore.invoicesByToken = new Map<string, Invoice>());
export const invoicesBySession =
  globalForStore.invoicesBySession ?? (globalForStore.invoicesBySession = new Map<string, Invoice>());

export function generateTransactionId(): string {
  return (
    "trx_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 8)
  );
}

export function generateTransactionCode(): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const seq = (transactions.size + 1).toString().padStart(4, "0");
  return `TRX-${dateStr}-${seq}`;
}

export function generateInvoiceNumber(sessionId: string): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const shortId = (sessionId.replace(/^ses_/, "").slice(-4) || "0001").toUpperCase();
  return `INV-${dateStr}-${shortId}`;
}

export function generateToken(sessionId: string): string {
  const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, "");
  return (cleanId.slice(-8) + Math.random().toString(36).substring(2, 6)).toLowerCase();
}

/** Save image buffer and invoice metadata to local storage disk */
export function saveImageToDisk(sessionId: string, base64Data: string): string {
  try {
    const storageDir = path.join(process.cwd(), "storage", "sessions", sessionId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const filePath = path.join(storageDir, "final.jpg");
    const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.error("Failed to save image to disk:", err);
    return "";
  }
}

/** Save invoice JSON metadata to disk (strips heavy base64 imageData) */
export function saveInvoiceMetadata(invoice: Invoice) {
  try {
    // Strip base64 imageData from disk copy — the image is stored as final.jpg separately
    const diskSafe = {
      ...invoice,
      imageData: invoice.imageData?.startsWith("data:")
        ? `storage/sessions/${invoice.sessionId}/final.jpg`
        : invoice.imageData,
    };

    const storageDir = path.join(process.cwd(), "storage", "sessions", invoice.sessionId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const metaPath = path.join(storageDir, "invoice.json");
    fs.writeFileSync(metaPath, JSON.stringify(diskSafe, null, 2));

    // Also write token mapping file for ultra-fast lookup
    const tokenDir = path.join(process.cwd(), "storage", "tokens");
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    fs.writeFileSync(path.join(tokenDir, `${invoice.token}.json`), JSON.stringify(diskSafe, null, 2));
  } catch (err) {
    console.warn("Failed to save invoice metadata:", err);
  }
}

/** Robust invoice lookup: checks memory, tokens dir, session dir, and disk fallbacks */
export function findInvoice(tokenOrSessionId: string): Invoice | null {
  if (!tokenOrSessionId) return null;

  // 1. Check in-memory maps
  const inMemory =
    invoicesByToken.get(tokenOrSessionId) ||
    invoicesBySession.get(tokenOrSessionId);
  if (inMemory) return inMemory;

  // 2. Check token index file on disk
  try {
    const tokenFile = path.join(process.cwd(), "storage", "tokens", `${tokenOrSessionId}.json`);
    if (fs.existsSync(tokenFile)) {
      const parsed: Invoice = JSON.parse(fs.readFileSync(tokenFile, "utf-8"));
      invoicesByToken.set(parsed.token, parsed);
      invoicesBySession.set(parsed.sessionId, parsed);
      return parsed;
    }
  } catch {
    // Continue fallback
  }

  // 3. Check if tokenOrSessionId is a sessionId folder with invoice.json
  try {
    const sessionDir = path.join(process.cwd(), "storage", "sessions", tokenOrSessionId);
    const invoiceJsonPath = path.join(sessionDir, "invoice.json");
    const finalJpgPath = path.join(sessionDir, "final.jpg");

    if (fs.existsSync(invoiceJsonPath)) {
      const parsed: Invoice = JSON.parse(fs.readFileSync(invoiceJsonPath, "utf-8"));
      invoicesByToken.set(parsed.token, parsed);
      invoicesBySession.set(parsed.sessionId, parsed);
      return parsed;
    }

    // 4. Folder exists with final.jpg but no invoice.json (synthesize invoice record)
    if (fs.existsSync(finalJpgPath)) {
      const now = new Date();
      const syntheticInvoice: Invoice = {
        id: "inv_" + tokenOrSessionId.slice(-8),
        invoiceNumber: generateInvoiceNumber(tokenOrSessionId),
        sessionId: tokenOrSessionId,
        token: tokenOrSessionId,
        filter: "VINTAGE",
        imageData: finalJpgPath,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
      };
      invoicesByToken.set(tokenOrSessionId, syntheticInvoice);
      invoicesBySession.set(tokenOrSessionId, syntheticInvoice);
      saveInvoiceMetadata(syntheticInvoice);
      return syntheticInvoice;
    }
  } catch {
    // Continue scan
  }

  // 5. Scan all session directories for matching token in invoice.json
  try {
    const sessionsDir = path.join(process.cwd(), "storage", "sessions");
    if (fs.existsSync(sessionsDir)) {
      const dirs = fs.readdirSync(sessionsDir);
      for (const dir of dirs) {
        const invPath = path.join(sessionsDir, dir, "invoice.json");
        if (fs.existsSync(invPath)) {
          const inv: Invoice = JSON.parse(fs.readFileSync(invPath, "utf-8"));
          if (inv.token === tokenOrSessionId || inv.sessionId === tokenOrSessionId) {
            invoicesByToken.set(inv.token, inv);
            invoicesBySession.set(inv.sessionId, inv);
            return inv;
          }
        }
      }
    }
  } catch {
    // Final fallback
  }

  return null;
}

/** Read image buffer from local storage disk or return data URL */
export function getImageBuffer(invoice: Invoice): Buffer | null {
  try {
    // 1. If stored as file on disk
    const diskPath = path.join(process.cwd(), "storage", "sessions", invoice.sessionId, "final.jpg");
    if (fs.existsSync(diskPath)) {
      const buf = fs.readFileSync(diskPath);
      if (buf.length > 50) return buf;
    }

    // 2. If stored as base64 in imageData
    if (invoice.imageData && invoice.imageData.startsWith("data:image")) {
      const rawBase64 = invoice.imageData.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(rawBase64, "base64");
    }
  } catch (err) {
    console.error("Failed to read image buffer:", err);
  }
  return null;
}
