import { NextResponse } from "next/server";
import { badRequest, requireOperator } from "@/lib/operator-api";
import {
  frameCategorySchema,
  isValidSlotCountForCategory,
  type FrameCategory,
} from "@/lib/constants";
import { FrameError } from "@/features/frames/analyze";
import { analyzeUpload } from "@/features/frames/frame-service";

/** Analisis tanpa menyimpan (§9): dimensi, slot, profil cetak, peringatan. */
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

  const categoryRaw = form.get("category");
  const categoryParsed = frameCategorySchema.safeParse(categoryRaw);
  if (categoryRaw !== null && !categoryParsed.success) {
    return badRequest("Kategori frame tidak valid");
  }
  const category = categoryParsed.success ? (categoryParsed.data as FrameCategory) : undefined;
  const slotCountRaw = form.get("slotCount");
  const slotCount =
    typeof slotCountRaw === "string" && slotCountRaw.trim() ? Number(slotCountRaw) : undefined;
  if (
    (slotCountRaw !== null && (!Number.isInteger(slotCount) || !category)) ||
    (slotCount !== undefined &&
      category &&
      !isValidSlotCountForCategory(category, slotCount))
  ) {
    return badRequest("Jumlah slot target tidak valid untuk kategori frame");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeUpload(buffer, category, slotCount);
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof FrameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Frame analyze failed:", error);
    return NextResponse.json({ error: "Gagal menganalisis berkas" }, { status: 500 });
  }
}
