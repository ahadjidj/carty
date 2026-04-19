import {
  AppState,
  ExerciseEvent,
  Grant,
  SaleEvent,
  Settings,
  VestingEvent,
} from "./types";

export interface ShareLot {
  grantId: string;
  grantType: Grant["type"];
  source: "VESTING" | "EXERCISE";
  sourceId: string;
  acquisitionDate: string;
  quantityInitial: number;
  quantityRemaining: number;
  /** EUR per share value of the acquisition gain that would be realized on sale. */
  acqGainPerShareEUR: number;
  /** EUR per share cost basis used for capital-gain computation. */
  costBasisPerShareEUR: number;
}

export function buildLots(state: AppState): ShareLot[] {
  const lots: ShareLot[] = [];
  const grantsById = new Map(state.grants.map((g) => [g.id, g]));

  for (const v of state.vestings) {
    const g = grantsById.get(v.grantId);
    if (!g || g.type !== "RSU") continue;
    const fmvEUR = v.fmvUSD * v.fxRate;
    lots.push({
      grantId: g.id,
      grantType: g.type,
      source: "VESTING",
      sourceId: v.id,
      acquisitionDate: v.date,
      quantityInitial: v.quantity,
      quantityRemaining: v.quantity,
      acqGainPerShareEUR: fmvEUR,
      costBasisPerShareEUR: fmvEUR,
    });
  }

  for (const e of state.exercises) {
    const g = grantsById.get(e.grantId);
    if (!g || g.type !== "STOCK_OPTION") continue;
    const fmvEUR = e.fmvUSD * e.fxRate;
    const strikeEUR = (g.strikeUSD ?? 0) * e.fxRate;
    const acqGainPerShare = Math.max(0, fmvEUR - strikeEUR);
    lots.push({
      grantId: g.id,
      grantType: g.type,
      source: "EXERCISE",
      sourceId: e.id,
      acquisitionDate: e.date,
      quantityInitial: e.quantity,
      quantityRemaining: e.quantity,
      acqGainPerShareEUR: acqGainPerShare,
      costBasisPerShareEUR: fmvEUR,
    });
  }

  lots.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));

  const salesByGrant = new Map<string, SaleEvent[]>();
  for (const s of state.sales) {
    const arr = salesByGrant.get(s.grantId) ?? [];
    arr.push(s);
    salesByGrant.set(s.grantId, arr);
  }

  for (const [, arr] of salesByGrant) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
    let remainingToSell = arr.reduce((acc, x) => acc + x.quantity, 0);
    const grantId = arr[0].grantId;
    for (const lot of lots) {
      if (remainingToSell <= 0) break;
      if (lot.grantId !== grantId) continue;
      const take = Math.min(lot.quantityRemaining, remainingToSell);
      lot.quantityRemaining -= take;
      remainingToSell -= take;
    }
  }

  return lots;
}

export interface RealizedSale {
  sale: SaleEvent;
  grant: Grant;
  acqGainEUR: number;
  capitalGainEUR: number;
  grossProceedsEUR: number;
  costBasisEUR: number;
  lotsUsed: {
    lotKey: string;
    quantity: number;
    acqGainPerShareEUR: number;
    costBasisPerShareEUR: number;
  }[];
}

export function computeRealizedSales(state: AppState): RealizedSale[] {
  const grantsById = new Map(state.grants.map((g) => [g.id, g]));
  const allLots: (ShareLot & { _available: number })[] = buildLots({
    ...state,
    sales: [],
  }).map((l) => ({ ...l, _available: l.quantityInitial }));

  const sales = [...state.sales].sort((a, b) => a.date.localeCompare(b.date));

  const out: RealizedSale[] = [];

  for (const sale of sales) {
    const grant = grantsById.get(sale.grantId);
    if (!grant) continue;

    let remaining = sale.quantity;
    let acqGain = 0;
    let capGain = 0;
    let costBasis = 0;
    const lotsUsed: RealizedSale["lotsUsed"] = [];
    const salePriceEUR = sale.salePriceUSD * sale.fxRate;
    const feesEUR = sale.fees ?? 0;

    for (const lot of allLots) {
      if (remaining <= 0) break;
      if (lot.grantId !== sale.grantId) continue;
      if (lot._available <= 0) continue;

      const take = Math.min(lot._available, remaining);
      lot._available -= take;
      remaining -= take;

      const thisAcqGain = take * lot.acqGainPerShareEUR;
      const thisCost = take * lot.costBasisPerShareEUR;
      const thisCap = take * (salePriceEUR - lot.costBasisPerShareEUR);

      acqGain += thisAcqGain;
      costBasis += thisCost;
      capGain += thisCap;

      lotsUsed.push({
        lotKey: `${lot.source}:${lot.sourceId}`,
        quantity: take,
        acqGainPerShareEUR: lot.acqGainPerShareEUR,
        costBasisPerShareEUR: lot.costBasisPerShareEUR,
      });
    }

    const grossProceedsEUR = sale.quantity * salePriceEUR - feesEUR;

    out.push({
      sale,
      grant,
      acqGainEUR: acqGain,
      capitalGainEUR: capGain - feesEUR,
      grossProceedsEUR,
      costBasisEUR: costBasis,
      lotsUsed,
    });
  }

  return out;
}

