"use client";
import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AppState, PaletteId, Settings } from "@/lib/types";
import { PALETTES, swatchColors } from "@/lib/theme";
import { resetToDemo, update } from "@/lib/store";
import { uid } from "@/lib/seed";
import { Field, Seg, SW } from "./ui";
import { NumberField, Select } from "./controls";

function PaletteLabel({ id }: { id: PaletteId }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span className="swatches">
        {swatchColors(id).map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
      {PALETTES[id].label}
    </span>
  );
}

const setSetting =<K extends keyof Settings>(k: K, v: Settings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));

function NumberSetting({ label, k, min, max, value, suffix }: { label: string; k: "quoteSeconds" | "overdueDays" | "stalledDays"; min: number; max: number; value: number; suffix: string }) {
  return (
    <Field label={label} group>
      <NumberField value={value} min={min} max={max} suffix={suffix} onChange={(n) => setSetting(k, n)} />
    </Field>
  );
}

export default function SettingsPage({ state }: { state: AppState }) {
  const s = state.settings;
  const [pin, setPin] = useState(s.pin);
  const [pinMsg, setPinMsg] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [armed, setArmed] = useState(false);

  const savePin = () => {
    if (!/^\d{4}$/.test(pin)) return setPinMsg("PIN must be 4 digits");
    setSetting("pin", pin);
    setPinMsg("PIN saved");
  };

  const addQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    update((st) => ({ ...st, quotes: [...st.quotes, { id: uid("q"), text: text.trim(), author: author.trim() }] }));
    setText("");
    setAuthor("");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>TV & quotes</h1>
          <div className="sub">Display options, rules and the quote rotation</div>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card">
          <h2 className="section-title">Display</h2>
          <div className="setting-row">
            <span>Start view</span>
            <Seg value={s.startView} onChange={(v) => setSetting("startView", v)} options={[{ value: "tv", label: "TV" }, { value: "admin", label: "Admin" }]} />
          </div>
          <div className="setting-row">
            <span>TV names</span>
            <Seg value={s.tvNames} onChange={(v) => setSetting("tvNames", v)} options={[{ value: "initial", label: "First + initial" }, { value: "initials", label: "Initials only" }]} />
          </div>
          <div className="setting-row">
            <span>Show quotes</span>
            <Seg value={s.showQuotes ? "on" : "off"} onChange={(v) => setSetting("showQuotes", v === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
          </div>
          <div className="setting-row">
            <span>TV theme</span>
            <Seg value={s.tvTheme} onChange={(v) => setSetting("tvTheme", v)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
          </div>
          <div className="setting-row">
            <span>Palette</span>
            <Select<PaletteId>
              value={s.palette}
              onChange={(v) => setSetting("palette", v)}
              style={{ width: 230 }}
              ariaLabel="Palette"
              options={(Object.keys(PALETTES) as PaletteId[]).map((id) => ({ value: id, label: <PaletteLabel id={id} /> }))}
            />
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Rules & security</h2>
          <div className="rules-grid">
            <NumberSetting label="Quote rotation" k="quoteSeconds" min={3} max={600} value={s.quoteSeconds} suffix="sec" />
            <NumberSetting label="Application overdue after" k="overdueDays" min={1} max={60} value={s.overdueDays} suffix="days" />
            <NumberSetting label="Stalled after" k="stalledDays" min={1} max={90} value={s.stalledDays} suffix="days" />
            <Field label="Admin PIN" error={pinMsg && pinMsg !== "PIN saved" ? pinMsg : undefined}>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" value={pin} maxLength={4} inputMode="numeric" onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinMsg(""); }} />
                <button type="button" className="btn primary sm" onClick={savePin}>
                  {pinMsg === "PIN saved" ? "Saved" : "Save"}
                </button>
              </div>
            </Field>
          </div>
          <div style={{ marginTop: 22 }}>
            <button
              className={`btn danger ${armed ? "confirm" : ""}`}
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  setTimeout(() => setArmed(false), 4000);
                  return;
                }
                resetToDemo();
                setArmed(false);
              }}
            >
              <RotateCcw size={16} strokeWidth={SW} /> {armed ? "Click again — this replaces all data" : "Reset to demo data"}
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Quotes ({state.quotes.length})</h2>
        <form onSubmit={addQuote} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input className="input" style={{ flex: "3 1 280px", width: "auto" }} placeholder="Quote text" value={text} onChange={(e) => setText(e.target.value)} />
          <input className="input" style={{ flex: "1 1 160px", width: "auto" }} placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <button className="btn primary" disabled={!text.trim()}>
            <Plus size={16} strokeWidth={SW} /> Add quote
          </button>
        </form>
        <div className="list">
          {state.quotes.map((q) => (
            <div key={q.id} className="list-row">
              <div className="grow">
                <div className="title">“{q.text}”</div>
                {q.author && <div className="meta">— {q.author}</div>}
              </div>
              <button className="btn sm danger" onClick={() => update((st) => ({ ...st, quotes: st.quotes.filter((x) => x.id !== q.id) }))}>
                <Trash2 size={14} strokeWidth={SW} /> Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
