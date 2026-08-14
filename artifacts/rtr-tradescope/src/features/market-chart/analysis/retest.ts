import { atrSeries } from "@/features/market-chart/analysis/atr";
import type { AnalysisSettings, RetestEvent, StructureZone } from "@/features/market-chart/analysis/types";
import type { MarketCandle } from "@/types/market";

export function detectRetests(candles: MarketCandle[], zones: StructureZone[], settings: AnalysisSettings): RetestEvent[] {
  const atr = atrSeries(candles);
  const events: RetestEvent[] = [];
  // The last provider candle may still be forming and is never evaluated.
  for (let index = Math.max(2, settings.rsiLength); index < candles.length - 1; index += 1) {
    const candle = candles[index];
    const previous = candles[index - 1];
    const body = Math.max(Math.abs(candle.close - candle.open), atr[index] * 0.05);
    for (const zone of zones) {
      if (zone.state === "Invalid" || candle.time <= zone.confirmedTime) continue;
      const touched = candle.low <= zone.upper && candle.high >= zone.lower;
      const recentlyTouched = touched || [candles[index - 1], candles[index - 2]].some((item) => item.low <= zone.upper && item.high >= zone.lower);
      if (!recentlyTouched) continue;
      const reasons: string[] = [];
      let rejectionScore = 0;
      if (zone.kind === "Demand") {
        const lowerWick = Math.min(candle.open, candle.close) - candle.low;
        if (candle.close > candle.open && lowerWick >= body * (settings.rejectionSensitivity === 3 ? 1.2 : settings.rejectionSensitivity === 2 ? 0.75 : 0.4)) { rejectionScore += 1; reasons.push("Lower-wick rejection"); }
        if (previous.close < previous.open && candle.open <= previous.close && candle.close >= previous.open) { rejectionScore += 1; reasons.push("Bullish engulfing close"); }
        if (candle.low <= zone.upper && candle.close > zone.upper) { rejectionScore += 1; reasons.push("Demand boundary reclaimed"); }
        if (candle.close > candle.open && candle.close - candle.open >= atr[index] * (settings.rejectionSensitivity === 3 ? 0.9 : 0.6)) { rejectionScore += 1; reasons.push("Bullish displacement close"); }
        if (rejectionScore >= settings.retestSensitivity) events.push({ direction: "BUY", candleIndex: index, timestamp: candle.time, price: candle.close, zone, rejectionScore, reasons });
      } else {
        const upperWick = candle.high - Math.max(candle.open, candle.close);
        if (candle.close < candle.open && upperWick >= body * (settings.rejectionSensitivity === 3 ? 1.2 : settings.rejectionSensitivity === 2 ? 0.75 : 0.4)) { rejectionScore += 1; reasons.push("Upper-wick rejection"); }
        if (previous.close > previous.open && candle.open >= previous.close && candle.close <= previous.open) { rejectionScore += 1; reasons.push("Bearish engulfing close"); }
        if (candle.high >= zone.lower && candle.close < zone.lower) { rejectionScore += 1; reasons.push("Supply boundary reclaimed"); }
        if (candle.close < candle.open && candle.open - candle.close >= atr[index] * (settings.rejectionSensitivity === 3 ? 0.9 : 0.6)) { rejectionScore += 1; reasons.push("Bearish displacement close"); }
        if (rejectionScore >= settings.retestSensitivity) events.push({ direction: "SELL", candleIndex: index, timestamp: candle.time, price: candle.close, zone, rejectionScore, reasons });
      }
    }
  }
  return events;
}
