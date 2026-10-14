import { NextResponse } from "next/server";
import path from "path";
import {
  generateInvoiceNumber,
  generateToken,
  saveImageToDisk,
} from "@/lib/store";
import { prisma } from "@/lib/prisma";

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

    const existing = await prisma.invoice.findUnique({ where: { sessionId } });
    if (existing) {
      const imagePath = saveImageToDisk(sessionId, imageData);
      if (!imagePath) {
        return NextResponse.json({ error: "Gagal menyimpan file foto" }, { status: 500 });
      }
      const filePath = path.relative(process.cwd(), imagePath).replace(/\\/g, "/");
      await prisma.$transaction([
        prisma.photoSession.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            filter: filter || existing.filter,
            finalImagePath: filePath,
          },
          update: {
            filter: filter || existing.filter,
            finalImagePath: filePath,
          },
        }),
        prisma.invoice.update({
          where: { id: existing.id },
          data: { filePath, filter: filter || existing.filter },
        }),
      ]);
      return NextResponse.json({
        success: true,
        token: existing.token,
        invoiceNumber: existing.invoiceNumber,
        url: `/invoice/${existing.token}`,
      });
    }

    const token = generateToken(sessionId);
    const invoiceNumber = generateInvoiceNumber(sessionId);

    const imagePath = saveImageToDisk(sessionId, imageData);
    if (!imagePath) {
      return NextResponse.json({ error: "Gagal menyimpan file foto" }, { status: 500 });
    }
    const filePath = path.relative(process.cwd(), imagePath).replace(/\\/g, "/");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const newInvoice = {
      id: "inv_" + Date.now().toString(36),
      invoiceNumber,
      sessionId,
      token,
      filter: filter || "ORIGINAL",
      filePath,
      createdAt: now,
      expiresAt: new Date(expiresAt),
    };

    await prisma.photoSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        filter: newInvoice.filter,
        finalImagePath: filePath,
      },
      update: {
        filter: newInvoice.filter,
        finalImagePath: filePath,
      },
    });
    await prisma.invoice.create({ data: newInvoice });

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

  const invoice = token
    ? await prisma.invoice.findFirst({
        where: { OR: [{ token }, { sessionId: token }] },
      })
    : null;

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
