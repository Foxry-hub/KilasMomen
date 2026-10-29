import { NextResponse } from "next/server";
import { startOperatorSession, verifyPin } from "@/lib/auth";
import { copy } from "@/lib/copy.id";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
  const pin = String(body.pin ?? "");
  if (!(await verifyPin(pin))) {
    return NextResponse.json({ error: copy.operator.login.wrong }, { status: 401 });
  }
  await startOperatorSession();
  return NextResponse.json({ ok: true });
}
