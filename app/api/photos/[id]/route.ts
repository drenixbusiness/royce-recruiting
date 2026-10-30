import { isId, readUpload } from "@/lib/server/db";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Truck photos are public (the TV shows them) and never change, so they cache forever. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = (await params).id.replace(/\.jpg$/, "");
  const found = isId(id) ? await readUpload(id) : null;
  if (!found || found.meta.kind !== "photo") return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(found.bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
});
