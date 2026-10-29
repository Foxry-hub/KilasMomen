import { NextResponse } from "next/server";
import { badRequest, notFound, requireOperator } from "@/lib/operator-api";
import { getSession } from "@/lib/session-output";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set(["PRINT", "QR"]);

/** Catat aksi output (PRINT / QR) di `OutputLog` (§6.4, §9). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) return notFound("Sesi tidak ditemukan");

  const body = (await request.json().catch(() => ({}))) as {
    type?: unknown;
    copies?: unknown;
    note?: unknown;
  };
  const type = String(body.type ?? "");
  if (!ALLOWED.has(type)) return badRequest("Jenis output tidak valid");

  const log = await prisma.outputLog.create({
    data: {
      sessionId: id,
      type,
      copies: Number.isInteger(body.copies) ? Number(body.copies) : session.transaction.packageStripsCount,
      note: typeof body.note === "string" ? body.note.slice(0, 200) : null,
    },
  });

  return NextResponse.json({ ok: true, id: log.id });
}
