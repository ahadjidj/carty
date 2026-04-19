import { useMemo, useState } from "react";
import { useStore } from "../store";
import { simulate } from "../tax";
import { fmtEUR, fmtPct, fmtQty, fmtUSD } from "../utils";

export function Simulator() {
  const { state, updateSettings } = useStore();
  const [price, setPrice] = useState(
    state.settings.currentStockPriceUSD > 0
      ? String(state.settings.currentStockPriceUSD)
      : "",
  );
  const [fx, setFx] = useState(String(state.settings.currentFxRate));

  const priceNum = parseFloat(price) || 0;
  const fxNum = parseFloat(fx) || 0;

  const sim = useMemo(
    () => simulate(state, priceNum, fxNum),
    [state, priceNum, fxNum],
  );

  const baseline = state.settings.currentStockPriceUSD;
  const baselineSim = useMemo(
    () =>
      baseline > 0
        ? simulate(state, baseline, state.settings.currentFxRate)
        : null,
    [state, baseline],
  );

  const scenarios = baseline > 0 ? [0.5, 0.75, 1, 1.5, 2, 3] : [];

  const save = () =>
    updateSettings({ currentStockPriceUSD: priceNum, currentFxRate: fxNum });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Simulator</h2>
        <p className="text-sm text-slate-500">
          Project the gross and net value of your entire position under a given
          stock price and FX rate. Unvested RSUs are treated as if they vest now
          at the assumed FMV; unexercised options are treated as if exercised
          now at that FMV.
        </p>
      </div>

      <div className="card card-body space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Assumed stock price (USD)</label>
            <input
              className="input"
              type="number"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Assumed FX (EUR per USD)</label>
            <input
              className="input"
              type="number"
              step="any"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={save}>
              Save as current
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Gross" value={fmtEUR(sim.grossEUR)} sub={fmtUSD(sim.grossUSD)} />
        <Kpi
          label="Acq. gain tax"
          value={fmtEUR(sim.taxAcqEUR)}
          sub={`on ${fmtEUR(sim.acqGainTotalEUR)}`}
        />
        <Kpi
          label="Capital gain tax"
          value={fmtEUR(sim.taxCapEUR)}
          sub={`on ${fmtEUR(sim.capGainTotalEUR)}`}
        />
        <Kpi
          label="Net"
          value={fmtEUR(sim.netEUR)}
          sub={
            sim.grossEUR > 0
              ? `${fmtPct(sim.netEUR / sim.grossEUR)} of gross`
              : ""
          }
          highlight
        />
      </div>

      {sim.taxDetails.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">Breakdown by grant</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Grant</th>
                  <th>Source</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Acq. gain</th>
                  <th className="text-right">Cap. gain</th>
                  <th className="text-right">Exercise cost</th>
                </tr>
              </thead>
              <tbody>
                {sim.taxDetails.map((d, i) => (
                  <tr key={i}>
                    <td>{d.grantLabel}</td>
                    <td className="text-slate-500">
                      {sourceLabel(d.source)}
                    </td>
                    <td className="text-right">{fmtQty(d.quantity)}</td>
                    <td className="text-right">{fmtEUR(d.acqGainEUR)}</td>
                    <td className="text-right">{fmtEUR(d.capGainEUR)}</td>
                    <td className="text-right">
                      {fmtEUR(d.costToExerciseEUR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {baselineSim && scenarios.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">
              Scenarios (relative to {fmtUSD(baseline)})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Multiplier</th>
                  <th className="text-right">Assumed price</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Taxes</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((m) => {
                  const p = baseline * m;
                  const s = simulate(state, p, state.settings.currentFxRate);
                  return (
                    <tr key={m} className={m === 1 ? "bg-brand-50/40" : ""}>
                      <td className="font-medium">×{m}</td>
                      <td className="text-right">{fmtUSD(p)}</td>
                      <td className="text-right">{fmtEUR(s.grossEUR)}</td>
                      <td className="text-right">
                        {fmtEUR(s.taxAcqEUR + s.taxCapEUR)}
                      </td>
                      <td className="text-right font-medium">
                        {fmtEUR(s.netEUR)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function sourceLabel(s: string) {
  if (s === "HELD") return "Held shares";
  if (s === "UNEXERCISED_OPTION") return "Options to exercise";
  if (s === "UNVESTED_RSU") return "Unvested RSU";
  return s;
}

function Kpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "kpi " + (highlight ? "ring-2 ring-brand-500 bg-brand-50/30" : "")
      }
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
