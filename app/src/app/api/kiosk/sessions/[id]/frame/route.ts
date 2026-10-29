import { NextResponse } from "next/server";
import { badRequest, conflict, notFound, requireKiosk } from "@/lib/kiosk-api";
import { TRANSACTION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/events";

/** PATCH /api/kiosk/sessions/[id]/frame — simpan frame terpilih (§7.4). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;
  let body: { frameId?: unknown } = {};
  try {
    body = (await request.json()) as { frameId?: unknown };
  } catch {
    return badRequest("Body tidak valid");
  }

  const frameId = typeof body.frameId === "string" ? body.frameId : "";
  if (!frameId) return badRequest("Frame tidak valid");

  const session = await prisma.photoSession.findUnique({
    where: { id },
    include: { transaction: true },
  });
  if (!session) return notFound("Sesi tidak ditemukan");
  if (session.transaction.status !== TRANSACTION_STATUS.PROCESSING) {
    return conflict(session.transaction.status, "Frame hanya dapat dipilih saat sesi diproses");
  }

  const frame = await prisma.frame.findUnique({ where: { id: frameId } });
  if (!frame || !frame.isActive) return badRequest("Frame tidak tersedia");

  await prisma.photoSession.update({
    where: { id },
    data: { frameId },
  });

  publish("session", { action: "frame-chosen", sessionId: id, frameId });
  return NextResponse.json({ ok: true, frameId });
}
