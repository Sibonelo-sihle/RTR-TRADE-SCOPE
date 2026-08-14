import { analyzeHistoricalSignals } from "@/features/market-chart/analysis/historicalSignals";
import type { AnalysisSettings, RTRSignal } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketSymbol, MarketTimeframe } from "@/types/market";

const authorityTimeframes = new Set<MarketTimeframe>(["4H", "1H"]);

export interface SwingSignalHistory {
  primary: RTRSignal[];
  execution: RTRSignal[];
}

export function analyzeHistoricalSwingSignals(
  symbol: MarketSymbol,
  candleSets: Record<MarketTimeframe, MarketCandle[]>,
  settings: AnalysisSettings,
  limit = 30,
): SwingSignalHistory {
  const execution = (["15m", "5m"] as const)
    .flatMap((timeframe) => analyzeHistoricalSignals(symbol, timeframe, candleSets, settings, 100))
    .sort((first, second) => first.timestamp - second.timestamp || (first.timeframe === "15m" ? -1 : 1));
  const seenSetups = new Set<string>();
  const primary: RTRSignal[] = [];
  for (const signal of execution) {
    if (!authorityTimeframes.has(signal.zoneTimeframe)) continue;
    const setupId = `${signal.direction}:${signal.zoneId}`;
    if (seenSetups.has(setupId)) continue;
    seenSetups.add(setupId);
    primary.push({ ...signal, id: `SWING-${setupId}-${signal.timestamp}`, signalKind: "SWING" });
  }
  return { primary: primary.slice(-limit), execution: execution.slice(-limit) };
}

export function visibleSwingMarkers(
  history: SwingSignalHistory,
  filter: "ALL" | "BUY" | "SELL" | "HIDE",
  showExecution: boolean,
) {
  if (filter === "HIDE") return [];
  const signals = showExecution ? [...history.primary, ...history.execution] : history.primary;
  return signals.filter((signal) => filter === "ALL" || signal.direction === filter);
}
