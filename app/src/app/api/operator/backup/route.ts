import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { prisma } from "@/lib/prisma";

const BACKUP_DIR = path.resolve(process.cwd(), "storage", "backups");
const KEEP = 10;

function stamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Cadangan database via `VACUUM INTO` ke `storage/backups/` (§8.6, §9). */
export async function POST() {
  const guard = await requireOperator();
  if (guard) return guard;

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const fileName = `dev-${stamp(new Date())}.db`;
  const target = path.join(BACKUP_DIR, fileName);

  // Path dibuat server-side sehingga aman dari injeksi.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  // Simpan 10 salinan terakhir.
  const entries = (await fs.readdir(BACKUP_DIR))
    .filter((f) => f.startsWith("dev-") && f.endsWith(".db"))
    .sort();
  for (const old of entries.slice(0, Math.max(0, entries.length - KEEP))) {
    await fs.rm(path.join(BACKUP_DIR, old), { force: true });
  }

  const stat = await fs.stat(target);
  return NextResponse.json({ ok: true, fileName, bytes: stat.size });
}
