import { getStored } from "@/lib/server/db";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { pin } = ((await req.json().catch(() => ({}))) ?? {}) as { pin?: string };
  const { state } = await getStored();
  if (typeof pin === "string" && pin === state.settings.pin) return Response.json({ ok: true });
  // slow down guessing of a 4-digit PIN
  await new Promise((r) => setTimeout(r, 700));
  return Response.json({ ok: false }, { status: 401 });
});
