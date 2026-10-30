import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { AppState } from "../types";
import { DEFAULT_SETTINGS, makeSeed } from "../seed";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");
export const FILE_DIR = path.join(DATA_DIR, "files");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface Stored {
  state: AppState;
  version: number;
  /** true until the first admin write; lets an old browser-only board be imported once */
  pristine: boolean;
}

// keep one instance across dev hot reloads
const g = globalThis as unknown as { __royceDb?: { data: Stored | null; lock: Promise<unknown>; events: EventEmitter } };
const db = (g.__royceDb ??= { data: null, lock: Promise.resolve(), events: new EventEmitter() });
db.events.setMaxListeners(0);

export const events = db.events;

async function ensureDirs() {
  await fs.mkdir(PHOTO_DIR, { recursive: true });
  await fs.mkdir(FILE_DIR, { recursive: true });
}

async function writeAtomic(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
}

async function load(): Promise<Stored> {
  if (db.data) return db.data;
  await ensureDirs();
  try {
    const parsed = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Stored;
    parsed.state.settings = { ...DEFAULT_SETTINGS, ...parsed.state.settings };
    db.data = parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    db.data = { state: makeSeed(), version: 1, pristine: true };
    await writeAtomic(DB_FILE, JSON.stringify(db.data));
  }
  return db.data;
}

/** Runs writes one at a time so concurrent requests can't interleave. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = db.lock.then(fn, fn);
  db.lock = run.catch(() => undefined);
  return run;
}

export async function getStored() {
  return load();
}

export function saveState(next: AppState) {
  return serial(async () => {
    const cur = await load();
    const stored: Stored = { state: { ...next, updatedAt: Date.now() }, version: cur.version + 1, pristine: false };
    await writeAtomic(DB_FILE, JSON.stringify(stored));
    db.data = stored;
    events.emit("change", stored.version);
    void removeOrphans(stored.state);
    return stored;
  });
}

const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/** Deletes uploads nothing points to any more (older than an hour, so open dialogs keep theirs). */
async function removeOrphans(state: AppState) {
  const photos = new Set(state.trucks.map((t) => t.photo?.split("/").pop()).filter(Boolean));
  const files = new Set(state.drivers.flatMap((d) => Object.values(d.docs).map((x) => x.fileId)).filter(Boolean));
  for (const [dir, keep] of [[PHOTO_DIR, photos], [FILE_DIR, files]] as const) {
    try {
      for (const name of await fs.readdir(dir)) {
        if (keep.has(name.split(".")[0]) || keep.has(name)) continue;
        const full = path.join(dir, name);
        const { mtimeMs } = await fs.stat(full);
        if (Date.now() - mtimeMs > ORPHAN_GRACE_MS) await fs.unlink(full);
      }
    } catch (e) {
      console.error("orphan cleanup failed", e);
    }
  }
}

export const isId = (id: string) => /^[a-f0-9-]{36}(\.jpg)?$/.test(id);

export async function savePhoto(bytes: Buffer) {
  await ensureDirs();
  const id = randomUUID();
  await fs.writeFile(path.join(PHOTO_DIR, `${id}.jpg`), bytes);
  return `/api/photos/${id}.jpg`;
}

export async function saveFile(bytes: Buffer, name: string) {
  await ensureDirs();
  const id = randomUUID();
  await fs.writeFile(path.join(FILE_DIR, id), bytes);
  await fs.writeFile(path.join(FILE_DIR, `${id}.json`), JSON.stringify({ name }));
  return id;
}

export async function readFileMeta(id: string) {
  const meta = JSON.parse(await fs.readFile(path.join(FILE_DIR, `${id}.json`), "utf8")) as { name: string };
  return { ...meta, bytes: await fs.readFile(path.join(FILE_DIR, id)) };
}

/** Converts photos stored inline as data URLs (old browser-only boards) into files. */
export async function externalizePhotos(state: AppState): Promise<AppState> {
  const trucks = await Promise.all(
    state.trucks.map(async (t) => {
      if (!t.photo?.startsWith("data:")) return t;
      const b64 = t.photo.split(",")[1] ?? "";
      return { ...t, photo: await savePhoto(Buffer.from(b64, "base64")) };
    }),
  );
  return { ...state, trucks };
}
