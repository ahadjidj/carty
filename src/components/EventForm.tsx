import { FormEvent, useState } from "react";
import { Grant } from "../types";
import { todayISO, uid } from "../utils";

export type EventKind = "VESTING" | "EXERCISE" | "SALE";

interface Props {
  kind: EventKind;
  grants: Grant[];
  defaultGrantId?: string;
  defaultFxRate: number;
  defaultFmvUSD?: number;
  onCancel: () => void;
  onSubmit: (payload: EventPayload) => void;
}

export interface EventPayload {
  id: string;
  grantId: string;
  date: string;
  quantity: number;
  priceUSD: number;
  fxRate: number;
  fees?: number;
}

export function EventForm({
  kind,
  grants,
  defaultGrantId,
  defaultFxRate,
  defaultFmvUSD,
  onCancel,
  onSubmit,
}: Props) {
  const usable = grants.filter((g) =>
    kind === "EXERCISE" ? g.type === "STOCK_OPTION" : true,
  );

  const [grantId, setGrantId] = useState(defaultGrantId ?? usable[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [quantity, setQuantity] = useState("");
  const [priceUSD, setPriceUSD] = useState(
    defaultFmvUSD != null ? String(defaultFmvUSD) : "",
  );
  const [fxRate, setFxRate] = useState(String(defaultFxRate));
  const [fees, setFees] = useState("");

  const priceLabel =
    kind === "SALE"
      ? "Sale price per share (USD)"
      : "FMV per share (USD)";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!grantId) return;
    onSubmit({
      id: uid(),
      grantId,
      date,
      quantity: parseFloat(quantity) || 0,
      priceUSD: parseFloat(priceUSD) || 0,
      fxRate: parseFloat(fxRate) || 0,
      fees: fees ? parseFloat(fees) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Grant</label>
          <select
            className="input"
            value={grantId}
            onChange={(e) => setGrantId(e.target.value)}
            required
          >
            {usable.map((g) => (
              <option key={g.id} value={g.id}>
                {g.symbol} — {g.type}
                {g.strikeUSD != null ? ` (strike $${g.strikeUSD})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input
            type="number"
            step="any"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{priceLabel}</label>
          <input
            type="number"
            step="any"
            className="input"
            value={priceUSD}
            onChange={(e) => setPriceUSD(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">FX rate (EUR per USD)</label>
          <input
            type="number"
            step="any"
            className="input"
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
            required
          />
        </div>
        {kind === "SALE" && (
          <div className="col-span-2">
            <label className="label">Fees (EUR, optional)</label>
            <input
              type="number"
              step="any"
              className="input"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Record {kind.toLowerCase()}
        </button>
      </div>
    </form>
  );
}