export interface TaxOnAcqGain {
  amountEUR: number;
  withinAbatement: number;
  aboveAbatement: number;
  ir: number;
  social: number;
  total: number;
  effectiveRate: number;
}

/**
 * RSU acquisition-gain taxation (post-Macron regime, AGA 08/2015+):
 *  - First €300k (lifetime, per beneficiary): IR on 50% of the gain at marginal
 *    rate + 17.2% social contributions on full amount.
 *  - Above €300k: taxed as salary (marginal rate) + 9.7% social charges.
 * The threshold consumption is tracked per call via `alreadyUsed`.
 */
export function taxRSUAcquisitionGain(
  amountEUR: number,
  settings: Settings,
  alreadyUsed: number,
): TaxOnAcqGain {
  if (amountEUR <= 0) {
    return {
      amountEUR: 0,
      withinAbatement: 0,
      aboveAbatement: 0,
      ir: 0,
      social: 0,
      total: 0,
      effectiveRate: 0,
    };
  }
  const remainingAbate = Math.max(
    0,
    settings.rsuAbatementThreshold - alreadyUsed,
  );
  const within = Math.min(amountEUR, remainingAbate);
  const above = Math.max(0, amountEUR - within);

  const irWithin = within * 0.5 * settings.marginalIRRate;
  const socialWithin = within * settings.socialChargesRSUAcq;

  const irAbove = above * settings.marginalIRRate;
  const socialAbove = above * settings.socialChargesSalary;

  const ir = irWithin + irAbove;
  const social = socialWithin + socialAbove;
  const total = ir + social;

  return {
    amountEUR,
    withinAbatement: within,
    aboveAbatement: above,
    ir,
    social,
    total,
    effectiveRate: amountEUR > 0 ? total / amountEUR : 0,
  };
}

/**
 * Stock option exercise gain (non-qualified plans, post-2012):
 *   taxed as salary at marginal rate + 9.7% social charges (CSG/CRDS).
 */
export function taxOptionAcquisitionGain(
  amountEUR: number,
  settings: Settings,
): TaxOnAcqGain {
  if (amountEUR <= 0) {
    return {
      amountEUR: 0,
      withinAbatement: 0,
      aboveAbatement: 0,
      ir: 0,
      social: 0,
      total: 0,
      effectiveRate: 0,
    };
  }
  const ir = amountEUR * settings.marginalIRRate;
  const social = amountEUR * settings.socialChargesSalary;
  const total = ir + social;
  return {
    amountEUR,
    withinAbatement: 0,
    aboveAbatement: amountEUR,
    ir,
    social,
    total,
    effectiveRate: total / amountEUR,
  };
}

export interface TaxOnCapGain {
  amountEUR: number;
  ir: number;
  social: number;
  total: number;
  effectiveRate: number;
}

/**
 * Capital gain on sale: PFU flat tax 30% (12.8% IR + 17.2% social).
 * Losses are not taxed but can offset positive gains within the year —
 * here we return 0 tax on a net loss.
 */
export function taxCapitalGain(
  amountEUR: number,
  settings: Settings,
): TaxOnCapGain {
  if (amountEUR <= 0) {
    return { amountEUR, ir: 0, social: 0, total: 0, effectiveRate: 0 };
  }
  const ir = amountEUR * settings.pfuIR;
  const social = amountEUR * settings.pfuSocial;
  return {
    amountEUR,
    ir,
    social,
    total: ir + social,
    effectiveRate: (ir + social) / amountEUR,
  };
}

export interface PositionSummary {
  grantId: string;
  grant: Grant;
  quantityGranted: number;
  quantityVested: number;
  quantityExercised: number;
  quantitySold: number;
  quantityUnvested: number;
  quantityHeld: number;
}

