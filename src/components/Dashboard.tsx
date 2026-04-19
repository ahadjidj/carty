import { useMemo } from "react";
import { useStore } from "../store";
import {
  simulate,
  summarizePositions,
  summarizeRealized,
  usedRSUAbatement,
} from "../tax";
import { fmtEUR, fmtPct, fmtQty, fmtUSD } from "../utils";

export function Dashboard() {
  const { state } = useStore();
  const positions = summarizePositions(state);
  const used = usedRSUAbatement(state);
  const realized = summarizeRealized(state);

  const sim = useMemo(
    () =>
      simulate(
        state,
        state.settings.currentStockPriceUSD,
        state.settings.currentFxRate,
      ),
    [state],
  );

  const aggregates = positions.reduce(
    (a, p) => {
      a.granted += p.quantityGranted;
      a.vested += p.quantityVested;
      a.sold += p.quantitySold;
      a.held += p.quantityHeld;
      a.unvested += p.quantityUnvested;
      return a;
    },
    { granted: 0, vested: 0, sold: 0, held: 0, unvested: 0 },
  );

  const hasPrice = state.settings.currentStockPriceUSD > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-slate-500">
          Current assumption:{" "}
          {hasPrice
            ? `${fmtUSD(state.settings.currentStockPriceUSD)} per share, FX ${state.settings.currentFxRate.toFixed(4)}`
            : "no stock price set — configure it in Settings to see values."}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Granted"
          value={fmtQty(aggregates.granted)}
          sub={`${state.grants.length} grant(s)`}
        />
        <Kpi label="Vested" value={fmtQty(aggregates.vested)} />
        <Kpi label="Held" value={fmtQty(aggregates.held)} />
        <Kpi label="Sold" value={fmtQty(aggregates.sold)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi
          label="Gross value"
          value={hasPrice ? fmtEUR(sim.grossEUR) : "—"}
          sub={hasPrice ? fmtUSD(sim.grossUSD) + " at assumed price" : ""}
        />
        <Kpi
          label="Exercise cost"
          value={hasPrice ? fmtEUR(sim.exerciseCostEUR) : "—"}
          sub="cash outflow for unexercised options"
        />
        <Kpi
          label="Estimated taxes"
          value={
            hasPrice ? fmtEUR(sim.taxAcqEUR + sim.taxCapEUR) : "—"
          }
          sub={
            hasPrice
              ? `acq ${fmtEUR(sim.taxAcqEUR)} + cap ${fmtEUR(sim.taxCapEUR)}`
              : ""
          }
        />
        <Kpi
          label="Net proceeds"
          value={hasPrice ? fmtEUR(sim.netEUR) : "—"}
          sub={
            hasPrice && sim.grossEUR > 0
              ? `net/gross = ${fmtPct(sim.netEUR / sim.grossEUR)}`
              : ""
          }
          highlight
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi
          label="RSU acq. gain used (lifetime)"
          value={fmtEUR(used)}
          sub={`of ${fmtEUR(state.settings.rsuAbatementThreshold)} threshold`}
        />
        <Kpi
          label="Realized net (so far)"
          value={fmtEUR(realized.realizedNetEUR)}
          sub={`${fmtEUR(realized.realizedGrossEUR)} gross − ${fmtEUR(realized.realizedTaxEUR)} tax`}
        />
        <Kpi
          label="Realized gains"
          value={fmtEUR(
            realized.realizedAcqGainEUR + realized.realizedCapGainEUR,
          )}
          sub={`acq ${fmtEUR(realized.realizedAcqGainEUR)} + cap ${fmtEUR(realized.realizedCapGainEUR)}`}
        />
      </div>

      {positions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-medium">Per-grant position</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Grant</th>
                  <th className="text-right">Granted</th>
                  <th className="text-right">Vested</th>
                  <th className="text-right">Held</th>
                  <th className="text-right">Sold</th>
                  <th className="text-right">Unvested</th>
                  <th className="text-right">Value (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const q =
                    p.grant.type === "RSU"
                      ? p.quantityHeld + p.quantityUnvested
                      : p.quantityHeld + p.quantityUnvested;
                  const value = hasPrice
                    ? q *
                      state.settings.currentStockPriceUSD *
                      state.settings.currentFxRate
                    : 0;
                  return (
                    <tr key={p.grantId}>
                      <td className="font-medium">
                        {p.grant.symbol}{" "}
                        <span className="text-slate-500 text-xs">
                          ({p.grant.type})
                        </span>
                      </td>
                      <td className="text-right">
                        {fmtQty(p.quantityGranted)}
                      </td>
                      <td className="text-right">{fmtQty(p.quantityVested)}</td>
                      <td className="text-right">{fmtQty(p.quantityHeld)}</td>
                      <td className="text-right">{fmtQty(p.quantitySold)}</td>
                      <td className="text-right">
                        {fmtQty(p.quantityUnvested)}
                      </td>
                      <td className="text-right">
                        {hasPrice ? fmtEUR(value) : "—"}
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
