import { NextResponse } from "next/server";
import { notFound, requireOperator } from "@/lib/operator-api";
import { exportForFotocopy, getSession } from "@/lib/session-output";
import { parseSlotsConfig } from "@/features/frames/analyze";
import { prisma } from "@/lib/prisma";
import { OUTPUT_TYPE } from "@/lib/constants";

/**
 * Salin `final.jpg` ke `storage/output_fotocopy/`, buka Explorer dengan berkas
 * terpilih, kembalikan `{ fileName, waUrl }` (§6.4). Klien mengarahkan tab WhatsApp.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session?.finalImagePath || !session.frame) return notFound("Hasil final belum tersedia");

  const config = parseSlotsConfig(session.frame.slotsConfig);
  const paper = config?.print.paper ?? "4R";

  const result = await exportForFotocopy({
    sessionId: id,
    code: session.transaction.code,
    strips: session.transaction.packageStripsCount,
    paper,
  });

  await prisma.outputLog.create({
    data: {
      sessionId: id,
      type: OUTPUT_TYPE.FOTOCOPY,
      copies: session.transaction.packageStripsCount,
      note: result.fileName,
    },
  });

  return NextResponse.json(result);
}
