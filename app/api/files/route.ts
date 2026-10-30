import { saveFile } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const MAX = 15 * 1024 * 1024;

/** Body: the raw document bytes; the original name comes in the x-file-name header (URI-encoded). */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  const name = decodeURIComponent(req.headers.get("x-file-name") ?? "").replace(/[\\/]/g, "_").slice(0, 200) || "document";
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return Response.json({ error: "File is empty or larger than 15 MB" }, { status: 413 });
  return Response.json({ id: await saveFile(bytes, name), name });
}
