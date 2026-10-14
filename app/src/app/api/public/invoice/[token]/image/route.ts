import { NextResponse } from "next/server";
import { findInvoice, getImageBuffer } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Add CORS headers for cross-origin mobile access
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const invoice = findInvoice(token);

  if (!invoice) {
    return new NextResponse("Foto tidak ditemukan", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const buffer = getImageBuffer(invoice);
  if (!buffer) {
    return new NextResponse("File gambar tidak ditemukan di sistem penyimpanan", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get("download") === "1";
  const filename = `PHOTOBOOTH_${invoice.invoiceNumber || token}.jpg`;

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "image/jpeg");
  headers.set("Content-Length", buffer.length.toString());
  headers.set("Cache-Control", "public, max-age=604800, immutable");

  if (isDownload) {
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  } else {
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers,
  });
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
