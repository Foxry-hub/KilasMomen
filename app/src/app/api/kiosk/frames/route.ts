import { NextResponse } from "next/server";
import { requireKiosk } from "@/lib/kiosk-api";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import { serializeFrame } from "@/features/frames/frame-service";

/** GET /api/kiosk/frames — katalog frame aktif (§7.4). Rekomendasi di atas, lalu sortOrder/nama. */
export async function GET(request: Request) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const frames = await prisma.frame.findMany({
    where: { isActive: true },
    orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  let rows = frames.map(serializeFrame);

  const filterByPaper = (await getSetting(SETTING_KEYS.KIOSK_FILTER_BY_ACTIVE_PAPER)) === "true";
  if (filterByPaper) {
    const activePaper = (await getSetting(SETTING_KEYS.PRINT_ACTIVE_PAPER)) || "4R";
    rows = rows.filter((f) => f.print?.paper === activePaper);
  }

  return NextResponse.json({ frames: rows });
}
