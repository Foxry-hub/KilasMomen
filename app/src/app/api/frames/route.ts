import { NextResponse } from "next/server";
import { getFrames } from "@/lib/frames";

export async function GET() {
  const frames = getFrames();
  return NextResponse.json(frames);
}
