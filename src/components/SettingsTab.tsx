import { useRef, useState } from "react";
import { useStore } from "../store";
import { Settings } from "../types";

export function SettingsTab() {
  const store = useStore();
  const { state, updateSettings, resetAll, importState } = store;
  const [draft, setDraft] = useState<Settings>(state.settings);
  const fileRef = useRef<HTMLInputElement>(null);
  const sqliteRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carty-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doExportSqlite = () => {
    const bytes = store.exportDatabase();
    const buf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carty-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (f: File) => {
    try {
      const text = await f.text();
      importState(text);
      alert("Imported.");
    } catch (e) {
      alert("Import failed: " + (e as Error).message);
    }
  };

  const doImportSqlite = async (f: File) => {
    if (
      !confirm(
        "Replace the current database with this SQLite file? Your local data will be overwritten.",
      )
    )
      return;
    try {
      const buf = await f.arrayBuffer();
      await store.replaceDatabase(new Uint8Array(buf));
      alert("Database replaced.");
    } catch (e) {
      alert("Restore failed: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-slate-500">
          These values drive simulation and tax estimations. Defaults assume
          a French resident with a 45% marginal rate and the post-Macron RSU
          regime (AGA 2015+).
        </p>
      </div>

      <div className="card card-body space-y-4">
        <div>
          <h3 className="font-medium mb-2">Current market assumption</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumberField
              label="Current stock price (USD)"
              value={draft.currentStockPriceUSD}
              onChange={(v) => set("currentStockPriceUSD", v)}
            />
            <NumberField
              label="Current FX (EUR per USD)"
              value={draft.currentFxRate}
              step={0.0001}
              onChange={(v) => set("currentFxRate", v)}
            />
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">Tax parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumberField
              label="Marginal IR rate"
              value={draft.marginalIRRate}
              step={0.01}
              hint="e.g. 0.45 for 45%"
              onChange={(v) => set("marginalIRRate", v)}
            />
            <NumberField
              label="Social charges on salary (CSG/CRDS)"
              value={draft.socialChargesSalary}
              step={0.001}
              hint="default 0.097 (9.7%)"
              onChange={(v) => set("socialChargesSalary", v)}
            />
            <NumberField
              label="Social charges on RSU acq. gain"
              value={draft.socialChargesRSUAcq}
              step={0.001}
              hint="default 0.172 (17.2%)"
              onChange={(v) => set("socialChargesRSUAcq", v)}
            />
            <NumberField
              label="PFU — IR part"
              value={draft.pfuIR}
              step={0.001}
              hint="default 0.128 (12.8%)"
              onChange={(v) => set("pfuIR", v)}
            />
            <NumberField
              label="PFU — Social part"
              value={draft.pfuSocial}
              step={0.001}
              hint="default 0.172 (17.2%)"
              onChange={(v) => set("pfuSocial", v)}
            />
            <NumberField
              label="RSU lifetime abatement threshold (EUR)"
              value={draft.rsuAbatementThreshold}
              step={1000}
              hint="default 300 000 €"
              onChange={(v) => set("rsuAbatementThreshold", v)}
            />
            <NumberField
              label="RSU threshold already used (EUR)"
              value={draft.rsuLifetimeAcqUsed}
              step={1000}
              hint="accumulated on past grants not captured here"
              onChange={(v) => set("rsuLifetimeAcqUsed", v)}
            />
            <NumberField
              label="Default FX (fallback)"
              value={draft.defaultFxRate}
              step={0.0001}
              onChange={(v) => set("defaultFxRate", v)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save}>
            Save settings
          </button>
          {saved && (
            <span className="text-sm text-emerald-600">Saved ✓</span>
          )}
        </div>
      </div>

      <div className="card card-body space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Data management</h3>
          <span className="tag bg-slate-100 text-slate-600">
            Backend: SQLite (WASM) in IndexedDB
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={doExportSqlite}>
            Download .sqlite
          </button>
          <button
            className="btn-ghost"
            onClick={() => sqliteRef.current?.click()}
          >
            Restore .sqlite
          </button>
          <button className="btn-ghost" onClick={doExport}>
            Export JSON
          </button>
          <button
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={sqliteRef}
            type="file"
            accept=".sqlite,.db,application/x-sqlite3,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImportSqlite(f);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn-danger"
            onClick={() => {
              if (
                confirm(
                  "Wipe all local data? This cannot be undone — consider exporting first.",
                )
              ) {
                resetAll();
              }
            }}
          >
            Wipe all data
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Your data lives in a real SQLite database, stored as a binary snapshot
          in this browser's IndexedDB. Nothing leaves the device. The{" "}
          <code>.sqlite</code> export opens in any SQLite tool.
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step={step ?? "any"}
        className="input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
