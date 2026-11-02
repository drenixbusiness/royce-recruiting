import type { AppState, DocKey, Driver, Settings, StageId, Truck } from "./types";

export const STAGES: { id: StageId; label: string }[] = [
  { id: "contacted", label: "Contacted" },
  { id: "application", label: "Application Pending" },
  { id: "documents", label: "Documents Pending" },
  { id: "approved", label: "Approved" },
  { id: "ready", label: "Ready to Start" },
];

export const stageIndex = (s: StageId) => STAGES.findIndex((x) => x.id === s);
export const stageLabel = (s: StageId) => STAGES[stageIndex(s)]?.label ?? s;

export const DOCS: { key: DocKey; label: string }[] = [
  { key: "cdl", label: "CDL copy" },
  { key: "medical", label: "DOT medical card" },
  { key: "mvr", label: "MVR report" },
  { key: "drug", label: "Drug test result" },
  { key: "application", label: "Signed application" },
];

export const STATUS_LABEL: Record<Truck["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  in_service: "In service",
};

const DAY = 86400000;
export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (ymd: string) => {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const docCount = (d: Driver) => DOCS.filter((x) => d.docs[x.key]?.done).length;
export const missingDocs = (d: Driver) => DOCS.filter((x) => !d.docs[x.key]?.done).map((x) => x.label);
export const isReady = (d: Driver) => d.stage === "ready" && docCount(d) === DOCS.length;

export type FlagType = "overdue" | "missing" | "stalled" | "followup";
export interface Flag {
  type: FlagType;
  label: string;
  detail: string;
}

export function driverFlags(d: Driver, s: Settings): Flag[] {
  if (d.truckId) return [];
  const flags: Flag[] = [];
  const inStage = daysSince(d.stageSince);
  if (d.stage === "application" && inStage >= s.overdueDays)
    flags.push({ type: "overdue", label: "Application overdue", detail: `${inStage} days in Application Pending` });
  const missing = missingDocs(d);
  if (stageIndex(d.stage) >= 2 && missing.length)
    flags.push({ type: "missing", label: "Missing documents", detail: missing.join(", ") });
  const idle = daysSince(d.lastActivity);
  if (idle >= s.stalledDays && !isReady(d))
    flags.push({ type: "stalled", label: "Stalled", detail: `No activity for ${idle} days` });
  if (d.followUpDate && d.followUpDate <= todayStr()) {
    const today = d.followUpDate === todayStr();
    flags.push({
      type: "followup",
      label: today ? "Follow-up today" : "Follow-up overdue",
      detail: `${today ? "Due today" : `Due ${fmtDate(d.followUpDate)}`}${d.followUpNote ? ` · ${d.followUpNote}` : ""}`,
    });
  }
  return flags;
}

export const pipeline = (s: AppState) => s.drivers.filter((d) => !d.truckId);

/** Open trucks, ASAP ones first, then longest-open first. */
export const sortOpen = (trucks: Truck[]) =>
  trucks
    .filter((t) => t.status === "available")
    .sort((a, b) => Number(!!b.asap) - Number(!!a.asap) || a.openedAt.localeCompare(b.openedAt));

export function totals(s: AppState) {
  const pipe = pipeline(s);
  const available = s.trucks.filter((t) => t.status === "available").length;
  const reserved = s.trucks.filter((t) => t.status === "reserved").length;
  const inService = s.trucks.filter((t) => t.status === "in_service").length;
  const ready = pipe.filter(isReady).length;
  return {
    available, reserved, inService,
    total: s.trucks.length,
    covered: s.trucks.length - available,
    pipeline: pipe.length,
    ready,
    notReady: pipe.length - ready,
    attention: pipe.filter((d) => driverFlags(d, s.settings).length > 0).length,
  };
}

const stateOf = (loc: string) => loc.split(",").pop()?.trim().toUpperCase() ?? "";
const cityOf = (loc: string) => loc.split(",")[0]?.trim().toLowerCase() ?? "";

export interface Match {
  driver: Driver;
  truck: Truck;
  kind: "Same city" | "Same state" | "Longest open";
}

export function suggestMatches(s: AppState): Match[] {
  const open = sortOpen(s.trucks);
  const used = new Set<string>();
  const out: Match[] = [];
  for (const d of pipeline(s).filter(isReady)) {
    const free = open.filter((t) => !used.has(t.id));
    if (!free.length) break;
    let truck = free.find((t) => cityOf(t.location) === cityOf(d.location));
    let kind: Match["kind"] = "Same city";
    if (!truck) {
      truck = free.find((t) => stateOf(t.location) === stateOf(d.location));
      kind = "Same state";
    }
    if (!truck) {
      truck = free[0];
      kind = "Longest open";
    }
    used.add(truck.id);
    out.push({ driver: d, truck, kind });
  }
  return out;
}

export function tvName(name: string, mode: Settings["tvNames"]) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (mode === "initials") return parts.map((p) => p[0].toUpperCase()).join("");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

export function openLabel(t: Truck) {
  const d = daysSince(t.openedAt);
  return d === 0 ? "New today" : `Open ${d} day${d === 1 ? "" : "s"}`;
}

export async function resizePhoto(file: File, max = 800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
