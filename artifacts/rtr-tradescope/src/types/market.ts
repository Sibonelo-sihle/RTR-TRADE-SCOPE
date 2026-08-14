export type MarketSymbol = "XAUUSD" | "EURUSD" | "GBPUSD" | "USDJPY";
export type MarketTimeframe = "5m" | "15m" | "1H" | "4H";

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataStatus {
  provider: string;
  connected: boolean;
  symbols: MarketSymbol[];
  detail?: string | null;
}
