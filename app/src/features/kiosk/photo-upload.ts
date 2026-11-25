import fs from "fs/promises";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { badRequest, conflict, notFound, requireKiosk } from "@/lib/kiosk-api";
import { MAX_RETAKE_PER_SESSION, SHOT_COUNT, TRANSACTION_STATUS } from "@/lib/constants";
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

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/** Simpan foto baru atau ganti foto yang ditentukan tanpa mengubah indeks lain. */
export async function uploadSessionPhoto(
  request: Request,
  sessionId: string,
  forcedRetakeShotIndex?: number
): Promise<NextResponse> {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Form tidak valid");
  }

  const shotIndex = forcedRetakeShotIndex ?? Number(form.get("shotIndex"));
  const isRetake = forcedRetakeShotIndex !== undefined || form.get("isRetake") === "true";
  const file = form.get("file");

  if (!Number.isInteger(shotIndex) || shotIndex < 1 || shotIndex > SHOT_COUNT) {
    return badRequest("Indeks foto tidak valid");
  }
  if (!(file instanceof Blob)) return badRequest("Berkas foto tidak ditemukan");

  const session = await prisma.photoSession.findUnique({
    where: { id: sessionId },
    include: { transaction: true },
  });
  if (!session) return notFound("Sesi tidak ditemukan");
  if (session.transaction.status !== TRANSACTION_STATUS.PROCESSING) {
    return conflict(session.transaction.status, "Sesi sudah tidak aktif");
  }

  const photoKey = { sessionId_shotIndex: { sessionId, shotIndex } };
  if (isRetake) {
    const existing = await prisma.photo.findUnique({ where: photoKey });
    if (!existing) return badRequest("Foto yang akan diulang tidak ditemukan");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return badRequest("Berkas kosong");

  const targetPath = sessionShotAbsolutePath(sessionId, shotIndex);
  const stagedPath = `${targetPath}.${randomUUID()}.tmp`;
  const backupPath = `${targetPath}.${randomUUID()}.bak`;
  let quotaReserved = false;
  let backupCreated = false;
  let replacementInstalled = false;
  let committed = false;

  try {
    await fs.mkdir(sessionDirAbsolutePath(sessionId), { recursive: true });
    await fs.writeFile(stagedPath, buffer, { flag: "wx" });

    if (isRetake) {
      const quota = await retakeQuota();
      const reservation = await prisma.photoSession.updateMany({
        where: { id: sessionId, retakeCountUsed: { lt: quota } },
        data: { retakeCountUsed: { increment: 1 } },
      });
      if (reservation.count === 0) {
        return NextResponse.json(
          { error: "Kuota foto ulang habis", status: TRANSACTION_STATUS.PROCESSING },
          { status: 409 }
        );
      }
      quotaReserved = true;
    }

    try {
      await fs.rename(targetPath, backupPath);
      backupCreated = true;
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }

    await fs.rename(stagedPath, targetPath);
    replacementInstalled = true;

    const capturedAt = new Date();
    if (isRetake) {
      await prisma.photo.update({
        where: photoKey,
        data: { filePath: sessionShotRelativePath(sessionId, shotIndex), capturedAt },
      });
    } else {
      await prisma.photo.upsert({
        where: photoKey,
        update: { filePath: sessionShotRelativePath(sessionId, shotIndex), capturedAt },
        create: {
          sessionId,
          shotIndex,
          filePath: sessionShotRelativePath(sessionId, shotIndex),
          capturedAt,
        },
      });
    }
    committed = true;
  } catch (error) {
    if (replacementInstalled) {
      await fs.rm(targetPath, { force: true }).catch((cleanupError) => {
        console.error("Failed to remove incomplete photo replacement:", cleanupError);
      });
    }
    if (backupCreated) {
      await fs.rename(backupPath, targetPath).catch((restoreError) => {
        console.error("Failed to restore previous photo:", restoreError);
      });
    }
    if (quotaReserved) {
      await prisma.photoSession
        .updateMany({
          where: { id: sessionId, retakeCountUsed: { gt: 0 } },
          data: { retakeCountUsed: { decrement: 1 } },
        })
        .catch((rollbackError) => {
          console.error("Failed to roll back reserved retake quota:", rollbackError);
        });
    }
    console.error("Kiosk photo upload failed:", error);
    return NextResponse.json({ error: "Gagal menyimpan foto" }, { status: 500 });
  } finally {
    await fs.rm(stagedPath, { force: true }).catch((error) => {
      console.error("Failed to remove staged photo:", error);
    });
    if (committed && backupCreated) {
      await fs.rm(backupPath, { force: true }).catch((error) => {
        console.error("Failed to remove previous photo backup:", error);
      });
    }
  }

  const current = await prisma.photoSession.findUnique({
    where: { id: sessionId },
    include: { photos: { orderBy: { shotIndex: "asc" } } },
  });
  if (!current) return notFound("Sesi tidak ditemukan");

  const photo = current.photos.find((item) => item.shotIndex === shotIndex);
  if (!photo) return notFound("Foto tidak ditemukan");
  const url = `/api/media/${photo.filePath}`;
  publish("session", { action: isRetake ? "retake" : "photo", sessionId, shotIndex });

  return NextResponse.json({
    shotIndex,
    url,
    capturedAt: photo.capturedAt.toISOString(),
    retakeCountUsed: current.retakeCountUsed,
    photoCount: current.photos.length,
    session: {
      id: current.id,
      retakeCountUsed: current.retakeCountUsed,
      photoCount: current.photos.length,
      photos: current.photos.map((item) => ({
        shotIndex: item.shotIndex,
        url: `/api/media/${item.filePath}`,
        capturedAt: item.capturedAt.toISOString(),
      })),
    },
  });
}
