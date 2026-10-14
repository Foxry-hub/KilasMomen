import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findInvoice } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { token },
      include: { session: { include: { photos: { orderBy: { shotIndex: "asc" } } } } },
    });

    const legacyInvoice = invoice ? null : findInvoice(token);
    if (!invoice && !legacyInvoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }

    const storageRoot = path.resolve(process.cwd(), "storage", "sessions");
    const sessionId = invoice?.sessionId || legacyInvoice?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: "Sesi invoice tidak valid" }, { status: 404 });
    }
    const sessionDir = path.resolve(storageRoot, sessionId);
    if (!sessionDir.startsWith(`${storageRoot}${path.sep}`)) {
      return NextResponse.json({ error: "Path sesi tidak valid" }, { status: 400 });
    }

    const files = fs.existsSync(sessionDir)
      ? fs
          .readdirSync(sessionDir)
          .filter((file) => /^shot-\d+\.(jpg|jpeg|png)$/i.test(file))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .slice(0, 5)
      : [];

    if (files.length === 0) {
      return NextResponse.json(
        { message: "Foto mentah tidak ditemukan" },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    let addedFiles = 0;
    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        zip.file(file, fs.readFileSync(filePath));
        addedFiles += 1;
      }
    }

    if (addedFiles === 0) {
      return NextResponse.json(
        { message: "Foto mentah tidak ditemukan" },
        { status: 404 }
      );
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Length": zipBuffer.length.toString(),
      "Content-Disposition": `attachment; filename="Mentahan-Foto-${token}.zip"`,
      "Cache-Control": "no-store",
    });

    return new NextResponse(new Uint8Array(zipBuffer), { status: 200, headers });
  } catch (error) {
    console.error(`Failed to package raw photos for invoice ${token}:`, error);
    return NextResponse.json(
      { error: "Gagal menyiapkan ZIP foto mentah" },
      { status: 500 }
    );
  }
}
