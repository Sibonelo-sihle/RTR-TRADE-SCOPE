import type { MarketCandle } from "@/types/market";

export function calculateRsi(candles: MarketCandle[], length = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= length) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / length;
  let averageLoss = losses / length;
  result[length] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  for (let index = length + 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    averageGain = (averageGain * (length - 1) + Math.max(change, 0)) / length;
    averageLoss = (averageLoss * (length - 1) + Math.max(-change, 0)) / length;
    result[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
}

export function rsiConfirmation(values: (number | null)[], index: number, oversold: number, overbought: number) {
  const current = values[index];
  const previous = values[index - 1];
  const prior = values[index - 2];
  if (current === null || previous === null || prior === null) return { bullish: false, bearish: false, value: current };
  const bullish = current > previous && (previous <= oversold + 5 || (previous < 50 && current >= 50) || current - prior >= 3);
  const bearish = current < previous && (previous >= overbought - 5 || (previous > 50 && current <= 50) || prior - current >= 3);
  return { bullish, bearish, value: current };
}
