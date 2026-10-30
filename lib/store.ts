"use client";
import { useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { makeSeed } from "./seed";

/** The board lives on the server (data/db.json); every open screen follows it through /api/events. */

const PIN_KEY = "royce-admin-pin";
const PIN_HEADER = "x-admin-pin";
/** where the board used to live before it moved to the server */
const LEGACY_KEY = "royce-recruiting-board";

export type Role = "admin" | "public";

export interface Board {
  state: AppState;
  role: Role;
  online: boolean;
  pristine: boolean;
  error: string | null;
}

let board: Board | null = null;
let version = 0;
let pin: string | null | undefined;
let pending = 0;
let queue: Promise<void> = Promise.resolve();
let started = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<Board>) => {
  if (!board) return;
  board = { ...board, ...patch };
  emit();
};

function getPin() {
  if (pin === undefined) {
    try {
      pin = sessionStorage.getItem(PIN_KEY);
    } catch {
      pin = null;
    }
  }
  return pin;
}

function storePin(p: string | null) {
  pin = p;
  try {
    if (p) sessionStorage.setItem(PIN_KEY, p);
    else sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* private mode: PIN lasts for this page only */
  }
}

const auth = (p: string | null = getPin()): Record<string, string> => (p ? { [PIN_HEADER]: p } : {});

let retry: ReturnType<typeof setTimeout> | undefined;
type Sync = { mode: "sse" } | { mode: "poll"; ms: number };
let sync: Sync | null = null;

/** Set when the server has no database connected (e.g. a Vercel deploy without Redis); shown as a setup screen. */
let setupError: string | null = null;
const setupListeners = new Set<() => void>();

export async function refresh() {
  if (pending > 0) return; // our own save is in flight; we refresh once it lands
  try {
    const r = await fetch("/api/state", { headers: auth(), cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as {
      state: AppState; version: number; role: Role; pristine: boolean; sync: Sync; error?: string; setup?: boolean;
    };
    if (r.status === 503 && j.setup) {
      setupError = j.error ?? "No database connected";
      setupListeners.forEach((l) => l());
      throw new Error(setupError);
    }
    if (!r.ok) throw new Error(j.error ?? `Server error ${r.status}`);
    if (setupError) {
      setupError = null;
      setupListeners.forEach((l) => l());
    }
    if (pending > 0) return;
    if (j.role !== "admin" && getPin()) storePin(null); // PIN was changed elsewhere
    version = j.version;
    board = { state: j.state, role: j.role, online: true, pristine: j.pristine, error: board?.error ?? null };
    emit();
    if (!sync) startSync(j.sync ?? { mode: "sse" });
  } catch {
    if (board) set({ online: false });
    clearTimeout(retry);
    retry = setTimeout(refresh, setupError ? 10000 : 3000);
  }
}

/** Follows changes: pushed events from a long-running server, or polling a tiny version check on Vercel. */
function startSync(s: Sync) {
  sync = s;
  if (s.mode === "sse") {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      const v = (JSON.parse(e.data) as { version: number }).version;
      if (v !== version || !board?.online) void refresh();
    };
    es.onerror = () => set({ online: false });
    // safety net in case an event is ever missed
    setInterval(() => void refresh(), 30000);
    return;
  }
  let lastSeen = version;
  const poll = async () => {
    // background admin tabs don't need to poll; the TV is always visible
    if (!document.hidden) {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const v = ((await r.json()) as { version: number }).version;
        if (v !== lastSeen || !board?.online) {
          lastSeen = v;
          await refresh();
        }
      } catch {
        set({ online: false });
      }
    }
    setTimeout(poll, s.ms);
  };
  setTimeout(poll, s.ms);
  document.addEventListener("visibilitychange", () => !document.hidden && void refresh());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refresh();
}

export function useSetupError(): string | null {
  return useSyncExternalStore(
    (cb) => {
      setupListeners.add(cb);
      start();
      return () => setupListeners.delete(cb);
    },
    () => setupError,
    () => null,
  );
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => listeners.delete(cb);
}

export function useBoard(): Board | null {
  return useSyncExternalStore(subscribe, () => board, () => null);
}

export function useAppState(): AppState | null {
  return useBoard()?.state ?? null;
}

function fail(message: string) {
  set({ error: message });
  setTimeout(() => board?.error === message && set({ error: null }), 7000);
}

/** Applies a change right away on screen and saves it to the server (saves run in order). */
export function update(fn: (s: AppState) => AppState) {
  if (!board || board.role !== "admin") return;
  const next = { ...fn(board.state), updatedAt: Date.now() };
  set({ state: next });
  const p = getPin();
  pending++;
  queue = queue.then(async () => {
    try {
      const r = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth(p) },
        body: JSON.stringify({ state: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { version?: number; error?: string };
      if (r.status === 401) storePin(null);
      if (!r.ok) throw new Error(j.error ?? `Save failed (${r.status})`);
      version = Math.max(version, j.version ?? version);
    } catch (e) {
      fail(e instanceof TypeError ? "Could not reach the server — change not saved" : (e as Error).message);
    } finally {
      pending--;
      if (pending === 0) await refresh();
    }
  });
}

export function resetToDemo() {
  update((s) => makeSeed(s.settings));
}

export function clearBoard() {
  update((s) => ({ ...s, trucks: [], drivers: [] }));
}

/* ---------- admin session ---------- */

export async function unlock(entered: string) {
  const r = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: entered }),
  });
  if (!r.ok) return false;
  storePin(entered);
  await refresh();
  await importLegacyBoard();
  return true;
}

export function lock() {
  storePin(null);
  void refresh();
}

/** Called after a PIN change so the next saves use the new PIN. */
export function rememberPin(p: string) {
  storePin(p);
}

/** Moves a board saved by the old browser-only version onto the server, once. */
async function importLegacyBoard() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw || !board?.pristine) return;
  try {
    const r = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ state: JSON.parse(raw) }),
    });
    if (!r.ok) return;
    const j = (await r.json()) as { pin: string };
    storePin(j.pin);
    localStorage.removeItem(LEGACY_KEY);
    await refresh();
  } catch (e) {
    console.error("Import of the old browser board failed", e);
  }
}

/* ---------- uploads ---------- */

async function readError(r: Response) {
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return j.error ?? `Upload failed (${r.status})`;
}

export async function uploadPhoto(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const r = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg", ...auth() }, body: blob });
  if (!r.ok) throw new Error(await readError(r));
  return ((await r.json()) as { url: string }).url;
}

/** Uploads a document in small pieces, so large scans fit hosting request limits. */
export async function uploadFile(file: File): Promise<{ id: string; name: string }> {
  const r = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth() },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  if (!r.ok) throw new Error(await readError(r));
  const { id, name, parts, partBytes } = (await r.json()) as { id: string; name: string; parts: number; partBytes: number };
  for (let i = 0; i < parts; i++) {
    const p = await fetch(`/api/files/${id}?part=${i}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...auth() },
      body: file.slice(i * partBytes, (i + 1) * partBytes),
    });
    if (!p.ok) throw new Error(await readError(p));
  }
  return { id, name };
}

/** Opens a private driver document in a new tab (fetched with the admin PIN). */
export async function openFile(id: string) {
  const win = window.open("", "_blank");
  const r = await fetch(`/api/files/${id}`, { headers: auth() });
  if (!r.ok) {
    win?.close();
    fail(await readError(r));
    return;
  }
  const url = URL.createObjectURL(await r.blob());
  if (win) win.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
