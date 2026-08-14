import { api } from "@/services/api";
import type { MarketCandle, MarketDataStatus, MarketSymbol, MarketTimeframe } from "@/types/market";

export interface MarketDataClient {
  getStatus(): Promise<MarketDataStatus>;
  getCandles(symbol: MarketSymbol, timeframe: MarketTimeframe, limit?: number): Promise<MarketCandle[]>;
}

export const marketData: MarketDataClient = {
  getStatus: () => api.get<MarketDataStatus>("/api/market/status"),
  getCandles: (symbol, timeframe, limit = 500) =>
    api.get<MarketCandle[]>(`/api/market/candles?${new URLSearchParams({ symbol, timeframe, limit: String(limit) })}`),
};
