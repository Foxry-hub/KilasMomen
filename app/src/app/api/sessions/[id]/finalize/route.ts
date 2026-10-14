import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  generateInvoiceNumber,
  generateToken,
} from "@/lib/store";
import { prisma } from "@/lib/prisma";

type FinalizePayload = {
  imageBase64?: string;
  imageData?: string;
  rawPhotos?: string[];
  filter?: string;
  frameId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  try {
    const body = (await request.json()) as FinalizePayload;
    const imageBase64 = body.imageBase64 || body.imageData;

    if (!sessionId || !imageBase64) {
      return NextResponse.json(
        { error: "sessionId dan imageBase64 wajib disertakan" },
        { status: 400 }
      );
    }

    const base64Data = imageBase64.replace(/^data:image\/[\w+.-]+;base64,/, "");
    if (!base64Data) {
      return NextResponse.json(
        { error: "Data gambar Base64 kosong" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        { error: "Data gambar Base64 tidak valid" },
        { status: 400 }
      );
    }

    const sessionDir = path.join(process.cwd(), "storage", "sessions", sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const finalImagePath = path.join(sessionDir, "final.jpg");
    fs.writeFileSync(finalImagePath, imageBuffer);
    const filePath = path
      .relative(process.cwd(), finalImagePath)
      .replace(/\\/g, "/");
    const filter = body.filter || "ORIGINAL";
    const rawPhotos = Array.isArray(body.rawPhotos) ? body.rawPhotos.slice(0, 5) : [];
    const rawPhotoPaths = rawPhotos.map((rawPhoto, index) => {
      const rawData = rawPhoto.replace(/^data:image\/[\w+.-]+;base64,/, "");
      const rawPath = path.join(sessionDir, `shot-${index + 1}.jpg`);
      fs.writeFileSync(rawPath, Buffer.from(rawData, "base64"));
      return {
        id: `photo_${Date.now().toString(36)}_${index}`,
        shotIndex: index + 1,
        filePath: path.relative(process.cwd(), rawPath).replace(/\\/g, "/"),
      };
    });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const frame = body.frameId
      ? await prisma.frame.findFirst({
          where: { OR: [{ id: body.frameId }, { slug: body.frameId }] },
          select: { id: true },
        })
      : null;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { sessionId },
    });
    const token = existingInvoice?.token || generateToken(sessionId);
    const invoiceNumber =
      existingInvoice?.invoiceNumber || generateInvoiceNumber(sessionId);
    const invoiceId =
      existingInvoice?.id || `inv_${Date.now().toString(36)}`;

    const session = await prisma.$transaction(async (tx) => {
      const photoSession = await tx.photoSession.upsert({
        where: { id: sessionId },
        create: {
          id: sessionId,
          frameId: frame?.id,
          status: "COMPLETED",
          filter,
          finalImagePath: filePath,
        },
        update: {
          frameId: frame?.id,
          status: "COMPLETED",
          filter,
          finalImagePath: filePath,
        },
      });

      await tx.invoice.upsert({
        where: { sessionId },
        create: {
          id: invoiceId,
          invoiceNumber,
          sessionId,
          token,
          filter,
          filePath,
          expiresAt,
        },
        update: {
          filter,
          filePath,
          expiresAt,
        },
      });

      if (rawPhotoPaths.length > 0) {
        await tx.photo.deleteMany({ where: { sessionId } });
        await tx.photo.createMany({
          data: rawPhotoPaths.map((photo, index) => ({
            ...photo,
            sessionId,
            selectedOrder: index < 2 ? index + 1 : null,
          })),
        });
      }

      return photoSession;
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      token,
      invoiceNumber,
      filePath,
      url: `/invoice/${token}`,
    });
  } catch (error) {
    console.error(`Failed to finalize session ${sessionId}:`, error);
    return NextResponse.json(
      { error: "Gagal menyimpan file final dan data invoice" },
      { status: 500 }
    );
  }
}
