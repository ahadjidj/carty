import { FormEvent, useState } from "react";
import { Grant, GrantType, PlannedVesting } from "../types";
import { uid, todayISO } from "../utils";

interface Props {
  initial?: Grant;
  onSubmit: (grant: Grant) => void;
  onCancel: () => void;
}

export function GrantForm({ initial, onSubmit, onCancel }: Props) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [type, setType] = useState<GrantType>(initial?.type ?? "RSU");
  const [grantDate, setGrantDate] = useState(initial?.grantDate ?? todayISO());
  const [totalQuantity, setTotalQuantity] = useState(
    String(initial?.totalQuantity ?? ""),
  );
  const [strikeUSD, setStrikeUSD] = useState(
    initial?.strikeUSD != null ? String(initial.strikeUSD) : "",
  );
  const [fmvAtGrantUSD, setFmvAtGrantUSD] = useState(
    initial?.fmvAtGrantUSD != null ? String(initial.fmvAtGrantUSD) : "",
  );
  const [fxAtGrant, setFxAtGrant] = useState(
    initial?.fxAtGrant != null ? String(initial.fxAtGrant) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [schedule, setSchedule] = useState<PlannedVesting[]>(
    initial?.vestingSchedule ?? [],
  );

  const addTranche = () =>
    setSchedule((s) => [...s, { date: todayISO(), quantity: 0 }]);
  const rmTranche = (i: number) =>
    setSchedule((s) => s.filter((_, idx) => idx !== i));
  const setTranche = (i: number, patch: Partial<PlannedVesting>) =>
    setSchedule((s) => s.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const generateStandard = () => {
    const q = parseFloat(totalQuantity);
    if (!q || !grantDate) return;
    const start = new Date(grantDate);
    const one = q * 0.25;
    const monthly = (q - one) / 36;
    const out: PlannedVesting[] = [];
    const cliff = new Date(start);
    cliff.setFullYear(cliff.getFullYear() + 1);
    out.push({ date: cliff.toISOString().slice(0, 10), quantity: one });
    for (let i = 1; i <= 36; i++) {
      const d = new Date(cliff);
      d.setMonth(d.getMonth() + i);
      out.push({ date: d.toISOString().slice(0, 10), quantity: monthly });
    }
    setSchedule(out);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const grant: Grant = {
      id: initial?.id ?? uid(),
      symbol: symbol.trim().toUpperCase(),
      type,
      grantDate,
      totalQuantity: parseFloat(totalQuantity) || 0,
      strikeUSD: type === "STOCK_OPTION" ? parseFloat(strikeUSD) || 0 : undefined,
      fmvAtGrantUSD: fmvAtGrantUSD ? parseFloat(fmvAtGrantUSD) : undefined,
      fxAtGrant: fxAtGrant ? parseFloat(fxAtGrant) : undefined,
      vestingSchedule: schedule
        .filter((t) => t.date && t.quantity > 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
      notes: notes.trim() || undefined,
    };
    onSubmit(grant);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Symbol</label>
          <input
            className="input"
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. ACME"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as GrantType)}
          >
            <option value="RSU">RSU</option>
            <option value="STOCK_OPTION">Stock option</option>
          </select>
        </div>
        <div>
          <label className="label">Grant date</label>
          <input
            type="date"
            className="input"
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Total quantity</label>
          <input
            type="number"
            step="any"
            className="input"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
            required
          />
        </div>
        {type === "STOCK_OPTION" && (
          <div>
            <label className="label">Strike price (USD)</label>
            <input
              type="number"
              step="any"
              className="input"
              value={strikeUSD}
              onChange={(e) => setStrikeUSD(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label className="label">FMV at grant (USD, optional)</label>
          <input
            type="number"
            step="any"
            className="input"
            value={fmvAtGrantUSD}
            onChange={(e) => setFmvAtGrantUSD(e.target.value)}
          />
        </div>
        <div>
          <label className="label">FX at grant (EUR per USD, optional)</label>
          <input
            type="number"
            step="any"
            className="input"
            value={fxAtGrant}
            onChange={(e) => setFxAtGrant(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input"
          value={notes}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-700">
            Vesting schedule
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={generateStandard}
            >
              1y cliff + 3y monthly
            </button>
            <button type="button" className="btn-ghost" onClick={addTranche}>
              + Add tranche
            </button>
          </div>
        </div>
        {schedule.length === 0 ? (
          <div className="text-sm text-slate-500 italic">
            No scheduled vesting. You can still record actual vesting events
            later.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Quantity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="date"
                        className="input"
                        value={t.date}
                        onChange={(e) =>
                          setTranche(i, { date: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        value={t.quantity}
                        onChange={(e) =>
                          setTranche(i, { quantity: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => rmTranche(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {initial ? "Save changes" : "Add grant"}
        </button>
      </div>
    </form>
  );
}
