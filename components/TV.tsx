"use client";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Quote as QuoteIcon, Truck as TruckIcon, UserRound, Zap } from "lucide-react";
import type { AppState, Truck } from "@/lib/types";
import { STAGES, driverFlags, openLabel, pipeline, sortOpen, totals, tvName } from "@/lib/logic";

const W = 1920;
const H = 1080;
const GRID_W = 1320;
const GAP = 20;
const BASE_W = 400;
const BASE_H = 270;
const MAX_ZOOM = 1.3;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function useScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => setS(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return s;
}

/** Try 1–6 columns and keep the layout where cards end up largest. */
function layoutGrid(n: number, areaH: number) {
  let best = { cols: 1, zoom: 0, ratio: Infinity };
  for (let cols = 1; cols <= Math.min(6, Math.max(1, n)); cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (GRID_W - (cols - 1) * GAP) / cols;
    const cellH = (areaH - (rows - 1) * GAP) / rows;
    const zoom = Math.min(cellW / BASE_W, cellH / BASE_H, MAX_ZOOM);
    const ratio = Math.abs(cellW / cellH - BASE_W / BASE_H);
    if (zoom > best.zoom + 0.001 || (Math.abs(zoom - best.zoom) <= 0.001 && ratio < best.ratio)) best = { cols, zoom, ratio };
  }
  return best;
}

function Ticket({ t }: { t: Truck }) {
  const label = openLabel(t);
  const badge = <span className={`ticket-badge ${label === "New today" ? "new" : ""}`}>{label}</span>;
  return (
    <div className={`ticket ${t.photo ? "has-photo" : ""} ${t.asap ? "asap" : ""}`}>
      <div className="ticket-top">
        {t.photo ? (
          <>
            <img className="photo ticket-bg" src={t.photo} alt="" />
            <span className="ticket-scrim" />
          </>
        ) : (
          <div className="ticket-blob" />
        )}
        <div className="ticket-info">
          <span className="ticket-tags">
            {t.asap && (
              <span className="ticket-asap">
                <Zap size="1em" strokeWidth={2.75} fill="currentColor" /> ASAP
              </span>
            )}
            <span className="ticket-crew">{t.crew}</span>
          </span>
          <div className="ticket-num trunc">{t.number}</div>
          <div className="ticket-model trunc">
            {t.year} {t.model}
          </div>
          <div className="ticket-loc">
            <MapPin size="1em" strokeWidth={2.75} style={{ flex: "none" }} />
            <span className="trunc">{t.location}</span>
          </div>
          {t.recruiter && (
            <div className="ticket-hr">
              <UserRound size="1em" strokeWidth={2.75} style={{ flex: "none" }} />
              <span className="trunc">HR: {t.recruiter}</span>
            </div>
          )}
        </div>
        {t.photo ? (
          <div className="ticket-corner">{badge}</div>
        ) : (
          <div className="ticket-photo-wrap">
            <div className="ticket-photo">
              <TruckIcon size="2.8em" strokeWidth={2.75} />
            </div>
            {badge}
          </div>
        )}
      </div>
      <div className="ticket-tear">
        <span className="ticket-notch l" />
        <span className="ticket-notch r" />
      </div>
      <div className="ticket-strip">
        <span className="ticket-pay trunc">{t.payRate}</span>
        <span className="ticket-struct trunc">{t.payStructure}</span>
      </div>
    </div>
  );
}

