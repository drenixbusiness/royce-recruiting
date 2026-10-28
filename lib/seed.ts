import type { AppState, DocKey, Driver, Settings, StageId, Truck } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  quoteSeconds: 12,
  overdueDays: 3,
  stalledDays: 7,
  pin: "2468",
  startView: "tv",
  tvNames: "initial",
  showQuotes: true,
  palette: "dusk",
  tvTheme: "dark",
};

const DAY = 86400000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600000).toISOString();
const dateIn = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let n = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type T = [string, string, string, string, "Solo" | "Team", string, Truck["payStructure"], Truck["status"], number, string];
const TRUCKS: T[] = [
  ["RX-101", "2023", "Freightliner Cascadia", "Dallas, TX", "Solo", "$0.68 / mile", "Per mile", "available", 9, ""],
  ["RX-104", "2022", "Volvo VNL 760", "Atlanta, GA", "Team", "$0.82 / mile", "Per mile", "available", 5, ""],
  ["RX-108", "2024", "Kenworth T680", "Chicago, IL", "Solo", "28% of load", "Percentage", "available", 3, ""],
  ["RX-112", "2021", "Peterbilt 579", "Memphis, TN", "Solo", "$1,750 / week", "Weekly guarantee", "available", 1, ""],
  ["RX-115", "2023", "International LT", "Phoenix, AZ", "Team", "$0.78 / mile", "Per mile", "available", 0, ""],
  ["RX-117", "2022", "Freightliner Cascadia", "Laredo, TX", "Solo", "$0.66 / mile", "Per mile", "reserved", 6, "Marcus Hill"],
  ["RX-120", "2020", "Volvo VNL 860", "Dallas, TX", "Solo", "$0.64 / mile", "Per mile", "in_service", 40, "Darnell Price"],
  ["RX-122", "2023", "Kenworth W990", "Atlanta, GA", "Team", "$0.85 / mile", "Per mile", "in_service", 60, "Ruiz & Ortega"],
  ["RX-125", "2021", "Peterbilt 389", "Chicago, IL", "Solo", "25% of load", "Percentage", "in_service", 22, "Tom Becker"],
  ["RX-128", "2022", "Mack Anthem", "Indianapolis, IN", "Solo", "$28 / hour", "Hourly", "in_service", 31, "Lena Fox"],
  ["RX-130", "2024", "Freightliner Cascadia", "Columbus, OH", "Solo", "$0.70 / mile", "Per mile", "in_service", 14, "Andre Wells"],
  ["RX-133", "2020", "International RH", "Memphis, TN", "Solo", "$1,650 / week", "Weekly guarantee", "in_service", 75, "Kim Nguyen"],
  ["RX-136", "2023", "Volvo VNR", "Laredo, TX", "Team", "$0.80 / mile", "Per mile", "in_service", 18, "Silva Brothers"],
  ["RX-140", "2022", "Kenworth T880", "Phoenix, AZ", "Solo", "$0.67 / mile", "Per mile", "in_service", 9, "Greg Moss"],
];

const ALL: DocKey[] = ["cdl", "medical", "mvr", "drug", "application"];
const docs = (have: DocKey[]) =>
  Object.fromEntries(ALL.map((k) => [k, { done: have.includes(k), file: have.includes(k) ? `${k}.pdf` : null }])) as Driver["docs"];

// name, phone, location, stage, have docs, stageSince days, lastActivity days, followUp offset (null = none), note, start offset
type D = [string, string, string, StageId, DocKey[], number, number, number | null, string, number];
const DRIVERS: D[] = [
  ["Jamal Carter", "(214) 555-0182", "Dallas, TX", "ready", ALL, 2, 0, null, "", 5],
  ["Sofia Ramirez", "(404) 555-0119", "Atlanta, GA", "ready", ALL, 1, 1, null, "", 7],
  ["Brian Kowalski", "(312) 555-0147", "Chicago, IL", "ready", ["cdl", "medical", "mvr", "application"], 3, 2, 0, "Waiting on drug test result", 10],
  ["Marcus Hill", "(956) 555-0133", "Laredo, TX", "ready", ALL, 4, 1, null, "", 3],
  ["Tanya Brooks", "(901) 555-0164", "Memphis, TN", "approved", ALL, 2, 1, 2, "Confirm orientation date", 12],
  ["Ethan Morales", "(602) 555-0171", "Tucson, AZ", "approved", ["cdl", "medical", "mvr", "drug"], 5, 8, null, "", 14],
  ["Keisha Jordan", "(317) 555-0125", "Indianapolis, IN", "documents", ["cdl", "application"], 4, 2, -1, "Send MVR authorization", 18],
  ["Victor Chen", "(614) 555-0190", "Columbus, OH", "documents", ["cdl", "medical", "application"], 2, 1, null, "", 21],
  ["Ray Thompson", "(214) 555-0158", "Fort Worth, TX", "documents", ["application"], 9, 9, null, "", 25],
  ["Alicia Gomez", "(480) 555-0142", "Mesa, AZ", "application", [], 5, 3, null, "", 28],
  ["Derek Lawson", "(404) 555-0111", "Marietta, GA", "application", [], 4, 4, 0, "Call back about the application", 30],
  ["Nina Patel", "(773) 555-0193", "Chicago, IL", "application", ["cdl"], 1, 0, null, "", 30],
  ["Omar Haddad", "(901) 555-0177", "Memphis, TN", "contacted", [], 2, 2, 1, "Intro call", 35],
  ["Grace Kim", "(614) 555-0136", "Columbus, OH", "contacted", [], 11, 11, null, "", 40],
  ["Luis Fernandez", "(956) 555-0104", "Laredo, TX", "contacted", [], 0, 0, null, "", 35],
  ["Hannah Wright", "(317) 555-0150", "Carmel, IN", "contacted", [], 3, 1, -2, "Text about team driving", 42],
];

export const DEFAULT_QUOTES = [
  { text: "Every truck we cover is a family we support.", author: "Ashton Bridge" },
  { text: "Small daily improvements lead to stunning results.", author: "Robin Sharma" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
];

export function makeSeed(settings: Settings = DEFAULT_SETTINGS): AppState {
  const trucks: Truck[] = TRUCKS.map(([number, year, model, location, crew, payRate, payStructure, status, open, driverName]) => ({
    id: uid("t"), number, year, model, location, crew, payRate, payStructure, status,
    photo: null, openedAt: ago(open, 3), driverName,
  }));
  const drivers: Driver[] = DRIVERS.map(([name, phone, location, stage, have, since, act, fu, note, start]) => {
    const [cls, st] = ["A", location.split(", ")[1] ?? "TX"];
    return {
      id: uid("d"), name, phone, location, stage, cdlClass: cls, cdlState: st,
      cdlExpiry: dateIn(300 + since * 20), startDate: dateIn(start), docs: docs(have),
      followUpDate: fu === null ? "" : dateIn(fu), followUpNote: note,
      stageSince: ago(since, 2), lastActivity: ago(act, 1), truckId: null,
    };
  });
  // Marcus is already reserved on RX-117
  const marcus = drivers.find((d) => d.name === "Marcus Hill")!;
  marcus.truckId = trucks.find((t) => t.number === "RX-117")!.id;
  return {
    trucks, drivers,
    quotes: DEFAULT_QUOTES.map((q) => ({ ...q, id: uid("q") })),
    settings: { ...settings },
    updatedAt: Date.now(),
  };
}
