import { NextResponse } from "next/server";
import { badRequest, requireOperator } from "@/lib/operator-api";
import { prisma } from "@/lib/prisma";
import { frameCategorySchema, type FrameCategory } from "@/lib/constants";
import { FrameError, type PrintProfileConfig, type Slot } from "@/features/frames/analyze";
import { createFrame, serializeFrame } from "@/features/frames/frame-service";

/** Daftar semua frame (termasuk nonaktif) untuk panel operator (§9). */
export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;

  const frames = await prisma.frame.findMany({
    orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ frames: frames.map(serializeFrame) });
}

/** Simpan frame (multipart): sumber kebenaran adalah analisis ulang di server (§6.3.1). */
export async function POST(request: Request) {
  const guard = await requireOperator();
  if (guard) return guard;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Formulir tidak valid");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Berkas PNG wajib diunggah");

  const categoryParsed = frameCategorySchema.safeParse(form.get("category"));
  if (!categoryParsed.success) return badRequest("Kategori frame tidak valid");

  const name = String(form.get("name") ?? "");
  const isRecommended = String(form.get("isRecommended") ?? "false") === "true";

  let slots: unknown;
  let print: unknown;
  try {
    const rawSlots = form.get("slots");
    if (typeof rawSlots === "string") slots = JSON.parse(rawSlots);
    const rawPrint = form.get("print");
    if (typeof rawPrint === "string") print = JSON.parse(rawPrint);
  } catch {
    return badRequest("Data slot/profil tidak valid");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const frame = await createFrame({
      file: buffer,
      name,
      category: categoryParsed.data as FrameCategory,
      isRecommended,
      slots: Array.isArray(slots) ? (slots as Slot[]) : undefined,
      print: print && typeof print === "object" ? (print as PrintProfileConfig) : undefined,
    });
    return NextResponse.json(serializeFrame(frame), { status: 201 });
  } catch (error) {
    if (error instanceof FrameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Frame upload failed:", error);
    return NextResponse.json({ error: "Gagal menyimpan frame" }, { status: 500 });
  }
}
