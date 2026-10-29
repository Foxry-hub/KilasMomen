import { NextResponse } from "next/server";
import { notFound, requireOperator } from "@/lib/operator-api";
import { getSession, sessionFinalAbsolutePath } from "@/lib/session-output";
import { serveStorageFile } from "@/lib/media";

/** Berkas `final.jpg` untuk dicetak (§6.4, §9). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session?.finalImagePath) return notFound("Hasil final belum tersedia");

  return serveStorageFile(sessionFinalAbsolutePath(id));
}
