import { NextResponse } from "next/server";
import { badRequest, notFound, requireOperator } from "@/lib/operator-api";
import { prisma } from "@/lib/prisma";
import { frameCategorySchema, isValidSlotCountForCategory, type FrameCategory } from "@/lib/constants";
import {
  parseSlotsConfig,
  serializeSlotsConfig,
  type PrintProfileConfig,
  type Slot,
} from "@/features/frames/analyze";
import { serializeFrame } from "@/features/frames/frame-service";

/** Ubah metadata/slot/profil frame. Dimensi tidak dapat diubah (§9). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const frame = await prisma.frame.findUnique({ where: { id } });
  if (!frame) return notFound("Frame tidak ditemukan");

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    category?: unknown;
    isRecommended?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
    slots?: unknown;
    print?: unknown;
  };

  const config = parseSlotsConfig(frame.slotsConfig);
  const currentSlots = config?.slots ?? [];

  const nextCategory: FrameCategory | null =
    body.category === undefined
      ? (frame.category as FrameCategory)
      : (() => {
          const parsed = frameCategorySchema.safeParse(body.category);
          return parsed.success ? parsed.data : null;
        })();
  if (nextCategory === null) return badRequest("Kategori frame tidak valid");

  const nextSlots: Slot[] = Array.isArray(body.slots) ? (body.slots as Slot[]) : currentSlots;
  if (!isValidSlotCountForCategory(nextCategory, nextSlots.length)) {
    return badRequest(
      `Jumlah slot ${nextSlots.length} tidak cocok untuk kategori ${nextCategory}`
    );
  }

  const shortSide = Math.min(frame.canvasWidth, frame.canvasHeight);
  const minSlotSide = 0.05 * shortSide;
  for (const s of nextSlots) {
    const bad =
      [s.x, s.y, s.w, s.h].some((n) => typeof n !== "number" || !Number.isFinite(n)) ||
      s.x < 0 ||
      s.y < 0 ||
      s.x + s.w > frame.canvasWidth ||
      s.y + s.h > frame.canvasHeight ||
      s.w < minSlotSide ||
      s.h < minSlotSide;
    if (bad) return badRequest("Ada slot di luar kanvas atau terlalu kecil");
  }

  const nextPrint: PrintProfileConfig =
    body.print && typeof body.print === "object"
      ? { ...(config?.print ?? {}), ...(body.print as PrintProfileConfig) }
      : config?.print ?? { dpi: 300, paper: "4R", widthIn: 4, heightIn: 6, fit: "CONTAIN" };

  const updated = await prisma.frame.update({
    where: { id },
    data: {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : frame.name,
      category: nextCategory,
      isRecommended:
        typeof body.isRecommended === "boolean" ? body.isRecommended : frame.isRecommended,
      isActive: typeof body.isActive === "boolean" ? body.isActive : frame.isActive,
      sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : frame.sortOrder,
      slotCount: nextSlots.length,
      slotsConfig: serializeSlotsConfig({ version: 2, slots: nextSlots, print: nextPrint }),
    },
  });

  return NextResponse.json(serializeFrame(updated));
}
