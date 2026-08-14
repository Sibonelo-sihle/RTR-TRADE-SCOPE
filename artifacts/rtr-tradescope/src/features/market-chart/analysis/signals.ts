import { scoreConfluence } from "@/features/market-chart/analysis/confluence";
import { detectRetests } from "@/features/market-chart/analysis/retest";
import { calculateRsi, rsiConfirmation } from "@/features/market-chart/analysis/rsi";
import { calculateEma, trendDirection } from "@/features/market-chart/analysis/trend";
import type { AnalysisSettings, RTRSignal, SignalAnalysis, StructureAnalysis } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketSymbol, MarketTimeframe } from "@/types/market";

export function analyzeSignals(
  symbol: MarketSymbol,
  timeframe: MarketTimeframe,
  candles: MarketCandle[],
  structure: StructureAnalysis,
  settings: AnalysisSettings,
): SignalAnalysis {
  const rsi = calculateRsi(candles, settings.rsiLength);
  const ema = calculateEma(candles, settings.emaLength);
  const retests = detectRetests(candles, structure.zones, settings);
  const candidates: RTRSignal[] = [];
  for (const event of retests) {
    const confirmation = rsiConfirmation(rsi, event.candleIndex, settings.rsiOversold, settings.rsiOverbought);
    const trend = trendDirection(candles, ema, event.candleIndex, settings.trendEnabled);
    const bullish = event.direction === "BUY";
    const scored = scoreConfluence(event, structure, bullish ? confirmation.bullish : confirmation.bearish, trend === (bullish ? "Bullish" : "Bearish"), settings);
    if (scored.score < settings.threshold || confirmation.value === null) continue;
    candidates.push({
      id: `${symbol}-${timeframe}-${event.direction}-${event.timestamp}`,
      symbol,
      timeframe,
      direction: event.direction,
      timestamp: event.timestamp,
      price: event.price,
      score: scored.score,
      zoneTimeframe: event.zone.timeframe,
      zoneType: event.zone.kind,
      zoneId: event.zone.id,
      zoneLower: event.zone.lower,
      zoneUpper: event.zone.upper,
      signalKind: "EXECUTION",
      rsi: confirmation.value,
      reason: scored.confirmed,
      missing: scored.missing,
    });
  }
  const signals: RTRSignal[] = [];
  for (const candidate of candidates.sort((a, b) => a.timestamp - b.timestamp || b.score - a.score)) {
    const duplicateCandle = signals.some((signal) => signal.timestamp === candidate.timestamp && signal.direction === candidate.direction);
    if (duplicateCandle) continue;
    const index = candles.findIndex((candle) => candle.time === candidate.timestamp);
    const prior = [...signals].reverse().find((signal) => signal.direction === candidate.direction);
    const priorIndex = prior ? candles.findIndex((candle) => candle.time === prior.timestamp) : -Infinity;
    if (index - priorIndex < settings.cooldownBars) continue;
    signals.push(candidate);
  }
  const closedIndex = Math.max(0, candles.length - 2);
  const latestSignal = signals.at(-1);
  const latestSignalIndex = latestSignal ? candles.findIndex((candle) => candle.time === latestSignal.timestamp) : -Infinity;
  const latestRetest = retests.at(-1) ?? null;
  const latestRsi = rsi[closedIndex];
  const previousRsi = rsi[closedIndex - 1];
  const rsiBias = latestRsi !== null && previousRsi !== null && latestRsi !== undefined && previousRsi !== undefined
    ? latestRsi > previousRsi ? "Bullish" : latestRsi < previousRsi ? "Bearish" : "Neutral"
    : "Neutral";
  return {
    signals,
    currentSignal: latestSignal && closedIndex - latestSignalIndex <= 2 ? latestSignal : null,
    rsi: latestRsi ?? null,
    rsiBias,
    trend: trendDirection(candles, ema, closedIndex, settings.trendEnabled),
    latestRetest,
    currentRetest: latestRetest && closedIndex - latestRetest.candleIndex <= 2 ? latestRetest : null,
  };
}
