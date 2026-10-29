import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { closeEvent } from "@/lib/event-window";

/** Tombol "Akhiri Event" (§6.6): semua link soft copy langsung 404. */
export async function POST() {
  const guard = await requireOperator();
  if (guard) return guard;

  await closeEvent();
  return NextResponse.json({ ok: true });
}
