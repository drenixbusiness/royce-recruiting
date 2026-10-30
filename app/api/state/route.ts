import { getStored, saveState, syncMode } from "@/lib/server/db";
import { isAdmin, publicState, unauthorized } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const stored = await getStored();
  const admin = isAdmin(req, stored);
  return Response.json(
    {
      state: admin ? stored.state : publicState(stored.state),
      version: stored.version,
      role: admin ? "admin" : "public",
      pristine: stored.pristine,
      sync: syncMode(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

function looksLikeState(s: unknown): s is AppState {
  const x = s as AppState;
  return !!x && Array.isArray(x.trucks) && Array.isArray(x.drivers) && Array.isArray(x.quotes) && typeof x.settings === "object";
}

export const PUT = handle(async (req: Request) => {
  if (!isAdmin(req, await getStored())) return unauthorized();
  const body = (await req.json().catch(() => null)) as { state?: unknown } | null;
  if (!looksLikeState(body?.state)) return Response.json({ error: "Invalid board data" }, { status: 400 });
  if (!/^\d{4}$/.test(body.state.settings.pin ?? "")) return Response.json({ error: "PIN must be 4 digits" }, { status: 400 });
  const saved = await saveState(body.state);
  return Response.json({ version: saved.version, updatedAt: saved.state.updatedAt });
});
