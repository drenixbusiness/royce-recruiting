"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { SW } from "./ui";

/* ---------- popover plumbing ---------- */

function usePopover(estHeight: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < estHeight + 12 && r.top > below;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8));
    setPos({
      position: "fixed",
      left,
      minWidth: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
  }, [estHeight]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // capture phase, so Escape closes only the popover and not the dialog underneath
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return { open, setOpen, close, pos, triggerRef, popRef };
}

function Popover({ pos, popRef, children, className = "" }: { pos: React.CSSProperties | null; popRef: React.RefObject<HTMLDivElement | null>; children: ReactNode; className?: string }) {
  if (!pos) return null;
  return createPortal(
    <div ref={popRef} className={`popover ${className}`} style={pos}>
      {children}
    </div>,
    document.body,
  );
}

/* ---------- Select ---------- */

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

export function Select<T extends string>({
  value, options, onChange, className = "", style, ariaLabel,
}: { value: T; options: Option<T>[]; onChange: (v: T) => void; className?: string; style?: React.CSSProperties; ariaLabel?: string }) {
  const { open, setOpen, close, pos, triggerRef, popRef } = usePopover(options.length * 44 + 16);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const pick = (v: T) => {
    onChange(v);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(options[active].value);
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`input picker ${open ? "open" : ""} ${className}`}
        style={style}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onKeyDown={onKey}
      >
        <span className="trunc">{current?.label ?? "Select…"}</span>
        <ChevronDown size={18} strokeWidth={SW} className="chev" />
      </button>
      {open && (
        <Popover pos={pos} popRef={popRef}>
          <div role="listbox" className="menu">
            {options.map((o, i) => (
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                key={o.value}
                className={`menu-item ${o.value === value ? "sel" : ""} ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                <span className="trunc">{o.label}</span>
                {o.value === value && <Check size={16} strokeWidth={SW} />}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/* ---------- DatePicker ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DatePicker({ value, onChange, error, placeholder = "Pick a date" }: { value: string; onChange: (v: string) => void; error?: boolean; placeholder?: string }) {
  const { open, setOpen, close, pos, triggerRef, popRef } = usePopover(380);
  const selected = parseYmd(value);
  const [view, setView] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (open) setView(parseYmd(value) ?? new Date());
  }, [open, value]);

  const today = toYmd(new Date());
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - offset + i));
  const shift = (m: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + m, 1));

  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`input picker ${open ? "open" : ""} ${error ? "err" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        <span className={`trunc ${selected ? "" : "placeholder"}`}>
          {selected ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : placeholder}
        </span>
        <CalendarDays size={18} strokeWidth={SW} className="chev" />
      </button>
      {open && (
        <Popover pos={pos} popRef={popRef} className="calendar">
          <div>
            <div className="cal-head">
              <button type="button" className="btn icon sm" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft size={16} strokeWidth={SW} />
              </button>
              <span className="head">{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <button type="button" className="btn icon sm" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight size={16} strokeWidth={SW} />
              </button>
            </div>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => (
                <span key={w} className="cal-wd">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const ymd = toYmd(d);
                const cls = [
                  "cal-day",
                  d.getMonth() !== view.getMonth() ? "out" : "",
                  ymd === today ? "today" : "",
                  ymd === value ? "sel" : "",
                ].join(" ");
                return (
                  <button type="button" key={ymd} className={cls} onClick={() => pick(ymd)}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="cal-foot">
              <button type="button" className="btn sm alt" onClick={() => pick(today)}>
                Today
              </button>
              {value && (
                <button type="button" className="btn sm ghost" onClick={() => pick("")}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}

/* ---------- NumberField ---------- */

export function NumberField({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n))));
  return (
    <div className="stepper">
      <button type="button" className="step" onClick={() => commit(value - 1)} disabled={value <= min} aria-label="Decrease">
        <Minus size={16} strokeWidth={SW} />
      </button>
      <input
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "");
          setDraft(v);
          const n = Number(v);
          if (v && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => (draft && Number.isFinite(Number(draft)) ? commit(Number(draft)) : setDraft(String(value)))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            commit(value + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            commit(value - 1);
          }
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
      <button type="button" className="step" onClick={() => commit(value + 1)} disabled={value >= max} aria-label="Increase">
        <Plus size={16} strokeWidth={SW} />
      </button>
    </div>
  );
}
