"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { Flag } from "@/lib/logic";

export const SW = 2.75;

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: ReactNode; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Two-step destructive button: first click arms, second confirms. */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`btn danger ${armed ? "confirm" : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      <Trash2 size={16} strokeWidth={SW} />
      {armed ? confirmLabel : label}
    </button>
  );
}

/** `group` renders a div instead of a label, for fields made of several buttons (pickers, steppers). */
export function Field({ label, error, children, className = "", group = false }: { label: string; error?: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {error && <em className="error">{error}</em>}
    </Tag>
  );
}

const FLAG_TONE: Record<Flag["type"], string> = { overdue: "bad", missing: "warn", stalled: "bad", followup: "accent" };

export function FlagTags({ flags }: { flags: Flag[] }) {
  return (
    <>
      {flags.map((f) => (
        <span key={f.type} className={`tag ${FLAG_TONE[f.type]}`} title={f.detail}>
          {f.label}
        </span>
      ))}
    </>
  );
}

export function ReadyTag({ ready }: { ready: boolean }) {
  return <span className={`tag ${ready ? "ok" : ""}`}>{ready ? "Ready" : "Not ready"}</span>;
}
