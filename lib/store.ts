"use client";
import { useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { DEFAULT_SETTINGS, makeSeed } from "./seed";

export const STORAGE_KEY = "royce-recruiting-board";

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
    }
  } catch {
    /* fall through to seed */
  }
  const seed = makeSeed();
  persist(seed);
  return seed;
}

function persist(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    console.error("Could not save to localStorage", e);
    alert("Storage is full — try removing some truck photos.");
  }
}

function emit() {
  listeners.forEach((l) => l());
}

let wired = false;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!wired && typeof window !== "undefined") {
    wired = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      state = load();
      emit();
    });
  }
  return () => listeners.delete(cb);
}

function getSnapshot() {
  if (!state) state = load();
  return state;
}

export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function update(fn: (s: AppState) => AppState) {
  const next = { ...fn(getSnapshot()), updatedAt: Date.now() };
  state = next;
  persist(next);
  emit();
}

export function resetToDemo() {
  update((s) => makeSeed(s.settings));
}
