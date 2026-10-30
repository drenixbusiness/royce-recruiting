import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { AppState } from "../types";
import { DEFAULT_SETTINGS, makeSeed } from "../seed";
import { getKV, isServerless } from "./kv";

const BOARD = "royce:board";
const VERSION = "royce:version";
const UPLOADS = "royce:uploads";
const up = (id: string, part?: number) => (part === undefined ? `royce:up:${id}:meta` : `royce:up:${id}:${part}`);

/** raw bytes per stored chunk; base64 keeps each Redis value under ~700 KB */
export const PART_BYTES = 512 * 1024;

export interface Stored {
  state: AppState;
  version: number;
  /** true until the first admin write; lets an old browser-only board be imported once */
  pristine: boolean;
}

// change notifications for open screens served by this same process (local server)
const g = globalThis as unknown as { __royceEvents?: EventEmitter };
export const events = (g.__royceEvents ??= new EventEmitter());
events.setMaxListeners(0);

/** How screens learn about changes: pushed (one long-running server) or polled (Vercel). */
export const syncMode = (): { mode: "sse" } | { mode: "poll"; ms: number } =>
  isServerless ? { mode: "poll", ms: Math.max(1000, Number(process.env.SYNC_POLL_MS) || 3000) } : { mode: "sse" };

export async function getStored(): Promise<Stored> {
  const kv = await getKV();
  const raw = await kv.get(BOARD);
  if (raw) {
    const s = JSON.parse(raw) as Stored;
    s.state.settings = { ...DEFAULT_SETTINGS, ...s.state.settings };
    return s;
  }
  const seed: Stored = { state: makeSeed(), version: 1, pristine: true };
  // two first requests at once must not both seed
  if (await kv.setIfAbsent(BOARD, JSON.stringify(seed))) {
    await kv.set(VERSION, "1");
    return seed;
  }
  return getStored();
}

export async function getVersion() {
  const kv = await getKV();
  const v = Number(await kv.get(VERSION));
  return v || (await getStored()).version;
}

export async function saveState(next: AppState): Promise<Stored> {
  const kv = await getKV();
  const version = await kv.incr(VERSION);
  const stored: Stored = { state: { ...next, updatedAt: Date.now() }, version, pristine: false };
  await kv.set(BOARD, JSON.stringify(stored));
  events.emit("change", version);
  await removeOrphans(stored.state).catch((e) => console.error("orphan cleanup failed", e));
  return stored;
}

/* ---------- uploads (truck photos, driver documents) ---------- */

export interface UploadMeta {
  kind: "photo" | "file";
  name: string;
  type: string;
  size: number;
  parts: number;
  createdAt: number;
}

export const isId = (id: string) => /^[a-f0-9-]{36}$/.test(id);

export async function createUpload(kind: UploadMeta["kind"], name: string, type: string, size: number) {
  const kv = await getKV();
  const id = randomUUID();
  const meta: UploadMeta = { kind, name, type, size, parts: Math.max(1, Math.ceil(size / PART_BYTES)), createdAt: Date.now() };
  await kv.set(up(id), JSON.stringify(meta));
  await kv.hset(UPLOADS, id, String(meta.createdAt));
  return { id, meta };
}

export async function getUploadMeta(id: string) {
  const raw = await (await getKV()).get(up(id));
  return raw ? (JSON.parse(raw) as UploadMeta) : null;
}

export async function putPart(id: string, part: number, bytes: Buffer) {
  await (await getKV()).set(up(id, part), bytes.toString("base64"));
}

/** Returns the whole upload, or null if it is missing or was never completed. */
export async function readUpload(id: string) {
  const meta = await getUploadMeta(id);
  if (!meta) return null;
  const kv = await getKV();
  const chunks: Buffer[] = [];
  for (let i = 0; i < meta.parts; i++) {
    const b64 = await kv.get(up(id, i));
    if (b64 === null) return null;
    chunks.push(Buffer.from(b64, "base64"));
  }
  return { meta, bytes: Buffer.concat(chunks) };
}

async function storeBytes(kind: UploadMeta["kind"], name: string, type: string, bytes: Buffer) {
  const { id, meta } = await createUpload(kind, name, type, bytes.length);
  for (let i = 0; i < meta.parts; i++) await putPart(id, i, bytes.subarray(i * PART_BYTES, (i + 1) * PART_BYTES));
  return id;
}

export async function savePhoto(bytes: Buffer) {
  const id = await storeBytes("photo", "photo.jpg", "image/jpeg", bytes);
  return `/api/photos/${id}`;
}

async function deleteUpload(id: string) {
  const kv = await getKV();
  const meta = await getUploadMeta(id);
  const keys = [up(id), ...Array.from({ length: meta?.parts ?? 0 }, (_, i) => up(id, i))];
  await kv.del(...keys);
  await kv.hdel(UPLOADS, id);
}

const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/** Deletes uploads nothing points to any more (older than an hour, so open dialogs keep theirs). */
async function removeOrphans(state: AppState) {
  const used = new Set<string>();
  state.trucks.forEach((t) => t.photo && used.add(t.photo.split("/").pop()!.replace(/\.jpg$/, "")));
  state.drivers.forEach((d) => Object.values(d.docs).forEach((x) => x.fileId && used.add(x.fileId)));
  const index = await (await getKV()).hgetall(UPLOADS);
  for (const [id, created] of Object.entries(index)) {
    if (!used.has(id) && Date.now() - Number(created) > ORPHAN_GRACE_MS) await deleteUpload(id);
  }
}

/** Converts photos stored inline as data URLs (old browser-only boards) into uploads. */
export async function externalizePhotos(state: AppState): Promise<AppState> {
  const trucks = [];
  for (const t of state.trucks) {
    if (!t.photo?.startsWith("data:")) trucks.push(t);
    else trucks.push({ ...t, photo: await savePhoto(Buffer.from(t.photo.split(",")[1] ?? "", "base64")) });
  }
  return { ...state, trucks };
}
