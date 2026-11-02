"use client";
import { useState } from "react";
import { MapPin, Pencil, Plus, RefreshCw, Truck as TruckIcon, Wallet, Zap } from "lucide-react";
import type { AppState, Truck, TruckStatus } from "@/lib/types";
import { STATUS_LABEL, daysSince } from "@/lib/logic";
import { cycleStatus, toggleAsap } from "@/lib/actions";
import { Seg, SW } from "./ui";

type Filter = "all" | TruckStatus;
const STATUS_TAG: Record<TruckStatus, string> = { available: "accent", reserved: "", in_service: "ok" };
const NEXT_LABEL: Record<TruckStatus, string> = { available: "Mark reserved", reserved: "Mark in service", in_service: "Mark available" };

export default function Trucks({ state, openTruck }: { state: AppState; openTruck: (t: Truck | "new") => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (f: Filter) => (f === "all" ? state.trucks.length : state.trucks.filter((t) => t.status === f).length);
  const list = state.trucks
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => Number(!!b.asap) - Number(!!a.asap) || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const asapCount = state.trucks.filter((t) => t.asap && t.status === "available").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Trucks</h1>
          <div className="sub">
            {count("available")} open{asapCount > 0 && <> · <span className="asap-text">{asapCount} ASAP</span></>} · {state.trucks.length} total
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => openTruck("new")}>
            <Plus size={18} strokeWidth={SW} /> Add truck
          </button>
        </div>
      </div>
      <Seg<Filter>
        value={filter}
        onChange={setFilter}
        options={(["all", "available", "reserved", "in_service"] as Filter[]).map((f) => ({
          value: f,
          label: f === "all" ? "All" : STATUS_LABEL[f],
          count: count(f),
        }))}
      />
      <div className="truck-grid">
        {list.length === 0 && <div className="kempty">No trucks here.</div>}
        {list.map((t) => {
          const days = daysSince(t.openedAt);
          const line =
            t.status === "available"
              ? `Open for ${days} day${days === 1 ? "" : "s"}`
              : t.status === "reserved"
                ? `Reserved for ${t.driverName || "—"}`
                : `Driver: ${t.driverName || "—"}`;
          return (
            <div key={t.id} className={`truck-card ${t.asap && t.status === "available" ? "asap" : ""}`}>
              <div className="ph">
                {t.photo ? <img className="photo" src={t.photo} alt="" /> : <TruckIcon size={56} strokeWidth={SW} />}
                <span className={`tag ${STATUS_TAG[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                {t.asap && t.status === "available" && (
                  <span className="tag asap-tag">
                    <Zap size={12} strokeWidth={SW} /> ASAP
                  </span>
                )}
              </div>
              <div className="body">
                <div className="num">
                  <span className="trunc">{t.number}</span>
                  <span className="tag alt">{t.crew}</span>
                </div>
                <div className="meta trunc">
                  {t.year} {t.model}
                </div>
                <div className="meta">
                  <MapPin size={14} strokeWidth={SW} /> <span className="trunc">{t.location}</span>
                </div>
                <div className="meta">
                  <Wallet size={14} strokeWidth={SW} /> <span className="trunc">{t.payRate} · {t.payStructure}</span>
                </div>
                <div className="meta" style={{ fontWeight: 700 }}>
                  <span className="trunc">{line}</span>
                </div>
                <div className="foot">
                  <button className="btn sm" onClick={() => openTruck(t)}>
                    <Pencil size={14} strokeWidth={SW} /> Edit
                  </button>
                  <button className="btn sm alt" onClick={() => cycleStatus(t.id)}>
                    <RefreshCw size={14} strokeWidth={SW} /> {NEXT_LABEL[t.status]}
                  </button>
                  {t.status === "available" && (
                    <button
                      className={`btn sm icon asap-toggle ${t.asap ? "on" : ""}`}
                      onClick={() => toggleAsap(t.id)}
                      title={t.asap ? "Remove ASAP" : "Mark as ASAP"}
                      aria-pressed={!!t.asap}
                    >
                      <Zap size={14} strokeWidth={SW} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
