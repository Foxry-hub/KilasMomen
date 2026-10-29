import fs from "fs/promises";
import sharp, { type Metadata } from "sharp";
import { NextResponse } from "next/server";
import {
  badRequest,
  conflict,
  notFound,
  requireKiosk,
  unprocessable,
} from "@/lib/kiosk-api";
import { COLOR_FILTERS, TRANSACTION_STATUS, type ColorFilter } from "@/lib/constants";
import { publish } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import {
  sessionDirAbsolutePath,
  sessionFinalAbsolutePath,
  sessionFinalRelativePath,
} from "@/lib/session-output";

/**
 * POST /api/kiosk/sessions/[id]/finalize — terima `final.jpg` (§7.8).
 * Server memeriksa dimensi berkas = dimensi frame; bila tidak → 422.
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

  const file = form.get("file");
  if (!(file instanceof Blob)) return badRequest("Berkas final tidak ditemukan");

  const session = await prisma.photoSession.findUnique({
    where: { id },
    include: { transaction: true, frame: true },
  });
  if (!session) return notFound("Sesi tidak ditemukan");
  if (session.transaction.status !== TRANSACTION_STATUS.PROCESSING) {
    return conflict(session.transaction.status, "Sesi sudah tidak aktif");
  }
  if (!session.frame) return badRequest("Frame belum dipilih");

  const rawFilter = form.get("filterChosen");
  const filter =
    typeof rawFilter === "string" && COLOR_FILTERS.includes(rawFilter as ColorFilter)
      ? rawFilter
      : (session.filterChosen ?? "ORIGINAL");

  let assignments: { slotIndex: number; shotIndex: number }[] = [];
  const rawAssignments = form.get("slotAssignments");
  if (typeof rawAssignments === "string") {
    try {
      const parsed = JSON.parse(rawAssignments) as unknown;
      if (Array.isArray(parsed)) {
        assignments = (parsed as { slotIndex: number; shotIndex: number }[]).filter(
          (a) => a && typeof a.slotIndex === "number" && typeof a.shotIndex === "number"
        );
      }
    } catch {
      assignments = [];
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return badRequest("Berkas kosong");

  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return unprocessable("Berkas final tidak dapat dibaca");
  }

  const frame = session.frame;
  if (meta.width !== frame.canvasWidth || meta.height !== frame.canvasHeight) {
    return unprocessable(
      `Dimensi final ${meta.width}×${meta.height} tidak sama dengan frame ${frame.canvasWidth}×${frame.canvasHeight}`
    );
  }

  try {
    await fs.mkdir(sessionDirAbsolutePath(id), { recursive: true });
    await fs.writeFile(sessionFinalAbsolutePath(id), buffer);
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan hasil final" }, { status: 500 });
  }

  await prisma.photoSession.update({
    where: { id },
    data: {
      finalImagePath: sessionFinalRelativePath(id),
      finalizedAt: new Date(),
      filterChosen: filter,
      slotAssignments: JSON.stringify(assignments),
    },
  });

  publish("session", { action: "final", sessionId: id });
  return NextResponse.json({ ok: true, finalUrl: `/api/media/${sessionFinalRelativePath(id)}` });
}
