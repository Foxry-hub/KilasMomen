import fs from "fs/promises";
import { NextResponse } from "next/server";
import { badRequest, conflict, notFound, requireKiosk } from "@/lib/kiosk-api";
import {
  MAX_RETAKE_PER_SESSION,
  SHOT_COUNT,
  TRANSACTION_STATUS,
} from "@/lib/constants";
import { publish } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import {
  sessionDirAbsolutePath,
  sessionShotAbsolutePath,
  sessionShotRelativePath,
} from "@/lib/session-output";

async function retakeQuota(): Promise<number> {
  const raw = Number(await getSetting(SETTING_KEYS.RETAKE_MAX));
  return Number.isInteger(raw) && raw > 0 ? raw : MAX_RETAKE_PER_SESSION;
}

/**
 * POST /api/kiosk/sessions/[id]/photos — unggah satu foto (§7.5, §7.6).
 * `isRetake=true` memakai update bersyarat agar kuota tidak bisa dilewati dari UI.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Form tidak valid");
  }

  const shotIndex = Number(form.get("shotIndex"));
  const isRetake = form.get("isRetake") === "true";
  const file = form.get("file");

  if (!Number.isInteger(shotIndex) || shotIndex < 1 || shotIndex > SHOT_COUNT) {
    return badRequest("Indeks foto tidak valid");
  }
  if (!(file instanceof Blob)) return badRequest("Berkas foto tidak ditemukan");

  const session = await prisma.photoSession.findUnique({
    where: { id },
    include: { transaction: true },
  });
  if (!session) return notFound("Sesi tidak ditemukan");
  if (session.transaction.status !== TRANSACTION_STATUS.PROCESSING) {
    return conflict(session.transaction.status, "Sesi sudah tidak aktif");
  }

  const quota = await retakeQuota();
  let consumed = false;

  if (isRetake) {
    const updated = await prisma.photoSession.updateMany({
      where: { id, retakeCountUsed: { lt: quota } },
      data: { retakeCountUsed: { increment: 1 } },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Kuota foto ulang habis", status: TRANSACTION_STATUS.PROCESSING },
        { status: 409 }
      );
    }
    consumed = true;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    if (consumed) {
      await prisma.photoSession.updateMany({
        where: { id },
        data: { retakeCountUsed: { decrement: 1 } },
      });
    }
    return badRequest("Berkas kosong");
  }

  try {
    await fs.mkdir(sessionDirAbsolutePath(id), { recursive: true });
    await fs.writeFile(sessionShotAbsolutePath(id, shotIndex), buffer);
    await prisma.photo.upsert({
      where: { sessionId_shotIndex: { sessionId: id, shotIndex } },
      update: { filePath: sessionShotRelativePath(id, shotIndex) },
      create: {
        sessionId: id,
        shotIndex,
        filePath: sessionShotRelativePath(id, shotIndex),
      },
    });
  } catch {
    if (consumed) {
      await prisma.photoSession.updateMany({
        where: { id },
        data: { retakeCountUsed: { decrement: 1 } },
      });
    }
    return NextResponse.json({ error: "Gagal menyimpan foto" }, { status: 500 });
  }

  const current = await prisma.photoSession.findUniqueOrThrow({ where: { id } });
  const photoCount = await prisma.photo.count({ where: { sessionId: id } });

  publish("session", { action: isRetake ? "retake" : "photo", sessionId: id, shotIndex });
  return NextResponse.json({
    shotIndex,
    url: `/api/media/${sessionShotRelativePath(id, shotIndex)}`,
    retakeCountUsed: current.retakeCountUsed,
    photoCount,
  });
}
