"use client";
import { useRef, useState } from "react";
import { FileText, Paperclip, UserRound } from "lucide-react";
import type { AppState, DocKey, DocState, Driver, StageId } from "@/lib/types";
import { DOCS, STAGES, isReady } from "@/lib/logic";
import { deleteDriver, saveDriver } from "@/lib/actions";
import { uid } from "@/lib/seed";
import { openFile, uploadFile } from "@/lib/store";
import { ConfirmButton, Field, Modal, ReadyTag, SW } from "./ui";
import { DatePicker, Select } from "./controls";

const blank = (): Driver => ({
  id: uid("d"), name: "", phone: "", location: "", stage: "contacted", cdlClass: "A", cdlState: "", cdlExpiry: "", startDate: "",
  docs: Object.fromEntries(DOCS.map((d) => [d.key, { done: false, file: null, fileId: null }])) as Driver["docs"],
  followUpDate: "", followUpNote: "", stageSince: new Date().toISOString(), lastActivity: new Date().toISOString(), truckId: null,
});

function DocRow({ k, label, doc, onChange, onBusy }: { k: DocKey; label: string; doc: DocState; onChange: (k: DocKey, doc: DocState) => void; onBusy: (busy: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (f?: File) => {
    if (!f) return;
    setError("");
    setUploading(true);
    onBusy(true);
    try {
      const { id, name } = await uploadFile(f);
      onChange(k, { done: true, file: name, fileId: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      onBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="doc-row">
      <label>
        <input
          type="checkbox"
          checked={doc.done}
          onChange={(e) => onChange(k, e.target.checked ? { ...doc, done: true } : { done: false, file: null, fileId: null })}
        />
        <span className="trunc">{label}</span>
      </label>
      {error && <span className="doc-error trunc">{error}</span>}
      {doc.fileId && doc.file && (
        <button type="button" className="doc-file trunc" onClick={() => openFile(doc.fileId!)} title={`Open ${doc.file}`}>
          <FileText size={14} strokeWidth={SW} /> <span className="trunc">{doc.file}</span>
        </button>
      )}
      <button type="button" className="btn sm" onClick={() => ref.current?.click()} disabled={uploading}>
        <Paperclip size={14} strokeWidth={SW} /> {uploading ? "Uploading…" : doc.fileId ? "Replace" : "Upload"}
      </button>
      <input ref={ref} type="file" accept="image/*,.pdf,.doc,.docx,.txt" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}

export default function DriverDialog({ driver, onClose }: { state: AppState; driver: Driver | null; onClose: () => void }) {
  const [d, setD] = useState<Driver>(() => driver ?? blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Driver>(k: K, v: Driver[K]) => setD((x) => ({ ...x, [k]: v }));
  const setDoc = (k: DocKey, doc: DocState) => setD((x) => ({ ...x, docs: { ...x.docs, [k]: doc } }));
  const [busy, setBusy] = useState(0);
  const onBusy = (b: boolean) => setBusy((n) => n + (b ? 1 : -1));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (d.name.trim().split(/\s+/).length < 2) err.name = "First and last name";
    if (d.phone.replace(/\D/g, "").length < 10) err.phone = "Enter a 10-digit phone";
    if (!/^.+,\s*[A-Za-z]{2}$/.test(d.location.trim())) err.location = "Use “City, ST”";
    if (d.cdlState && !/^[A-Za-z]{2}$/.test(d.cdlState.trim())) err.cdlState = "2-letter state";
    if (d.followUpNote && !d.followUpDate) err.followUpDate = "Pick a date for the note";
    setErrors(err);
    if (Object.keys(err).length) return;
    saveDriver({ ...d, name: d.name.trim(), phone: d.phone.trim(), location: d.location.trim(), cdlState: d.cdlState.trim().toUpperCase() });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <h2>
          <UserRound size={28} strokeWidth={SW} /> {driver ? driver.name : "Add driver"}
          <span style={{ marginLeft: "auto" }}>
            <ReadyTag ready={isReady(d)} />
          </span>
        </h2>
        <div className="grid3">
          <Field label="Name" error={errors.name}>
            <input className={`input ${errors.name ? "err" : ""}`} value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input className={`input ${errors.phone ? "err" : ""}`} value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(214) 555-0100" inputMode="tel" />
          </Field>
          <Field label="Location" error={errors.location}>
            <input className={`input ${errors.location ? "err" : ""}`} value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Dallas, TX" />
          </Field>
          <Field label="Stage" group>
            <Select<StageId> value={d.stage} onChange={(v) => set("stage", v)} options={STAGES.map((s) => ({ value: s.id, label: s.label }))} />
          </Field>
          <Field label="CDL class / state" error={errors.cdlState} group>
            <div style={{ display: "flex", gap: 6 }}>
              <Select
                value={d.cdlClass}
                onChange={(v) => set("cdlClass", v)}
                options={["A", "B", "C"].map((c) => ({ value: c, label: c }))}
                style={{ flex: "1 1 0", minWidth: 0 }}
                ariaLabel="CDL class"
              />
              <input
                className={`input ${errors.cdlState ? "err" : ""}`}
                style={{ flex: "1 1 0", minWidth: 0 }}
                value={d.cdlState}
                maxLength={2}
                onChange={(e) => set("cdlState", e.target.value)}
                placeholder="TX"
                aria-label="CDL state"
              />
            </div>
          </Field>
          <Field label="CDL expiry" group>
            <DatePicker value={d.cdlExpiry} onChange={(v) => set("cdlExpiry", v)} />
          </Field>
          <Field label="Expected start" group>
            <DatePicker value={d.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
          <Field label="Follow-up date" error={errors.followUpDate} group>
            <DatePicker value={d.followUpDate} onChange={(v) => set("followUpDate", v)} error={!!errors.followUpDate} />
          </Field>
          <Field label="Follow-up note">
            <input className="input" value={d.followUpNote} onChange={(e) => set("followUpNote", e.target.value)} placeholder="Call about orientation" />
          </Field>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <span>Documents</span>
          <div className="list" style={{ gap: 6 }}>
            {DOCS.map((x) => (
              <DocRow key={x.key} k={x.key} label={x.label} doc={d.docs[x.key]} onChange={setDoc} onBusy={onBusy} />
            ))}
          </div>
        </div>
        <div className="dialog-foot">
          {driver && (
            <ConfirmButton
              label="Delete"
              confirmLabel="Click again to delete"
              onConfirm={() => {
                deleteDriver(driver.id);
                onClose();
              }}
            />
          )}
          <div className="right">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy > 0}>
              Save driver
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
