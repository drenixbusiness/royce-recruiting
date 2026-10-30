import { savePhoto } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const MAX = 5 * 1024 * 1024;

/** Body: the resized JPEG bytes (the admin resizes to 800px before upload). */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  if (!(req.headers.get("content-type") ?? "").startsWith("image/")) return Response.json({ error: "Expected an image" }, { status: 400 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return Response.json({ error: "Photo is empty or larger than 5 MB" }, { status: 413 });
  return Response.json({ url: await savePhoto(bytes) });
}
