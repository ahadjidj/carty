import { useMemo } from "react";
import { useStore } from "../store";
import {
  computeRealizedSales,
  summarizeRealized,
  taxCapitalGain,
  taxOptionAcquisitionGain,
  taxRSUAcquisitionGain,
  usedRSUAbatement,
} from "../tax";
import { fmtDate, fmtEUR, fmtPct, fmtQty } from "../utils";

export function TaxTab() {
  const { state } = useStore();
  const realized = useMemo(() => computeRealizedSales(state), [state]);
  const summary = summarizeRealized(state);
  const used = usedRSUAbatement(state);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Taxes (French regime)</h2>
        <p className="text-sm text-slate-500">
          RSU acquisition gain: 50% abatement on IR up to €
          {state.settings.rsuAbatementThreshold.toLocaleString("fr-FR")}{" "}
          lifetime, then full marginal rate. Capital gain: PFU 30% (12.8% IR +
          17.2% social). Option exercise gain: salary + 9.7% CSG/CRDS. Adjust
          rates in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Realized gross" value={fmtEUR(summary.realizedGrossEUR)} />
        <Kpi
          label="Realized acq. gain"
          value={fmtEUR(summary.realizedAcqGainEUR)}
        />
        <Kpi
          label="Realized capital gain"
          value={fmtEUR(summary.realizedCapGainEUR)}
        />
        <Kpi
          label="Realized taxes"
          value={fmtEUR(summary.realizedTaxEUR)}
          sub={
            summary.realizedGrossEUR > 0
              ? `${fmtPct(summary.realizedTaxEUR / summary.realizedGrossEUR)} of gross`
              : ""
          }
        />
      </div>

      <div className="card card-body">
        <div className="font-medium mb-2">RSU lifetime abatement usage</div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{
              width: `${Math.min(100, (used / state.settings.rsuAbatementThreshold) * 100)}%`,
            }}
          />
        </div>
        <div className="text-xs text-slate-500 mt-2">
          {fmtEUR(used)} used of {fmtEUR(state.settings.rsuAbatementThreshold)}
        </div>
      </div>

      {Object.keys(summary.byYear).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">By fiscal year</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Acq. gain</th>
                  <th className="text-right">Cap. gain</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.byYear)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([year, e]) => (
                    <tr key={year}>
                      <td className="font-medium">{year}</td>
                      <td className="text-right">{fmtEUR(e.grossEUR)}</td>
                      <td className="text-right">{fmtEUR(e.acqGainEUR)}</td>
                      <td className="text-right">{fmtEUR(e.capGainEUR)}</td>
                      <td className="text-right">{fmtEUR(e.taxEUR)}</td>
                      <td className="text-right font-medium">
                        {fmtEUR(e.grossEUR - e.taxEUR)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {realized.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">Per-sale breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Grant</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Acq. gain</th>
                  <th className="text-right">Acq. tax</th>
                  <th className="text-right">Cap. gain</th>
                  <th className="text-right">Cap. tax</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rsuUsed = state.settings.rsuLifetimeAcqUsed;
                  return realized.map((r) => {
                    const acqTax =
                      r.grant.type === "RSU"
                        ? taxRSUAcquisitionGain(
                            r.acqGainEUR,
                            state.settings,
                            rsuUsed,
                          )
                        : taxOptionAcquisitionGain(r.acqGainEUR, state.settings);
                    if (r.grant.type === "RSU")
                      rsuUsed += Math.max(0, r.acqGainEUR);
                    const capTax = taxCapitalGain(
                      r.capitalGainEUR,
                      state.settings,
                    );
                    const net =
                      r.grossProceedsEUR - acqTax.total - capTax.total;
                    return (
                      <tr key={r.sale.id}>
                        <td>{fmtDate(r.sale.date)}</td>
                        <td>
                          {r.grant.symbol}{" "}
                          <span className="text-slate-500 text-xs">
                            ({r.grant.type})
                          </span>
                        </td>
                        <td className="text-right">{fmtQty(r.sale.quantity)}</td>
                        <td className="text-right">
                          {fmtEUR(r.grossProceedsEUR)}
                        </td>
                        <td className="text-right">{fmtEUR(r.acqGainEUR)}</td>
                        <td className="text-right">{fmtEUR(acqTax.total)}</td>
                        <td className="text-right">
                          {fmtEUR(r.capitalGainEUR)}
                        </td>
                        <td className="text-right">{fmtEUR(capTax.total)}</td>
                        <td className="text-right font-medium">
                          {fmtEUR(net)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {realized.length === 0 && (
        <div className="card card-body text-center text-slate-500 py-12">
          No sales recorded yet — once you record a sale, tax details will
          appear here.
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
