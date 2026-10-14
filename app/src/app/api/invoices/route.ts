import { NextResponse } from "next/server";
import {
  invoicesByToken,
  invoicesBySession,
  generateInvoiceNumber,
  generateToken,
  saveImageToDisk,
  saveInvoiceMetadata,
  findInvoice,
  Invoice,
} from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, imageData, filter } = body;

    if (!sessionId || !imageData) {
      return NextResponse.json(
        { error: "sessionId dan imageData wajib disertakan" },
        { status: 400 }
      );
    }

    // Check if invoice already exists for this session
    let existing = findInvoice(sessionId);
    if (existing) {
      existing.imageData = imageData;
      existing.filter = filter || existing.filter;
      saveImageToDisk(sessionId, imageData);
      saveInvoiceMetadata(existing);
      return NextResponse.json({
        success: true,
        token: existing.token,
        invoiceNumber: existing.invoiceNumber,
        url: `/invoice/${existing.token}`,
      });
    }

    const token = generateToken(sessionId);
    const invoiceNumber = generateInvoiceNumber(sessionId);

    // Save image to disk
    saveImageToDisk(sessionId, imageData);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const newInvoice: Invoice = {
      id: "inv_" + Date.now().toString(36),
      invoiceNumber,
      sessionId,
      token,
      filter: filter || "ORIGINAL",
      imageData,
      createdAt: now.toISOString(),
      expiresAt,
    };

    invoicesByToken.set(token, newInvoice);
    invoicesBySession.set(sessionId, newInvoice);
    saveInvoiceMetadata(newInvoice);

    return NextResponse.json({
      success: true,
      token,
      invoiceNumber,
      url: `/invoice/${token}`,
    });
  } catch (err) {
    console.error("Failed to create invoice:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan invoice", details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || searchParams.get("sessionId");

  if (!token) {
    return NextResponse.json({ error: "Token atau sessionId wajib disertakan" }, { status: 400 });
  }

  const invoice = findInvoice(token);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    sessionId: invoice.sessionId,
    token: invoice.token,
    filter: invoice.filter,
    createdAt: invoice.createdAt,
    expiresAt: invoice.expiresAt,
    imageUrl: `/api/public/invoice/${invoice.token}/image`,
    downloadUrl: `/api/public/invoice/${invoice.token}/image?download=1`,
  });
}
