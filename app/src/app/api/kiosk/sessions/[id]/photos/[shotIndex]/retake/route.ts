import { uploadSessionPhoto } from "@/features/kiosk/photo-upload";

/** POST /api/kiosk/sessions/[id]/photos/[shotIndex]/retake. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; shotIndex: string }> }
) {
  const { id, shotIndex } = await ctx.params;
  return uploadSessionPhoto(request, id, Number(shotIndex));
}
