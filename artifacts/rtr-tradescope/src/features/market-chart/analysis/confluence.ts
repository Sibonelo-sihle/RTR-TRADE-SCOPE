import type { AnalysisSettings, RetestEvent, StructureAnalysis } from "@/features/market-chart/analysis/types";

export function scoreConfluence(
  event: RetestEvent,
  structure: StructureAnalysis,
  rsiConfirmed: boolean,
  trendConfirmed: boolean,
  settings: AnalysisSettings,
) {
  const confirmed: string[] = [`${event.zone.timeframe} ${event.zone.kind}`, ...event.reasons];
  const missing: string[] = [];
  let score = 2; // Valid zone location + confirmed rejection/retest.
  const tolerance = Math.max(event.zone.upper - event.zone.lower, event.price * 0.0005);
  const matchingLevel = structure.levels.some((level) => {
    const expected = event.direction === "BUY" ? "Support" : "Resistance";
    return level.confirmedTime <= event.timestamp && level.kind === expected && Math.abs(level.price - event.price) <= tolerance;
  });
  const higherTimeframe = [event.zone.timeframe, ...event.zone.confluence].some((item) => item === "4H" || item === "1H")
    || structure.zones.some((zone) => zone.confirmedTime <= event.timestamp && zone.id !== event.zone.id && zone.kind === event.zone.kind && (zone.timeframe === "4H" || zone.timeframe === "1H") && event.price >= zone.lower && event.price <= zone.upper);
  if (matchingLevel || higherTimeframe) {
    score += 1;
    confirmed.push(higherTimeframe ? "Higher-timeframe structure" : event.direction === "BUY" ? "Structural support" : "Structural resistance");
  } else missing.push("Support/resistance or HTF alignment");
  if (rsiConfirmed) { score += 1; confirmed.push(`RSI ${event.direction === "BUY" ? "bullish" : "bearish"}`); }
  else missing.push("RSI confirmation");
  if (trendConfirmed) { score += 1; confirmed.push(settings.trendEnabled ? `EMA ${settings.emaLength} trend` : "Market-structure momentum"); }
  else missing.push(settings.trendEnabled ? `EMA ${settings.emaLength} trend` : "Market-structure momentum");
  return { score: Math.min(5, score), confirmed, missing, higherTimeframe, matchingLevel };
}
