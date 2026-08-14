import { analyzeMultiTimeframe, structureTimeframes } from "@/features/market-chart/analysis/multiTimeframe";
import { analyzeSignals } from "@/features/market-chart/analysis/signals";
import type { AnalysisSettings, RTRSignal } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketSymbol, MarketTimeframe } from "@/types/market";

const timeframeSeconds: Record<MarketTimeframe, number> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };

function candlesClosedBy(candles: MarketCandle[], timeframe: MarketTimeframe, timestamp: number) {
  const duration = timeframeSeconds[timeframe];
  return candles.filter((candle) => candle.time + duration <= timestamp);
}

export function analyzeHistoricalSignals(
  symbol: MarketSymbol,
  timeframe: MarketTimeframe,
  candleSets: Record<MarketTimeframe, MarketCandle[]>,
  settings: AnalysisSettings,
  limit = 30,
) {
  const selected = candleSets[timeframe];
  const confirmed: RTRSignal[] = [];
  const seen = new Set<string>();
  const warmup = Math.max(60, settings.emaLength + 5, settings.rsiLength + 5);

  for (let formingIndex = warmup; formingIndex < selected.length; formingIndex += 1) {
    const evaluationTime = selected[formingIndex].time;
    const historicalSets = Object.fromEntries(structureTimeframes.map((item) => [item, candlesClosedBy(candleSets[item], item, evaluationTime)])) as Record<MarketTimeframe, MarketCandle[]>;
    if (structureTimeframes.some((item) => historicalSets[item].length < 30)) continue;
    const structure = analyzeMultiTimeframe(historicalSets);
    const selectedPrefix = selected.slice(0, formingIndex + 1);
    const result = analyzeSignals(symbol, timeframe, selectedPrefix, structure, settings);
    const justClosed = selected[formingIndex - 1].time;
    for (const signal of result.signals) {
      if (signal.timestamp !== justClosed || seen.has(signal.id)) continue;
      seen.add(signal.id);
      confirmed.push(signal);
    }
  }
  return confirmed.slice(-limit);
}
