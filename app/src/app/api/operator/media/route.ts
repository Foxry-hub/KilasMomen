import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { badRequest, requireOperator } from "@/lib/operator-api";
import { SETTING_KEYS, setSetting } from "@/lib/settings";

const STORAGE = path.resolve(process.cwd(), "storage");

const KINDS = {
  qris: { dir: "qris", name: "qris.png", maxBytes: 2 * 1024 * 1024, setting: SETTING_KEYS.QRIS_IMAGE_PATH },
  splash: { dir: "splash", name: "splash.mp4", maxBytes: 200 * 1024 * 1024, setting: SETTING_KEYS.SPLASH_VIDEO_PATH },
} as const;

/** Unggah aset kios: QRIS statis atau video splash (§6.5). */
export async function POST(request: Request) {
  const guard = await requireOperator();
  if (guard) return guard;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Formulir tidak valid");
  }

  const kind = String(form.get("kind") ?? "");
  if (!(kind in KINDS)) return badRequest("Jenis aset tidak valid");
  const config = KINDS[kind as keyof typeof KINDS];

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Berkas wajib diunggah");
  if (file.size > config.maxBytes) {
    return badRequest(`Berkas melebihi batas ${Math.round(config.maxBytes / 1024 / 1024)} MB`);
  }

  const dir = path.join(STORAGE, config.dir);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, config.name);
  await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));

  const relative = `${config.dir}/${config.name}`;
  await setSetting(config.setting, relative);

  return NextResponse.json({ ok: true, path: relative, url: `/api/media/${relative}` });
}
