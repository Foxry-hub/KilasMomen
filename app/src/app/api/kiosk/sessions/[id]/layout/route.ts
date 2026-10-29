import { NextResponse } from "next/server";
import { badRequest, conflict, notFound, requireKiosk } from "@/lib/kiosk-api";
import { COLOR_FILTERS, TRANSACTION_STATUS, type ColorFilter } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/events";

interface Assignment {
  slotIndex: number;
  shotIndex: number;
}

/**
 * PUT /api/kiosk/sessions/[id]/layout — autosave penempatan + filter (§7.7).
 * Foto di bawah, overlay di atas; di sini hanya menyimpan metadata agar dapat dipulihkan.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;
  let body: { slotAssignments?: unknown; filterChosen?: unknown } = {};
  try {
    body = (await request.json()) as { slotAssignments?: unknown; filterChosen?: unknown };
  } catch {
    return badRequest("Body tidak valid");
  }

  const filter = body.filterChosen;
  if (typeof filter !== "string" || !COLOR_FILTERS.includes(filter as ColorFilter)) {
    return badRequest("Filter tidak dikenal");
  }

  const assignments: Assignment[] = Array.isArray(body.slotAssignments)
    ? (body.slotAssignments as unknown[])
        .filter(
          (a): a is Assignment =>
            !!a &&
            typeof (a as Assignment).slotIndex === "number" &&
            typeof (a as Assignment).shotIndex === "number"
        )
        .map((a) => ({ slotIndex: a.slotIndex, shotIndex: a.shotIndex }))
    : [];

  const session = await prisma.photoSession.findUnique({
    where: { id },
    include: { transaction: true },
  });
  if (!session) return notFound("Sesi tidak ditemukan");
  if (session.transaction.status !== TRANSACTION_STATUS.PROCESSING) {
    return conflict(session.transaction.status, "Sesi sudah tidak aktif");
  }

  await prisma.photoSession.update({
    where: { id },
    data: {
      filterChosen: filter,
      slotAssignments: JSON.stringify(assignments),
    },
  });

  publish("session", { action: "layout-saved", sessionId: id });
  return NextResponse.json({ ok: true });
}

/** GET — muat layout tersimpan (dipakai editor saat pemulihan). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(_request);
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await prisma.photoSession.findUnique({ where: { id } });
  if (!session) return notFound("Sesi tidak ditemukan");

  let slotAssignments: Assignment[] = [];
  if (session.slotAssignments) {
    try {
      const parsed = JSON.parse(session.slotAssignments) as unknown;
      if (Array.isArray(parsed)) slotAssignments = parsed as Assignment[];
    } catch {
      slotAssignments = [];
    }
  }

  return NextResponse.json({
    filterChosen: session.filterChosen ?? "ORIGINAL",
    slotAssignments,
  });
}
