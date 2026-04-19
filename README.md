# Carty — Stock Options & RSU Manager (French tax)

Local-first, client-only web app to manage US-denominated stock grants (RSUs
and stock options) as a French tax resident. All data stays in your browser
(`localStorage`); no server, no tracking.

## What it does

- **Grants**: record RSU or option grants with grant date, total quantity,
  strike price (for options), optional FMV at grant, optional FX at grant,
  vesting schedule (manual, or auto-generated 1-year cliff + 3 years monthly),
  and notes.
- **Events**: record real vestings, exercises, and sales. Every event stores
  its own **FX rate** and **FMV / sale price (USD)** since these change per
  event.
- **Dashboard**: positions per grant, total granted / vested / held / sold,
  gross and net EUR value at the current assumed stock price + FX, estimated
  taxes, and realized gains to date.
- **Simulator**: project the gross and net outcome at an arbitrary stock price
  and FX rate; includes ready-made ×0.5 / ×0.75 / ×1 / ×1.5 / ×2 / ×3 scenarios.
- **Taxes**: per-sale and per-year breakdown of acquisition-gain tax and
  capital-gain tax (PFU 30%), plus a progress bar for the lifetime 50%
  abatement on RSU acquisition gains (€300k threshold, configurable).
- **Settings**: override every tax rate (marginal IR, CSG/CRDS, PFU split,
  abatement threshold), plus export / import / wipe of all data.

## French tax model (simplified)

- **RSU acquisition gain** (AGA plans, post-Macron law 08/2015+):
  - Up to €300,000 *lifetime*: IR on 50% of the gain at your marginal rate
    + 17.2% social contributions on the full amount.
  - Above €300,000: taxed as salary at full marginal rate + 9.7% CSG/CRDS.
  - The threshold consumption is tracked across recorded sales (plus a manual
    offset for past grants that predate your usage of Carty).
- **Stock option exercise gain** (non-qualified plans, post-2012):
  - Taxed as salary at marginal rate + 9.7% social charges.
- **Capital gain on sale**:
  - PFU flat tax 30% = 12.8% IR + 17.2% social contributions.
  - Net losses are not taxed.

Tax parameters are editable in **Settings** so you can align to your real
bracket or legislative changes.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Zero backend, data persisted in `localStorage`

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run typecheck
```

## Caveats

This is an estimation tool. Real French taxation depends on the specific plan
qualification, your residency and its history, holding periods, and year-on-
year thresholds. Always double-check with a tax advisor before acting.
