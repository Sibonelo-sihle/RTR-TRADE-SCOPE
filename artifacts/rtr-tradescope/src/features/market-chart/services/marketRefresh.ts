import type { MarketTimeframe } from "@/types/market";

export const refreshCadence: Record<MarketTimeframe, number> = { "5m": 600_000, "15m": 1_800_000, "1H": 3_600_000, "4H": 14_400_000 };
export const boundaryDelay = 15_000;

export function nextMarketRefresh(timeframe: MarketTimeframe, current: number) {
  const cadence = refreshCadence[timeframe];
  return Math.floor((current - boundaryDelay) / cadence + 1) * cadence + boundaryDelay;
}
