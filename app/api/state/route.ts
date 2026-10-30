import { getStored, saveState } from "@/lib/server/db";
import { isAdmin, publicState, unauthorized } from "@/lib/server/auth";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { state, version, pristine } = await getStored();
  const admin = await isAdmin(req);
  return Response.json(
    { state: admin ? state : publicState(state), version, role: admin ? "admin" : "public", pristine },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function looksLikeState(s: unknown): s is AppState {
  const x = s as AppState;
  return !!x && Array.isArray(x.trucks) && Array.isArray(x.drivers) && Array.isArray(x.quotes) && typeof x.settings === "object";
}

export async function PUT(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as { state?: unknown } | null;
  if (!looksLikeState(body?.state)) return Response.json({ error: "Invalid board data" }, { status: 400 });
  if (!/^\d{4}$/.test(body.state.settings.pin ?? "")) return Response.json({ error: "PIN must be 4 digits" }, { status: 400 });
  const saved = await saveState(body.state);
  return Response.json({ version: saved.version, updatedAt: saved.state.updatedAt });
}
