"use client";
import { useRef, useState } from "react";
import { ImagePlus, Truck as TruckIcon, X } from "lucide-react";
import type { AppState, Crew, PayStructure, Truck, TruckStatus } from "@/lib/types";
import { resizePhoto } from "@/lib/logic";
import { deleteTruck, saveTruck } from "@/lib/actions";
import { uid } from "@/lib/seed";
import { ConfirmButton, Field, Modal, Seg, SW } from "./ui";
import { Select } from "./controls";

const PAY: PayStructure[] = ["Per mile", "Percentage", "Weekly guarantee", "Hourly"];

const blank = (): Truck => ({
  id: uid("t"), number: "", year: String(new Date().getFullYear()), model: "", location: "", crew: "Solo",
  payRate: "", payStructure: "Per mile", status: "available", photo: null, openedAt: new Date().toISOString(), driverName: "",
});

export default function TruckDialog({ state, truck, onClose }: { state: AppState; truck: Truck | null; onClose: () => void }) {
  const [t, setT] = useState<Truck>(() => truck ?? blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Truck>(k: K, v: Truck[K]) => setT((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!t.number.trim()) err.number = "Truck number is required";
    else if (state.trucks.some((x) => x.id !== t.id && x.number.trim().toLowerCase() === t.number.trim().toLowerCase()))
      err.number = "That number is already used";
    if (!/^\d{4}$/.test(t.year.trim())) err.year = "Use a 4-digit year";
    if (!t.model.trim()) err.model = "Make & model is required";
    if (!/^.+,\s*[A-Za-z]{2}$/.test(t.location.trim())) err.location = "Use “City, ST”";
    if (!t.payRate.trim()) err.payRate = "Driver pay is required";
    setErrors(err);
    if (Object.keys(err).length) return;
    saveTruck({ ...t, number: t.number.trim(), model: t.model.trim(), location: t.location.trim(), payRate: t.payRate.trim(), driverName: t.driverName.trim() });
    onClose();
  };

  const onPhoto = async (f?: File) => {
    if (!f) return;
    set("photo", await resizePhoto(f));
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <h2>
          <TruckIcon size={28} strokeWidth={SW} /> {truck ? `Edit ${truck.number}` : "Add truck"}
        </h2>
        <div className="grid3">
          <Field label="Truck number" error={errors.number}>
            <input className={`input ${errors.number ? "err" : ""}`} value={t.number} onChange={(e) => set("number", e.target.value)} placeholder="RX-150" autoFocus />
          </Field>
          <Field label="Year" error={errors.year}>
            <input className={`input ${errors.year ? "err" : ""}`} value={t.year} onChange={(e) => set("year", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Make & model" error={errors.model}>
            <input className={`input ${errors.model ? "err" : ""}`} value={t.model} onChange={(e) => set("model", e.target.value)} placeholder="Freightliner Cascadia" />
          </Field>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          <Field label="Location" error={errors.location}>
            <input className={`input ${errors.location ? "err" : ""}`} value={t.location} onChange={(e) => set("location", e.target.value)} placeholder="Dallas, TX" />
          </Field>
          <Field label="Driver pay" error={errors.payRate}>
            <input className={`input ${errors.payRate ? "err" : ""}`} value={t.payRate} onChange={(e) => set("payRate", e.target.value)} placeholder="$0.68 / mile" />
          </Field>
          <Field label="Pay structure" group>
            <Select<PayStructure> value={t.payStructure} onChange={(v) => set("payStructure", v)} options={PAY.map((p) => ({ value: p, label: p }))} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16 }}>
          <div className="field">
            <span>Crew</span>
            <Seg<Crew> value={t.crew} onChange={(v) => set("crew", v)} options={[{ value: "Solo", label: "Solo" }, { value: "Team", label: "Team" }]} />
          </div>
          <div className="field">
            <span>Status</span>
            <Seg<TruckStatus>
              value={t.status}
              onChange={(v) => set("status", v)}
              options={[
                { value: "available", label: "Available" },
                { value: "reserved", label: "Reserved" },
                { value: "in_service", label: "In service" },
              ]}
            />
          </div>
        </div>
        {t.status !== "available" && (
          <Field label="Assigned driver" className="full">
            <input className="input" style={{ marginTop: 0 }} list="driver-names" value={t.driverName} onChange={(e) => set("driverName", e.target.value)} placeholder="Driver name" />
            <datalist id="driver-names">
              {state.drivers.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </Field>
        )}
        <div className="field" style={{ marginTop: 16 }}>
          <span>Photo</span>
          <div className="photo-box">
            <div className="pv">{t.photo ? <img className="photo" src={t.photo} alt="" /> : <TruckIcon size={36} strokeWidth={SW} />}</div>
            <button type="button" className="btn sm alt" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={14} strokeWidth={SW} /> {t.photo ? "Replace" : "Upload"}
            </button>
            {t.photo && (
              <button type="button" className="btn sm" onClick={() => set("photo", null)}>
                <X size={14} strokeWidth={SW} /> Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </div>
        </div>
        <div className="dialog-foot">
          {truck && (
            <ConfirmButton
              label="Delete"
              confirmLabel="Click again to delete"
              onConfirm={() => {
                deleteTruck(truck.id);
                onClose();
              }}
            />
          )}
          <div className="right">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save truck
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
