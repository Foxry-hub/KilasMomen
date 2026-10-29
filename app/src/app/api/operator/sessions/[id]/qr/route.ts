import { NextResponse } from "next/server";
import { notFound, requireOperator } from "@/lib/operator-api";
import { getSession } from "@/lib/session-output";
import { getPublicBaseUrl, getTunnelStatus } from "@/lib/tunnel";

/** `{ publicUrl, tunnelOnline, code }` untuk modal QR (§6.4, §9). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) return notFound("Sesi tidak ditemukan");

  const [base, tunnel] = await Promise.all([getPublicBaseUrl(), getTunnelStatus()]);
  const publicUrl = base ? `${base}/invoice/${session.transaction.publicToken}` : null;

  return NextResponse.json({
    publicUrl,
    tunnelOnline: tunnel.online,
    tunnelMode: tunnel.mode,
    publicBaseUrl: base,
    code: session.transaction.code,
    hasFinal: Boolean(session.finalImagePath),
  });
}
