import { getStored, savePhoto } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Vercel accepts request bodies up to 4.5 MB; photos are resized to 800px first, so they are far smaller
const MAX = 4 * 1024 * 1024;

/** Body: the resized JPEG bytes. */
export const POST = handle(async (req: Request) => {
  if (!isAdmin(req, await getStored())) return unauthorized();
  if (!(req.headers.get("content-type") ?? "").startsWith("image/")) return Response.json({ error: "Expected an image" }, { status: 400 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return Response.json({ error: "Photo is empty or larger than 4 MB" }, { status: 413 });
  return Response.json({ url: await savePhoto(bytes) });
});
