"use client";
import { update } from "./store";
import { STAGES, stageIndex, todayStr } from "./logic";
import type { Driver, Truck, TruckStatus } from "./types";

const now = () => new Date().toISOString();

export function moveStage(id: string, dir: -1 | 1) {
  update((s) => ({
    ...s,
    drivers: s.drivers.map((d) => {
      if (d.id !== id) return d;
      const next = STAGES[stageIndex(d.stage) + dir];
      return next ? { ...d, stage: next.id, stageSince: now(), lastActivity: now() } : d;
    }),
  }));
}

export function markContacted(id: string) {
  update((s) => ({
    ...s,
    drivers: s.drivers.map((d) =>
      d.id !== id
        ? d
        : {
            ...d,
            lastActivity: now(),
            ...(d.followUpDate && d.followUpDate <= todayStr() ? { followUpDate: "", followUpNote: "" } : {}),
          },
    ),
  }));
}

export function assign(driverId: string, truckId: string) {
  update((s) => {
    const driver = s.drivers.find((d) => d.id === driverId);
    if (!driver) return s;
    return {
      ...s,
      trucks: s.trucks.map((t) => (t.id === truckId ? { ...t, status: "reserved" as const, driverName: driver.name } : t)),
      drivers: s.drivers.map((d) => (d.id === driverId ? { ...d, truckId, lastActivity: now() } : d)),
    };
  });
}

const NEXT: Record<TruckStatus, TruckStatus> = { available: "reserved", reserved: "in_service", in_service: "available" };

export function cycleStatus(id: string) {
  update((s) => {
    const t = s.trucks.find((x) => x.id === id);
    if (!t) return s;
    const status = NEXT[t.status];
    if (status !== "available") return { ...s, trucks: s.trucks.map((x) => (x.id === id ? { ...x, status } : x)) };
    return {
      ...s,
      trucks: s.trucks.map((x) => (x.id === id ? { ...x, status, openedAt: now(), driverName: "" } : x)),
      drivers: s.drivers.map((d) => (d.truckId === id ? { ...d, truckId: null } : d)),
    };
  });
}

/** Saves a truck; `driverId` links a pipeline driver to it (taking them out of the pipeline). */
export function saveTruck(t: Truck, driverId: string | null = null) {
  update((s) => {
    const prev = s.trucks.find((x) => x.id === t.id);
    let truck = t;
    let drivers = s.drivers;
    if (t.status === "available") {
      truck = { ...t, driverName: "", openedAt: prev && prev.status !== "available" ? now() : t.openedAt };
      drivers = drivers.map((d) => (d.truckId === t.id ? { ...d, truckId: null } : d));
    } else {
      const linked = drivers.find((d) => d.id === driverId);
      if (linked) truck = { ...t, driverName: linked.name };
      drivers = drivers.map((d) => {
        if (d.id === driverId) return { ...d, truckId: t.id, lastActivity: d.truckId === t.id ? d.lastActivity : now() };
        return d.truckId === t.id ? { ...d, truckId: null } : d;
      });
    }
    return {
      ...s,
      drivers,
      trucks: prev ? s.trucks.map((x) => (x.id === t.id ? truck : x)) : [...s.trucks, truck],
    };
  });
}

export function deleteTruck(id: string) {
  update((s) => ({
    ...s,
    trucks: s.trucks.filter((t) => t.id !== id),
    drivers: s.drivers.map((d) => (d.truckId === id ? { ...d, truckId: null } : d)),
  }));
}

export function saveDriver(d: Driver) {
  update((s) => {
    const prev = s.drivers.find((x) => x.id === d.id);
    const driver = {
      ...d,
      stageSince: !prev || prev.stage !== d.stage ? now() : d.stageSince,
      lastActivity: now(),
    };
    return {
      ...s,
      drivers: prev ? s.drivers.map((x) => (x.id === d.id ? driver : x)) : [...s.drivers, driver],
      // keep the name on their truck in step with a rename
      trucks: driver.truckId ? s.trucks.map((t) => (t.id === driver.truckId ? { ...t, driverName: driver.name } : t)) : s.trucks,
    };
  });
}

export function deleteDriver(id: string) {
  update((s) => ({ ...s, drivers: s.drivers.filter((d) => d.id !== id) }));
}
