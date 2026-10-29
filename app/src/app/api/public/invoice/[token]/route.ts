import { NextResponse } from "next/server";
import { copy } from "@/lib/copy.id";
import { findPublicTransaction } from "@/lib/session-output";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/public/invoice/[token] — metadata soft copy (§6.4, §6.6).
 * Valid hanya selama jendela event; kegagalan apa pun → 404 seragam.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const transaction = await findPublicTransaction(token);

  if (!transaction) {
    return NextResponse.json(
      { error: copy.invoice.expired },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      code: transaction.code,
      filter: transaction.session?.filterChosen ?? "ORIGINAL",
      createdAt: transaction.createdAt,
      downloadUrl: `/api/public/invoice/${token}/image?download=1`,
      imageUrl: `/api/public/invoice/${token}/image`,
      rawPhotosUrl: `/api/public/invoice/${token}/raw-photos`,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