export function summarizePositions(state: AppState): PositionSummary[] {
  return state.grants.map((g) => {
    const vested = state.vestings
      .filter((v) => v.grantId === g.id)
      .reduce((s, v) => s + v.quantity, 0);
    const exercised = state.exercises
      .filter((e) => e.grantId === g.id)
      .reduce((s, e) => s + e.quantity, 0);
    const sold = state.sales
      .filter((x) => x.grantId === g.id)
      .reduce((s, x) => s + x.quantity, 0);

    let held = 0;
    if (g.type === "RSU") {
      held = Math.max(0, vested - sold);
    } else {
      held = Math.max(0, exercised - sold);
    }

    const quantityUnvested =
      g.type === "RSU"
        ? Math.max(0, g.totalQuantity - vested)
        : Math.max(0, g.totalQuantity - exercised - held - sold);

    return {
      grantId: g.id,
      grant: g,
      quantityGranted: g.totalQuantity,
      quantityVested: vested,
      quantityExercised: exercised,
      quantitySold: sold,
      quantityUnvested,
      quantityHeld: held,
    };
  });
}

export interface SimulationResult {
  grossUSD: number;
  grossEUR: number;
  acqGainTotalEUR: number;
  capGainTotalEUR: number;
  taxAcqEUR: number;
  taxCapEUR: number;
  exerciseCostEUR: number;
  taxDetails: {
    grantId: string;
    grantLabel: string;
    type: Grant["type"];
    source: "HELD" | "UNEXERCISED_OPTION" | "UNVESTED_RSU";
    quantity: number;
    acqGainEUR: number;
    capGainEUR: number;
    costToExerciseEUR: number;
  }[];
  netEUR: number;
}

/**
 * Simulate the net outcome of liquidating the whole unrealized position
 * at a given stock price (USD) and FX rate (EUR per USD).
 * It covers:
 *  - RSUs already vested but not sold → acq gain already crystallized at
 *    vesting, capital gain on sale vs FMV-at-vest.
 *  - Options already exercised but not sold → capital gain vs FMV-at-exercise.
 *  - Unexercised vested options → exercise at assumed price + capital gain 0.
 *  - Unvested RSUs / unexercised options → treat as if vested/exercised now
 *    at the assumed FMV; acq gain = (priceEUR - strikeEUR) for options,
 *    priceEUR for RSUs.
 */
export function simulate(
  state: AppState,
  priceUSD: number,
  fxRate: number,
): SimulationResult {
  const priceEUR = priceUSD * fxRate;
  const settings = state.settings;
  const positions = summarizePositions(state);

  const details: SimulationResult["taxDetails"] = [];

  let grossUSD = 0;
  let grossEUR = 0;
  let acqGainRSU = 0;
  let acqGainOption = 0;
  let capGain = 0;
  let exerciseCost = 0;

  const lots = buildLots(state).filter((l) => l.quantityRemaining > 0);

  for (const lot of lots) {
    const grant = state.grants.find((g) => g.id === lot.grantId);
    if (!grant) continue;
    const q = lot.quantityRemaining;
    const cap = q * (priceEUR - lot.costBasisPerShareEUR);
    capGain += cap;
    grossUSD += q * priceUSD;
    grossEUR += q * priceEUR;
    details.push({
      grantId: grant.id,
      grantLabel: `${grant.symbol} (${grant.type})`,
      type: grant.type,
      source: "HELD",
      quantity: q,
      acqGainEUR: 0,
      capGainEUR: cap,
      costToExerciseEUR: 0,
    });
  }

  for (const pos of positions) {
    const g = pos.grant;
    if (g.type === "RSU") {
      if (pos.quantityUnvested > 0) {
        const acq = pos.quantityUnvested * priceEUR;
        const q = pos.quantityUnvested;
        acqGainRSU += acq;
        grossUSD += q * priceUSD;
        grossEUR += q * priceEUR;
        details.push({
          grantId: g.id,
          grantLabel: `${g.symbol} (RSU)`,
          type: g.type,
          source: "UNVESTED_RSU",
          quantity: q,
          acqGainEUR: acq,
          capGainEUR: 0,
          costToExerciseEUR: 0,
        });
      }
    } else {
      const unexercised = pos.quantityUnvested;
      if (unexercised > 0 && (g.strikeUSD ?? 0) >= 0) {
        const strikeEUR = (g.strikeUSD ?? 0) * fxRate;
        const acqPerShare = Math.max(0, priceEUR - strikeEUR);
        const acq = unexercised * acqPerShare;
        const cost = unexercised * strikeEUR;
        acqGainOption += acq;
        exerciseCost += cost;
        grossUSD += unexercised * priceUSD;
        grossEUR += unexercised * priceEUR;
        details.push({
          grantId: g.id,
          grantLabel: `${g.symbol} (OPT)`,
          type: g.type,
          source: "UNEXERCISED_OPTION",
          quantity: unexercised,
          acqGainEUR: acq,
          capGainEUR: 0,
          costToExerciseEUR: cost,
        });
      }
    }
  }

  const realized = computeRealizedSales(state);
  let rsuAcqUsed = settings.rsuLifetimeAcqUsed;
  for (const r of realized) {
    if (r.grant.type === "RSU") rsuAcqUsed += Math.max(0, r.acqGainEUR);
  }

  const taxRSU = taxRSUAcquisitionGain(acqGainRSU, settings, rsuAcqUsed);
  const taxOpt = taxOptionAcquisitionGain(acqGainOption, settings);
  const taxCap = taxCapitalGain(capGain, settings);

  const taxAcqEUR = taxRSU.total + taxOpt.total;
  const taxCapEUR = taxCap.total;

  const netEUR = grossEUR - exerciseCost - taxAcqEUR - taxCapEUR;

  return {
    grossUSD,
    grossEUR,
    acqGainTotalEUR: acqGainRSU + acqGainOption,
    capGainTotalEUR: capGain,
    taxAcqEUR,
    taxCapEUR,
    exerciseCostEUR: exerciseCost,
    taxDetails: details,
    netEUR,
  };
}

