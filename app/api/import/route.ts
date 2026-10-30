import { externalizePhotos, getStored, saveState } from "@/lib/server/db";
import { isAdmin, unauthorized } from "@/lib/server/auth";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * One-time move of a board that used to live only in a browser (localStorage) onto the server.
 * Allowed only while the server still holds its untouched demo data.
 */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  const { pristine } = await getStored();
  if (!pristine) return Response.json({ error: "The server board already has changes" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { state?: AppState } | null;
  const s = body?.state;
  if (!s || !Array.isArray(s.trucks) || !Array.isArray(s.drivers) || !Array.isArray(s.quotes)) {
    return Response.json({ error: "Invalid board data" }, { status: 400 });
  }
  const state = await externalizePhotos({ ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } });
  const saved = await saveState(state);
  return Response.json({ version: saved.version, pin: saved.state.settings.pin });
}
