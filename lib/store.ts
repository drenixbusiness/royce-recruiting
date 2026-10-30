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

export async function refresh() {
  if (pending > 0) return; // our own save is in flight; we refresh once it lands
  try {
    const r = await fetch("/api/state", { headers: auth(), cache: "no-store" });
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    const j = (await r.json()) as { state: AppState; version: number; role: Role; pristine: boolean };
    if (pending > 0) return;
    if (j.role !== "admin" && getPin()) storePin(null); // PIN was changed elsewhere
    version = j.version;
    board = { state: j.state, role: j.role, online: true, pristine: j.pristine, error: board?.error ?? null };
    emit();
  } catch {
    if (board) set({ online: false });
    clearTimeout(retry);
    retry = setTimeout(refresh, 3000);
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refresh();
  const es = new EventSource("/api/events");
  es.onmessage = (e) => {
    const v = (JSON.parse(e.data) as { version: number }).version;
    if (v !== version || !board?.online) void refresh();
  };
  es.onerror = () => set({ online: false });
  // safety net in case an event is ever missed
  setInterval(() => void refresh(), 30000);
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

export async function uploadFile(file: File): Promise<{ id: string; name: string }> {
  const r = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name), ...auth() },
    body: file,
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as { id: string; name: string };
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
