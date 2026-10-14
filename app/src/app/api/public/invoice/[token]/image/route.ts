import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
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

  const invoice = await prisma.invoice.findUnique({
    where: { token },
  });

  if (!invoice) {
    // Keep invoices created before the Prisma migration readable.
    const legacyInvoice = findInvoice(token);
    if (legacyInvoice) {
      const legacyBuffer = getImageBuffer(legacyInvoice);
      if (legacyBuffer) {
        const { searchParams } = new URL(request.url);
        const isDownload = searchParams.get("download") === "1";
        const filename = `PHOTOBOOTH_${legacyInvoice.invoiceNumber || token}.jpg`;
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "image/jpeg");
        headers.set("Content-Length", legacyBuffer.length.toString());
        headers.set(
          "Content-Disposition",
          `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
        );
        return new NextResponse(new Uint8Array(legacyBuffer), { status: 200, headers });
      }
    }
    return new NextResponse("Foto tidak ditemukan", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const storageRoot = path.resolve(process.cwd(), "storage", "sessions");
  const imagePath = path.resolve(process.cwd(), invoice.filePath);
  if (!imagePath.startsWith(`${storageRoot}${path.sep}`)) {
    return new NextResponse("Path file gambar tidak valid", {
      status: 404,
      headers: corsHeaders,
    });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(imagePath);
  } catch (error) {
    console.error("Failed to read invoice image:", error);
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