export interface RealizedSummary {
  realizedGrossEUR: number;
  realizedAcqGainEUR: number;
  realizedCapGainEUR: number;
  realizedTaxEUR: number;
  realizedNetEUR: number;
  byYear: Record<
    string,
    {
      acqGainEUR: number;
      capGainEUR: number;
      taxEUR: number;
      grossEUR: number;
    }
  >;
}

export function summarizeRealized(state: AppState): RealizedSummary {
  const sales = computeRealizedSales(state);
  const byYear: RealizedSummary["byYear"] = {};
  let grossEUR = 0;
  let acqGain = 0;
  let capGain = 0;
  let tax = 0;

  let rsuUsed = state.settings.rsuLifetimeAcqUsed;
  for (const r of sales) {
    const year = r.sale.date.slice(0, 4);
    const entry = byYear[year] ?? {
      acqGainEUR: 0,
      capGainEUR: 0,
      taxEUR: 0,
      grossEUR: 0,
    };

    const acqTax =
      r.grant.type === "RSU"
        ? taxRSUAcquisitionGain(r.acqGainEUR, state.settings, rsuUsed)
        : taxOptionAcquisitionGain(r.acqGainEUR, state.settings);
    if (r.grant.type === "RSU") rsuUsed += Math.max(0, r.acqGainEUR);
    const capTax = taxCapitalGain(r.capitalGainEUR, state.settings);

    entry.acqGainEUR += r.acqGainEUR;
    entry.capGainEUR += r.capitalGainEUR;
    entry.grossEUR += r.grossProceedsEUR;
    entry.taxEUR += acqTax.total + capTax.total;
    byYear[year] = entry;

    grossEUR += r.grossProceedsEUR;
    acqGain += r.acqGainEUR;
    capGain += r.capitalGainEUR;
    tax += acqTax.total + capTax.total;
  }

  return {
    realizedGrossEUR: grossEUR,
    realizedAcqGainEUR: acqGain,
    realizedCapGainEUR: capGain,
    realizedTaxEUR: tax,
    realizedNetEUR: grossEUR - tax,
    byYear,
  };
}

/** Total RSU acquisition-gain amount already realized (sold RSU lots). */
export function usedRSUAbatement(state: AppState): number {
  const sales = computeRealizedSales(state);
  let used = state.settings.rsuLifetimeAcqUsed;
  for (const r of sales) {
    if (r.grant.type === "RSU") used += Math.max(0, r.acqGainEUR);
  }
  return used;
}

export function vestingById(state: AppState, id: string): VestingEvent | null {
  return state.vestings.find((v) => v.id === id) ?? null;
}

export function exerciseById(
  state: AppState,
  id: string,
): ExerciseEvent | null {
  return state.exercises.find((e) => e.id === id) ?? null;
}
