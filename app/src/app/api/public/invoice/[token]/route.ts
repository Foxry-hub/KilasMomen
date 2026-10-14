import { NextResponse } from "next/server";
import { findInvoice } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // CORS headers for cross-origin mobile access
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const invoice = findInvoice(token);

  if (!invoice) {
    return NextResponse.json(
      { error: "Tautan salah, kedaluwarsa, atau sudah dicabut" },
      { status: 404, headers: corsHeaders }
    );
  }

  // Check expiry
  if (new Date(invoice.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Masa berlaku tautan invoice telah berakhir" },
      { status: 410, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      invoiceNumber: invoice.invoiceNumber,
      token: invoice.token,
      sessionId: invoice.sessionId,
      filter: invoice.filter,
      createdAt: invoice.createdAt,
      expiresAt: invoice.expiresAt,
      imageUrl: `/api/public/invoice/${invoice.token}/image`,
      downloadUrl: `/api/public/invoice/${invoice.token}/image?download=1`,
    },
    { headers: corsHeaders }
  );
}

// Handle preflight OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