function CoverageRing({ state }: { state: AppState }) {
  const tot = totals(state);
  const order = { available: 0, reserved: 1, in_service: 2 } as const;
  const trucks = [...state.trucks].sort((a, b) => order[a.status] - order[b.status] || Number(!!b.asap) - Number(!!a.asap));
  const n = Math.max(trucks.length, 1);
  const R = 138;
  const size = Math.max(10, Math.min(30, ((2 * Math.PI * R) / n) * 0.62));
  return (
    <div className="ring-wrap">
      <div className="ring">
        {trucks.map((t, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const style: React.CSSProperties = {
            left: 160 + R * Math.cos(a),
            top: 160 + R * Math.sin(a),
            width: size,
            height: size,
          };
          if (t.status === "available") Object.assign(style, { border: `${Math.max(3, size / 6)}px solid ${t.asap ? "var(--asap)" : "var(--ring)"}` });
          else if (t.status === "reserved") style.background = "var(--neutral-400)";
          else style.background = "var(--ok)";
          return <span key={t.id} className={`ring-dot ${t.asap && t.status === "available" ? "asap" : ""}`} style={style} />;
        })}
        <div className="ring-center">
          <div className="lbl">Trucks to cover</div>
          <div className="big">{tot.available}</div>
          <div className="sub">
            {tot.covered} of {tot.total} covered
          </div>
        </div>
      </div>
      <div className="legend">
        {[
          { n: tot.available, t: "Available", s: { border: "4px solid var(--ring)" } },
          { n: tot.reserved, t: "Reserved", s: { background: "var(--neutral-400)" } },
          { n: tot.inService, t: "In service", s: { background: "var(--ok)" } },
        ].map((x) => (
          <div key={x.t} className="legend-item">
            <span className="sw" style={x.s} />
            <div>
              <div className="n">{x.n}</div>
              <div className="t">{x.t}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// fill strength of each stage's count circle, deepening toward Ready to Start
const STAGE_FILL = [22, 40, 58, 80, 100];

function Upcoming({ state }: { state: AppState }) {
  const pipe = pipeline(state);
  const tot = totals(state);
  const rows = STAGES.map((s) => {
    const ds = pipe
      .filter((d) => d.stage === s.id)
      .map((d) => ({ d, flagged: driverFlags(d, state.settings).length > 0 }))
      .sort((a, b) => Number(b.flagged) - Number(a.flagged));
    return { ...s, ds, flagged: ds.filter((x) => x.flagged).length };
  });
  const maxFlag = Math.max(...rows.map((r) => r.flagged));
  const bottleneck = maxFlag > 0 ? rows.find((r) => r.flagged === maxFlag)!.id : null;
  return (
    <div className="upcoming">
      <h3>Upcoming drivers</h3>
      <div className="meta">
        {tot.pipeline - tot.ready} in onboarding, {tot.ready} ready to start
      </div>
      <div className="stage-rows">
        {rows.map((r, i) => {
          const bn = r.id === bottleneck;
          const shown = r.ds.slice(0, bn ? 1 : 2);
          const more = r.ds.length - shown.length;
          return (
            <div key={r.id} className={`stage-row ${bn ? "bottleneck" : ""}`}>
              <span
                className="stage-count"
                style={{
                  background: `color-mix(in oklch, var(--ok) ${STAGE_FILL[i]}%, transparent)`,
                  color: i >= 3 ? "var(--bg)" : "var(--text)",
                }}
              >
                {r.ds.length}
              </span>
              <span className="stage-text">
                <span className="stage-line">
                  <span className="stage-name trunc">{r.label}</span>
                  {bn && <span className="bn-pill">Bottleneck</span>}
                </span>
                <span className="chips">
                  {shown.map(({ d, flagged }) => (
                    <span key={d.id} className={`chip trunc ${flagged ? "flag" : ""}`}>
                      {tvName(d.name, state.settings.tvNames)}
                    </span>
                  ))}
                  {more > 0 && <span className="chip-more">+{more}</span>}
                  {r.ds.length === 0 && <span className="chip-empty">No drivers</span>}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuoteBar({ state }: { state: AppState }) {
  const quotes = state.quotes;
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (quotes.length < 2) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setI((x) => x + 1);
        setVisible(true);
      }, 500);
    }, Math.max(3, state.settings.quoteSeconds) * 1000);
    return () => clearInterval(t);
  }, [quotes.length, state.settings.quoteSeconds]);
  const q = quotes.length ? quotes[i % quotes.length] : null;
  return (
    <div className="tv-footer">
      <span className="qicon">
        <QuoteIcon size={34} strokeWidth={2.75} />
      </span>
      <span className="qtext trunc" style={{ opacity: visible ? 1 : 0 }}>
        {q ? `“${q.text}”` : "Add a quote in the admin panel."}
      </span>
      {q?.author && (
        <span className="qauthor" style={{ opacity: visible ? 1 : 0 }}>
          — {q.author}
        </span>
      )}
    </div>
  );
}

export default function TV({ state }: { state: AppState }) {
  const scale = useScale();
  const now = useNow();
  const dark = state.settings.tvTheme === "dark";
  const showQuotes = state.settings.showQuotes;
  const open = useMemo(() => sortOpen(state.trucks), [state.trucks]);
  const asapCount = open.filter((t) => t.asap).length;

  // canvas 1080 − padding 72 − header 92 − gap 24 − title 64 − gap 22 (− footer 96 − gap 24)
  const gridH = 1080 - 72 - 116 - 86 - (showQuotes ? 120 : 0);
  const { cols, zoom } = layoutGrid(open.length, gridH);
  const rows: Truck[][] = [];
  for (let i = 0; i < open.length; i += cols) rows.push(open.slice(i, i + cols));

  const ago = Math.max(0, Math.round((now - state.updatedAt) / 1000));
  const agoText = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago / 60)}m` : `${Math.floor(ago / 3600)}h`;
  const d = new Date(now);

  return (
    <div className="tv-viewport">
      <div className="tv-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div
          className="tv-blob"
          style={{ width: 820, height: 820, left: -300, bottom: -380, background: `var(--accent-2-${dark ? "800" : "200"})`, opacity: dark ? 0.55 : 0.6 }}
        />
        <div
          className="tv-blob"
          style={{ width: 640, height: 640, right: -220, top: -300, background: `var(--accent-${dark ? "800" : "200"})`, opacity: dark ? 0.5 : 0.55 }}
        />

        <header className="tv-header">
          <div className="tv-logo">R</div>
          <div className="tv-brand">
            <h1>Royce Recruiting</h1>
            <p>by Ashton Bridge</p>
          </div>
          <div className="live-pill">
            <span className="live-dot" />
            Live updated {agoText} ago
          </div>
          <div className="tv-clock">
            <div className="time">{d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
            <div className="date">{d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
          </div>
        </header>

        <div className="tv-body">
          <section className="tv-main">
            <div className="tv-title">
              <span className="count-pill">{open.length}</span>
              <h2>Available trucks</h2>
              {asapCount > 0 && (
                <span className="asap-pill">
                  <Zap size={24} strokeWidth={2.75} fill="currentColor" /> {asapCount} need a driver ASAP
                </span>
              )}
            </div>
            {open.length === 0 ? (
              <div className="tv-empty">
                <div className="tv-blob" style={{ width: 420, height: 420, right: -120, top: -140, background: "var(--accent-2-200)", opacity: 0.5 }} />
                <h3>Every truck is covered</h3>
                <p>Great work, team — no open trucks right now.</p>
              </div>
            ) : (
              <div className="tv-grid" style={{ fontSize: 16 * zoom }}>
                {rows.map((r, i) => (
                  <div className="tv-row" key={i}>
                    {r.map((t) => (
                      <Ticket key={t.id} t={t} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="tv-side">
            <CoverageRing state={state} />
            <Upcoming state={state} />
          </aside>
        </div>

        {showQuotes && <QuoteBar state={state} />}
      </div>
    </div>
  );
}
