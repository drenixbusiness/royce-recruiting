import fs from "fs/promises";
import path from "path";
import { PHOTO_DIR, isId } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(PHOTO_DIR, id));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
