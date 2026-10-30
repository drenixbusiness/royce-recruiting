import type { AppState } from "../types";
import type { Stored } from "./db";

export const PIN_HEADER = "x-admin-pin";

export function isAdmin(req: Request, stored: Stored) {
  const pin = req.headers.get(PIN_HEADER);
  return !!pin && pin === stored.state.settings.pin;
}

export const unauthorized = () => Response.json({ error: "Admin PIN required" }, { status: 401 });

/** What the TV (and anyone without the PIN) may see: no PIN, phones, notes, licences or documents. */
export function publicState(s: AppState): AppState {
  return {
    ...s,
    settings: { ...s.settings, pin: "" },
    drivers: s.drivers.map((d) => ({
      ...d,
      phone: "",
      followUpNote: "",
      cdlClass: "",
      cdlState: "",
      cdlExpiry: "",
      docs: Object.fromEntries(Object.entries(d.docs).map(([k, v]) => [k, { done: v.done, file: null, fileId: null }])) as typeof d.docs,
    })),
  };
}
