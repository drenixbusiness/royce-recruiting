"use client";
import { AlertTriangle, ArrowLeft, ArrowRight, Link2, PhoneCall, Plus, Sparkles } from "lucide-react";
import type { AppState, Driver, Truck } from "@/lib/types";
import { STAGES, docCount, driverFlags, fmtDate, isReady, pipeline, stageIndex, stageLabel, suggestMatches, totals } from "@/lib/logic";
import { assign, markContacted, moveStage } from "@/lib/actions";
import { FlagTags, ReadyTag, SW } from "./ui";

interface Props {
  state: AppState;
  openTruck: (t: Truck | "new") => void;
  openDriver: (d: Driver | "new") => void;
}

export default function Overview({ state, openTruck, openDriver }: Props) {
  const tot = totals(state);
  const pipe = pipeline(state);
  const flagged = pipe.map((d) => ({ d, flags: driverFlags(d, state.settings) })).filter((x) => x.flags.length);
  const matches = suggestMatches(state);

  const cards = [
    { n: tot.available, l: "Uncovered trucks", c: "accent" },
    { n: tot.pipeline, l: "Drivers in pipeline", c: "" },
    { n: tot.ready, l: "Ready to start", c: "alt" },
    { n: tot.notReady, l: "Not ready", c: "" },
    { n: tot.attention, l: "Need attention", c: "" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => openTruck("new")}>
            <Plus size={18} strokeWidth={SW} /> Add truck
          </button>
          <button className="btn alt" onClick={() => openDriver("new")}>
            <Plus size={18} strokeWidth={SW} /> Add driver
          </button>
        </div>
      </div>

      <div className="totals">
        {cards.map((c) => (
          <div key={c.l} className={`total-card ${c.c}`}>
            <span className="blob" />
            <div className="num">{c.n}</div>
            <div className="lbl">{c.l}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="section-title">Pipeline</h2>
        <div className="kanban">
          {STAGES.map((s) => {
            const ds = pipe.filter((d) => d.stage === s.id);
            return (
              <div key={s.id} className="kcol">
                <h4>
                  <span>{s.label}</span>
                  <span>{ds.length}</span>
                </h4>
                {ds.length === 0 && <div className="kempty">No drivers</div>}
                {ds.map((d) => {
                  const i = stageIndex(d.stage);
                  return (
                    <div key={d.id} className="kcard">
                      <button className="name trunc" onClick={() => openDriver(d)}>
                        {d.name}
                      </button>
                      <div className="row">
                        <span className="trunc">{d.location}</span> · <span>Docs {docCount(d)}/5</span>
                      </div>
                      <div className="row">
                        <FlagTags flags={driverFlags(d, state.settings)} />
                      </div>
                      <div className="moves">
                        <ReadyTag ready={isReady(d)} />
                        <span style={{ display: "flex", gap: 4 }}>
                          <button className="btn icon sm" disabled={i === 0} onClick={() => moveStage(d.id, -1)} aria-label="Previous stage">
                            <ArrowLeft size={14} strokeWidth={SW} />
                          </button>
                          <button className="btn icon sm" disabled={i === STAGES.length - 1} onClick={() => moveStage(d.id, 1)} aria-label="Next stage">
                            <ArrowRight size={14} strokeWidth={SW} />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2 className="section-title">
            <AlertTriangle size={22} strokeWidth={SW} /> Needs attention
          </h2>
          <div className="list">
            {flagged.length === 0 && <div className="kempty">Nothing needs attention right now.</div>}
            {flagged.map(({ d, flags }) => (
              <div key={d.id} className="list-row">
                <div className="grow">
                  <div className="title">{d.name}</div>
                  <div className="meta">
                    {stageLabel(d.stage)} · {d.phone}
                  </div>
                  {flags.map((f) => (
                    <div key={f.type} className="flag-line">
                      <FlagTags flags={[f]} />
                      <span>{f.detail}</span>
                    </div>
                  ))}
                </div>
                <button className="btn sm alt" onClick={() => markContacted(d.id)}>
                  <PhoneCall size={14} strokeWidth={SW} /> Contacted
                </button>
                <button className="btn sm" onClick={() => openDriver(d)}>
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">
            <Sparkles size={22} strokeWidth={SW} /> Suggested matches
          </h2>
          <div className="list">
            {matches.length === 0 && <div className="kempty">No ready drivers with an open truck.</div>}
            {matches.map(({ driver, truck, kind }) => (
              <div key={driver.id} className="list-row">
                <div className="grow">
                  <div className="title">
                    {driver.name} → {truck.number}
                  </div>
                  <div className="meta">
                    {kind} · {truck.crew} · {truck.payRate} · Start {fmtDate(driver.startDate)}
                  </div>
                  <div className="meta">
                    {driver.location} → {truck.location}
                  </div>
                </div>
                <button className="btn sm primary" onClick={() => assign(driver.id, truck.id)}>
                  <Link2 size={14} strokeWidth={SW} /> Assign
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
