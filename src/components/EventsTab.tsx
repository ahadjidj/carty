import { useState } from "react";
import { useStore } from "../store";
import { fmtDate, fmtEUR, fmtQty, fmtUSD } from "../utils";
import { Modal } from "./Modal";
import { EventForm, EventKind } from "./EventForm";

export function EventsTab() {
  const store = useStore();
  const { state } = store;
  const [mode, setMode] = useState<EventKind | null>(null);

  const grantLabel = (id: string) => {
    const g = state.grants.find((x) => x.id === id);
    return g ? `${g.symbol} (${g.type})` : id;
  };

  const vestings = [...state.vestings].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const exercises = [...state.exercises].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const sales = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Events</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => setMode("VESTING")}
            disabled={state.grants.length === 0}
          >
            + Record vesting
          </button>
          <button
            className="btn-primary"
            onClick={() => setMode("EXERCISE")}
            disabled={
              state.grants.filter((g) => g.type === "STOCK_OPTION").length === 0
            }
          >
            + Record exercise
          </button>
          <button
            className="btn-primary"
            onClick={() => setMode("SALE")}
            disabled={state.grants.length === 0}
          >
            + Record sale
          </button>
        </div>
      </div>

      <Section
        title={`Vestings (${vestings.length})`}
        empty="No vesting events recorded."
        isEmpty={vestings.length === 0}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Grant</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">FMV (USD)</th>
              <th className="text-right">FX</th>
              <th className="text-right">Gross (EUR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vestings.map((v) => (
              <tr key={v.id}>
                <td>{fmtDate(v.date)}</td>
                <td>{grantLabel(v.grantId)}</td>
                <td className="text-right">{fmtQty(v.quantity)}</td>
                <td className="text-right">{fmtUSD(v.fmvUSD)}</td>
                <td className="text-right">{v.fxRate.toFixed(4)}</td>
                <td className="text-right">
                  {fmtEUR(v.quantity * v.fmvUSD * v.fxRate)}
                </td>
                <td className="text-right">
                  <button
                    className="btn-danger"
                    onClick={() =>
                      confirm("Delete this vesting?") &&
                      store.deleteVesting(v.id)
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title={`Exercises (${exercises.length})`}
        empty="No exercises recorded."
        isEmpty={exercises.length === 0}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Grant</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">FMV (USD)</th>
              <th className="text-right">FX</th>
              <th className="text-right">Gain (EUR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((e) => {
              const g = state.grants.find((x) => x.id === e.grantId);
              const strike = g?.strikeUSD ?? 0;
              const gain = e.quantity * Math.max(0, e.fmvUSD - strike) * e.fxRate;
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{grantLabel(e.grantId)}</td>
                  <td className="text-right">{fmtQty(e.quantity)}</td>
                  <td className="text-right">{fmtUSD(e.fmvUSD)}</td>
                  <td className="text-right">{e.fxRate.toFixed(4)}</td>
                  <td className="text-right">{fmtEUR(gain)}</td>
                  <td className="text-right">
                    <button
                      className="btn-danger"
                      onClick={() =>
                        confirm("Delete this exercise?") &&
                        store.deleteExercise(e.id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section
        title={`Sales (${sales.length})`}
        empty="No sales recorded."
        isEmpty={sales.length === 0}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Grant</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Price (USD)</th>
              <th className="text-right">FX</th>
              <th className="text-right">Gross (EUR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((x) => (
              <tr key={x.id}>
                <td>{fmtDate(x.date)}</td>
                <td>{grantLabel(x.grantId)}</td>
                <td className="text-right">{fmtQty(x.quantity)}</td>
                <td className="text-right">{fmtUSD(x.salePriceUSD)}</td>
                <td className="text-right">{x.fxRate.toFixed(4)}</td>
                <td className="text-right">
                  {fmtEUR(
                    x.quantity * x.salePriceUSD * x.fxRate - (x.fees ?? 0),
                  )}
                </td>
                <td className="text-right">
                  <button
                    className="btn-danger"
                    onClick={() =>
                      confirm("Delete this sale?") && store.deleteSale(x.id)
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Modal
        open={mode === "VESTING"}
        onClose={() => setMode(null)}
        title="Record vesting"
      >
        <EventForm
          kind="VESTING"
          grants={state.grants}
          defaultFxRate={state.settings.currentFxRate}
          defaultFmvUSD={state.settings.currentStockPriceUSD || undefined}
          onCancel={() => setMode(null)}
          onSubmit={(p) => {
            store.addVesting({
              id: p.id,
              grantId: p.grantId,
              date: p.date,
              quantity: p.quantity,
              fmvUSD: p.priceUSD,
              fxRate: p.fxRate,
            });
            setMode(null);
          }}
        />
      </Modal>

      <Modal
        open={mode === "EXERCISE"}
        onClose={() => setMode(null)}
        title="Record exercise"
      >
        <EventForm
          kind="EXERCISE"
          grants={state.grants}
          defaultFxRate={state.settings.currentFxRate}
          defaultFmvUSD={state.settings.currentStockPriceUSD || undefined}
          onCancel={() => setMode(null)}
          onSubmit={(p) => {
            store.addExercise({
              id: p.id,
              grantId: p.grantId,
              date: p.date,
              quantity: p.quantity,
              fmvUSD: p.priceUSD,
              fxRate: p.fxRate,
            });
            setMode(null);
          }}
        />
      </Modal>

      <Modal
        open={mode === "SALE"}
        onClose={() => setMode(null)}
        title="Record sale"
      >
        <EventForm
          kind="SALE"
          grants={state.grants}
          defaultFxRate={state.settings.currentFxRate}
          defaultFmvUSD={state.settings.currentStockPriceUSD || undefined}
          onCancel={() => setMode(null)}
          onSubmit={(p) => {
            store.addSale({
              id: p.id,
              grantId: p.grantId,
              date: p.date,
              quantity: p.quantity,
              salePriceUSD: p.priceUSD,
              fxRate: p.fxRate,
              fees: p.fees,
            });
            setMode(null);
          }}
        />
      </Modal>
    </div>
  );
}

function Section({
  title,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        {isEmpty ? (
          <div className="px-4 py-6 text-center text-slate-500">{empty}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
