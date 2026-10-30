import { PART_BYTES, createUpload, getStored } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const MAX = 15 * 1024 * 1024;

/**
 * Starts a document upload. Body: { name, type, size }.
 * The bytes then go to POST /api/files/<id>?part=N in PART_BYTES pieces (keeps each request under Vercel's 4.5 MB limit).
 */
export const POST = handle(async (req: Request) => {
  if (!isAdmin(req, await getStored())) return unauthorized();
  const body = (await req.json().catch(() => null)) as { name?: string; type?: string; size?: number } | null;
  const size = Number(body?.size);
  if (!Number.isFinite(size) || size <= 0) return Response.json({ error: "The file is empty" }, { status: 400 });
  if (size > MAX) return Response.json({ error: "File is larger than 15 MB" }, { status: 413 });
  const name = String(body?.name ?? "").replace(/[\\/]/g, "_").slice(0, 200) || "document";
  const { id, meta } = await createUpload("file", name, String(body?.type ?? ""), size);
  return Response.json({ id, name, parts: meta.parts, partBytes: PART_BYTES });
});
