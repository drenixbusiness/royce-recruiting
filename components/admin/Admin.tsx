"use client";
import { useCallback, useEffect, useState } from "react";
import { Delete, LayoutDashboard, Lock, Monitor, Quote, Truck as TruckIcon, Users } from "lucide-react";
import type { Driver, Truck } from "@/lib/types";
import { lock, unlock, type Board } from "@/lib/store";
import { totals } from "@/lib/logic";
import { SW } from "./ui";
import Overview from "./Overview";
import Trucks from "./Trucks";
import Drivers from "./Drivers";
import SettingsPage from "./SettingsPage";
import TruckDialog from "./TruckDialog";
import DriverDialog from "./DriverDialog";

type Page = "overview" | "trucks" | "drivers" | "settings";

function PinGate({ showHint }: { showHint: boolean }) {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = useCallback((k: string) => {
    setError(null);
    setEntry((e) => (k === "back" ? e.slice(0, -1) : (e + k).slice(0, 4)));
  }, []);

  useEffect(() => {
    if (entry.length < 4) return;
    let live = true;
    setBusy(true);
    unlock(entry)
      .then((ok) => {
        if (!live || ok) return;
        setError("Wrong PIN — try again");
        setEntry("");
      })
      .catch(() => {
        if (!live) return;
        setError("Could not reach the server");
        setEntry("");
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [entry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (/^d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, busy]);

  return (
    <div className="pin-screen">
      <div className="tv-blob" style={{ width: 520, height: 520, left: -160, bottom: -200, background: "var(--accent-2-200)", opacity: 0.6 }} />
      <div className="tv-blob" style={{ width: 380, height: 380, right: -120, top: -140, background: "var(--accent-200)", opacity: 0.6 }} />
      <div className="card pin-card">
        <div className="pin-lock">
          <Lock size={30} strokeWidth={SW} />
        </div>
        <h2 style={{ fontSize: 28 }}>Admin sign-in</h2>
        <div style={{ color: "var(--neutral-600)", fontWeight: 600, marginTop: 4 }}>Enter your 4-digit PIN</div>
        <div className={`pin-dots ${error ? "shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < entry.length ? "on" : ""} />
          ))}
        </div>
        <div className="pin-err">{error ?? ""}</div>
        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button key={k} onClick={() => press(k)} disabled={busy}>
              {k}
            </button>
          ))}
          <span />
          <button onClick={() => press("0")} disabled={busy}>0</button>
          <button onClick={() => press("back")} aria-label="Backspace" disabled={busy}>
            <Delete size={24} strokeWidth={SW} />
          </button>
        </div>
        {showHint && <div className="pin-hint">Demo PIN: 2468</div>}
      </div>
    </div>
  );
}

export default function Admin({ board, openTv }: { board: Board; openTv: () => void }) {
  const [page, setPage] = useState<Page>("overview");
  const [truckEdit, setTruckEdit] = useState<Truck | "new" | null>(null);
  const [driverEdit, setDriverEdit] = useState<Driver | "new" | null>(null);
  const state = board.state;

  if (board.role !== "admin") return <PinGate showHint={board.pristine} />;

  const tot = totals(state);
  const nav: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} strokeWidth={SW} /> },
    { id: "trucks", label: "Trucks", icon: <TruckIcon size={18} strokeWidth={SW} />, badge: tot.available },
    { id: "drivers", label: "Drivers", icon: <Users size={18} strokeWidth={SW} />, badge: tot.pipeline },
    { id: "settings", label: "TV & quotes", icon: <Quote size={18} strokeWidth={SW} /> },
  ];
  const openTruck = (t: Truck | "new") => setTruckEdit(t);
  const openDriver = (d: Driver | "new") => setDriverEdit(d);

  return (
    <div className="admin theme-root">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">R</span>
          <div>
            <b>Royce Recruiting</b>
            <small>by Ashton Bridge</small>
          </div>
        </div>
        {nav.map((n) => (
          <button key={n.id} className={`nav-item ${page === n.id ? "on" : ""}`} onClick={() => setPage(n.id)}>
            {n.icon}
            <span className="lbl">{n.label}</span>
            {n.badge !== undefined && <span className="badge">{n.badge}</span>}
          </button>
        ))}
        <div className="spacer" />
        <button className="nav-item" onClick={openTv}>
          <Monitor size={18} strokeWidth={SW} />
          <span className="lbl">Open TV display</span>
        </button>
        <button className="nav-item" onClick={lock}>
          <Lock size={18} strokeWidth={SW} />
          <span className="lbl">Lock admin</span>
        </button>
      </aside>
      <main className="admin-main">
        {page === "overview" && <Overview state={state} openTruck={openTruck} openDriver={openDriver} />}
        {page === "trucks" && <Trucks state={state} openTruck={openTruck} />}
        {page === "drivers" && <Drivers state={state} openDriver={openDriver} />}
        {page === "settings" && <SettingsPage state={state} />}
      </main>
      {truckEdit && <TruckDialog state={state} truck={truckEdit === "new" ? null : truckEdit} onClose={() => setTruckEdit(null)} />}
      {driverEdit && <DriverDialog state={state} driver={driverEdit === "new" ? null : driverEdit} onClose={() => setDriverEdit(null)} />}
    </div>
  );
}
