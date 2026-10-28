"use client";
import { useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import type { AppState, Driver } from "@/lib/types";
import { docCount, driverFlags, fmtDate, isReady, stageLabel } from "@/lib/logic";
import { FlagTags, ReadyTag, SW } from "./ui";

export default function Drivers({ state, openDriver }: { state: AppState; openDriver: (d: Driver | "new") => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = state.drivers
    .filter((d) => !needle || [d.name, d.location, d.phone].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => Number(!!a.truckId) - Number(!!b.truckId) || a.name.localeCompare(b.name));
  const truckNo = (id: string | null) => state.trucks.find((t) => t.id === id)?.number ?? "truck";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Drivers</h1>
          <div className="sub">{state.drivers.filter((d) => !d.truckId).length} in pipeline</div>
        </div>
        <div className="actions">
          <button className="btn alt" onClick={() => openDriver("new")}>
            <Plus size={18} strokeWidth={SW} /> Add driver
          </button>
        </div>
      </div>
      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={18} strokeWidth={SW} style={{ position: "absolute", left: 16, top: 13, color: "var(--neutral-600)" }} />
        <input className="input" style={{ paddingLeft: 44, background: "var(--surface)" }} placeholder="Search name, city or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Stage</th>
              <th>Docs</th>
              <th>Start</th>
              <th>Status</th>
              <th>Flags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className={d.truckId ? "assigned" : ""}>
                <td>
                  <div style={{ fontWeight: 800 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "var(--neutral-600)" }}>{d.phone}</div>
                </td>
                <td>{d.location}</td>
                <td>{d.truckId ? <span className="tag alt">On {truckNo(d.truckId)}</span> : stageLabel(d.stage)}</td>
                <td>{docCount(d)}/5</td>
                <td>{fmtDate(d.startDate)}</td>
                <td>
                  <ReadyTag ready={isReady(d)} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <FlagTags flags={driverFlags(d, state.settings)} />
                  </div>
                </td>
                <td>
                  <button className="btn sm" onClick={() => openDriver(d)}>
                    <Pencil size={14} strokeWidth={SW} /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8}>No drivers match “{q}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
