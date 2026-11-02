export type TruckStatus = "available" | "reserved" | "in_service";
export type PayStructure = "Per mile" | "Percentage" | "Weekly guarantee" | "Hourly";
export type Crew = "Solo" | "Team";

export interface Truck {
  id: string;
  number: string;
  year: string;
  model: string;
  location: string;
  crew: Crew;
  payRate: string;
  payStructure: PayStructure;
  status: TruckStatus;
  photo: string | null;
  openedAt: string;
  driverName: string;
  /** needs a driver urgently: listed first on the TV and highlighted; cleared once the truck is covered */
  asap?: boolean;
}

export type StageId = "contacted" | "application" | "documents" | "approved" | "ready";

export type DocKey = "cdl" | "medical" | "mvr" | "drug" | "application";

export interface DocState {
  done: boolean;
  /** original file name of the uploaded document */
  file: string | null;
  /** id of the stored upload, served from /api/files/<id> */
  fileId?: string | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  location: string;
  stage: StageId;
  cdlClass: string;
  cdlState: string;
  cdlExpiry: string;
  startDate: string;
  docs: Record<DocKey, DocState>;
  followUpDate: string;
  followUpNote: string;
  stageSince: string;
  lastActivity: string;
  truckId: string | null;
}

export interface Quote {
  id: string;
  text: string;
  author: string;
}

export type PaletteId = "dusk" | "emerald" | "navy" | "burgundy" | "organic";

export interface Settings {
  quoteSeconds: number;
  overdueDays: number;
  stalledDays: number;
  pin: string;
  startView: "tv" | "admin";
  tvNames: "initial" | "initials";
  showQuotes: boolean;
  palette: PaletteId;
  tvTheme: "dark" | "light";
}

export interface AppState {
  trucks: Truck[];
  drivers: Driver[];
  quotes: Quote[];
  settings: Settings;
  updatedAt: number;
}
