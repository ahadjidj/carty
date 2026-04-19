import { useState } from "react";
import { useStore } from "../store";
import { summarizePositions } from "../tax";
import { fmtDate, fmtEUR, fmtQty, fmtUSD } from "../utils";
import { GrantForm } from "./GrantForm";
import { Modal } from "./Modal";
import { Grant } from "../types";

export function GrantsTab() {
  const store = useStore();
  const { state } = store;
  const [editing, setEditing] = useState<Grant | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Grant | null>(null);

  const positions = summarizePositions(state);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Grants</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + Add grant
        </button>
      </div>

      {state.grants.length === 0 ? (
        <div className="card card-body text-center text-slate-500 py-12">
          No grants yet. Click "Add grant" to get started.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Granted on</th>
                <th className="text-right">Total</th>
                <th className="text-right">Vested</th>
                <th className="text-right">Exercised</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Held</th>
                <th className="text-right">Strike</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.grants.map((g) => {
                const p = positions.find((x) => x.grantId === g.id)!;
                return (
                  <tr key={g.id}>
                    <td className="font-medium">{g.symbol}</td>
                    <td>
                      <span
                        className={
                          "tag " +
                          (g.type === "RSU"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-indigo-100 text-indigo-700")
                        }
                      >
                        {g.type === "RSU" ? "RSU" : "OPTION"}
                      </span>
                    </td>
                    <td>{fmtDate(g.grantDate)}</td>
                    <td className="text-right">{fmtQty(p.quantityGranted)}</td>
                    <td className="text-right">{fmtQty(p.quantityVested)}</td>
                    <td className="text-right">
                      {g.type === "STOCK_OPTION"
                        ? fmtQty(p.quantityExercised)
                        : "—"}
                    </td>
                    <td className="text-right">{fmtQty(p.quantitySold)}</td>
                    <td className="text-right">{fmtQty(p.quantityHeld)}</td>
                    <td className="text-right">
                      {g.strikeUSD != null ? fmtUSD(g.strikeUSD) : "—"}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          className="btn-ghost"
                          onClick={() => setViewing(g)}
                        >
                          View
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => setEditing(g)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => {
                            if (confirm("Delete this grant and all its events?"))
                              store.deleteGrant(g.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add grant"
      >
        <GrantForm
          onCancel={() => setCreating(false)}
          onSubmit={(g) => {
            store.addGrant(g);
            setCreating(false);
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit grant — ${editing.symbol}` : ""}
      >
        {editing && (
          <GrantForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(g) => {
              store.updateGrant(g.id, g);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.symbol} — ${viewing.type}` : ""}
      >
        {viewing && <GrantDetail grant={viewing} />}
      </Modal>
    </div>
  );
}

function GrantDetail({ grant }: { grant: Grant }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Grant date" value={fmtDate(grant.grantDate)} />
        <Field label="Total quantity" value={fmtQty(grant.totalQuantity)} />
        {grant.strikeUSD != null && (
          <Field label="Strike (USD)" value={fmtUSD(grant.strikeUSD)} />
        )}
        {grant.fmvAtGrantUSD != null && (
          <Field
            label="FMV at grant (USD)"
            value={fmtUSD(grant.fmvAtGrantUSD)}
          />
        )}
        {grant.fxAtGrant != null && (
          <Field label="FX at grant" value={String(grant.fxAtGrant)} />
        )}
        {grant.strikeUSD != null && grant.fxAtGrant != null && (
          <Field
            label="Strike (EUR at grant FX)"
            value={fmtEUR(grant.strikeUSD * grant.fxAtGrant)}
          />
        )}
      </div>
      {grant.notes && (
        <div>
          <div className="label">Notes</div>
          <div className="bg-slate-50 rounded-lg p-2 whitespace-pre-wrap">
            {grant.notes}
          </div>
        </div>
      )}
      <div>
        <div className="label">Vesting schedule</div>
        {grant.vestingSchedule.length === 0 ? (
          <div className="text-slate-500 italic">None defined</div>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {grant.vestingSchedule.map((t, i) => (
                  <tr key={i}>
                    <td>{fmtDate(t.date)}</td>
                    <td className="text-right">{fmtQty(t.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  );
}
