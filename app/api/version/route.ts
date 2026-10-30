import { getVersion } from "@/lib/server/db";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Cheap change check the screens poll on Vercel (one small read). */
export const GET = handle(async () =>
  Response.json({ version: await getVersion() }, { headers: { "Cache-Control": "no-store" } }),
);
