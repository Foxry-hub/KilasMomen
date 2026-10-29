import { NextResponse } from "next/server";
import { endOperatorSession } from "@/lib/auth";

export async function POST() {
  await endOperatorSession();
  return NextResponse.json({ ok: true });
}
