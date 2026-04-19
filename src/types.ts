export type GrantType = "RSU" | "STOCK_OPTION";

export interface PlannedVesting {
  date: string;
  quantity: number;
}

export interface Grant {
  id: string;
  symbol: string;
  type: GrantType;
  grantDate: string;
  totalQuantity: number;
  strikeUSD?: number;
  fmvAtGrantUSD?: number;
  fxAtGrant?: number;
  vestingSchedule: PlannedVesting[];
  notes?: string;
}

export interface VestingEvent {
  id: string;
  grantId: string;
  date: string;
  quantity: number;
  fmvUSD: number;
  fxRate: number;
}

export interface ExerciseEvent {
  id: string;
  grantId: string;
  date: string;
  quantity: number;
  fmvUSD: number;
  fxRate: number;
}

export interface SaleEvent {
  id: string;
  grantId: string;
  date: string;
  quantity: number;
  salePriceUSD: number;
  fxRate: number;
  fees?: number;
}

export interface Settings {
  marginalIRRate: number;
  socialChargesSalary: number;
  socialChargesRSUAcq: number;
  pfuIR: number;
  pfuSocial: number;
  rsuAbatementThreshold: number;
  rsuLifetimeAcqUsed: number;
  defaultFxRate: number;
  currentStockPriceUSD: number;
  currentFxRate: number;
}

export interface AppState {
  grants: Grant[];
  vestings: VestingEvent[];
  exercises: ExerciseEvent[];
  sales: SaleEvent[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  marginalIRRate: 0.45,
  socialChargesSalary: 0.097,
  socialChargesRSUAcq: 0.172,
  pfuIR: 0.128,
  pfuSocial: 0.172,
  rsuAbatementThreshold: 300000,
  rsuLifetimeAcqUsed: 0,
  defaultFxRate: 0.92,
  currentStockPriceUSD: 0,
  currentFxRate: 0.92,
};

export const EMPTY_STATE: AppState = {
  grants: [],
  vestings: [],
  exercises: [],
  sales: [],
  settings: DEFAULT_SETTINGS,
};
