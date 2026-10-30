import { PART_BYTES, getStored, getUploadMeta, isId, putPart, readUpload } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TYPES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", txt: "text/plain", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Receives one piece of a document: ?part=N, body = raw bytes (at most PART_BYTES). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  if (!isAdmin(req, await getStored())) return unauthorized();
  const { id } = await params;
  const meta = isId(id) ? await getUploadMeta(id) : null;
  if (!meta || meta.kind !== "file") return Response.json({ error: "Upload not found" }, { status: 404 });
  const part = Number(new URL(req.url).searchParams.get("part"));
  if (!Number.isInteger(part) || part < 0 || part >= meta.parts) return Response.json({ error: "Bad part number" }, { status: 400 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > PART_BYTES) return Response.json({ error: "Bad part size" }, { status: 400 });
  await putPart(id, part, bytes);
  return Response.json({ ok: true });
});

/** Driver documents are private: only an unlocked admin can read them. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  if (!isAdmin(req, await getStored())) return unauthorized();
  const { id } = await params;
  const found = isId(id) ? await readUpload(id) : null;
  if (!found || found.meta.kind !== "file") return Response.json({ error: "Document not found" }, { status: 404 });
  const ext = found.meta.name.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": TYPES[ext] ?? (found.meta.type || "application/octet-stream"),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(found.meta.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
