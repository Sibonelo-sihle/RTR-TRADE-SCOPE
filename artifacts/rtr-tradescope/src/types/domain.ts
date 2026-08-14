export type Direction = "BUY" | "SELL";
export type Session = "Asian" | "London" | "New York" | "Overlap" | "Other";
export type TradeStatus = "Planned" | "Open" | "Closed";
export type TradeResult = "Win" | "Loss" | "Breakeven" | "Pending";

export interface Trade {
  id: string;
  symbol: string;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  exit: number;
  positionSize: number;
  date: string;
  session: Session;
  strategy: string;
  status: TradeStatus;
  result: TradeResult;
  notes: string;
  pnl: number;
  rMultiple: number;
  rr: number;
  screenshot?: string;
}

export interface PriceAlert {
  id: string;
  instrument: string;
  targetPrice: number;
  condition: "Above" | "Below";
  note: string;
  status: "Active" | "Triggered" | "Disabled";
  createdAt: string;
  triggeredAt?: string;
  source?: string;
  sourceTimeframe?: string;
  sourceSignal?: string;
  confluenceScore?: number;
}
export interface Strategy {
  id: string;
  name: string;
  description: string;
  preferredMarkets: string;
  preferredSession: Session;
  riskRules: string;
  entryRules: string;
  exitRules: string;
  notes: string;
  tradeCount: number;
  winRate: number;
  profitFactor: number;
  totalPnl: number;
}
export interface Settings {
  currency: "USD" | "EUR" | "GBP";
  defaultRisk: number;
  defaultSession: Session;
  weekStart: "Monday" | "Sunday";
  density: "Compact" | "Comfortable" | "Spacious";
  confirmDestructive: boolean;
}
