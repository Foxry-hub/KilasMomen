import { uploadSessionPhoto } from "@/features/kiosk/photo-upload";

/** POST /api/kiosk/sessions/[id]/photos — unggah foto untuk satu indeks. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return uploadSessionPhoto(request, id);
}
