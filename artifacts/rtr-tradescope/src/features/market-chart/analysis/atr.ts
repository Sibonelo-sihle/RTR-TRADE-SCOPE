import type { MarketCandle } from "@/types/market";

export function trueRange(candle: MarketCandle, previous?: MarketCandle) {
  if (!previous) return candle.high - candle.low;
  return Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close));
}

export function atrSeries(candles: MarketCandle[], length = 14) {
  const result = new Array<number>(candles.length).fill(0);
  let rolling = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const range = trueRange(candles[index], candles[index - 1]);
    rolling += range;
    if (index >= length) rolling -= trueRange(candles[index - length], candles[index - length - 1]);
    result[index] = rolling / Math.min(index + 1, length);
  }
  return result;
}
