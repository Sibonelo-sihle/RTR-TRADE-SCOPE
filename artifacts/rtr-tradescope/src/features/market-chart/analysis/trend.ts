import type { MarketCandle } from "@/types/market";

export function calculateEma(candles: MarketCandle[], length = 50) {
  const values = new Array<number | null>(candles.length).fill(null);
  if (!candles.length) return values;
  const multiplier = 2 / (length + 1);
  let ema = candles[0].close;
  for (let index = 0; index < candles.length; index += 1) {
    ema = index === 0 ? candles[index].close : (candles[index].close - ema) * multiplier + ema;
    if (index >= length - 1) values[index] = ema;
  }
  return values;
}

export function trendDirection(candles: MarketCandle[], ema: (number | null)[], index: number, enabled: boolean) {
  if (!enabled) {
    const comparison = candles[index - 5]?.close;
    if (comparison === undefined) return "Neutral" as const;
    return candles[index].close > comparison ? "Bullish" as const : candles[index].close < comparison ? "Bearish" as const : "Neutral" as const;
  }
  const current = ema[index];
  const previous = ema[index - 3];
  if (current === null || previous === null || current === undefined || previous === undefined) return "Neutral" as const;
  if (candles[index].close > current && current > previous) return "Bullish" as const;
  if (candles[index].close < current && current < previous) return "Bearish" as const;
  return "Neutral" as const;
}
