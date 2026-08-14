import { atrSeries } from "@/features/market-chart/analysis/atr";
import { analyzeHistoricalSignals } from "@/features/market-chart/analysis/historicalSignals";
import { detectSupplyDemand } from "@/features/market-chart/analysis/supplyDemand";
import { detectSupportResistance } from "@/features/market-chart/analysis/supportResistance";
import type { AnalysisSettings, RTRSignal, StructureLevel, StructureZone, SwingTradePlan } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketSymbol, MarketTimeframe } from "@/types/market";

const timeframeSeconds: Record<MarketTimeframe, number> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };
export const minimumSwingRiskReward = 1.5;
export interface SwingSignalHistory { primary: SwingTradePlan[]; holding: SwingTradePlan[]; execution: RTRSignal[] }

function closedBy(candles: MarketCandle[], timeframe: MarketTimeframe, timestamp: number) {
  return candles.filter((candle) => candle.time + timeframeSeconds[timeframe] <= timestamp);
}
function alignedWithBias(fourHour: StructureZone, oneHour: StructureZone, direction: "BUY" | "SELL", entry: number) {
  if (Math.min(fourHour.upper, oneHour.upper) >= Math.max(fourHour.lower, oneHour.lower)) return true;
  return direction === "BUY"
    ? fourHour.lower < entry && oneHour.lower >= fourHour.lower && oneHour.upper <= entry
    : fourHour.upper > entry && oneHour.upper <= fourHour.upper && oneHour.lower >= entry;
}
function targetPrice(item: StructureZone | StructureLevel, direction: "BUY" | "SELL") { return "price" in item ? item.price : direction === "BUY" ? item.lower : item.upper; }
function targetCandidates(candles: MarketCandle[], timeframe: "1H" | "4H", direction: "BUY" | "SELL", entry: number, timestamp: number) {
  const zones = detectSupplyDemand(candles, timeframe);
  const levels = detectSupportResistance(candles, timeframe, zones);
  return [...zones.filter((zone) => zone.confirmedTime <= timestamp && zone.kind === (direction === "BUY" ? "Supply" : "Demand")), ...levels.filter((level) => level.confirmedTime <= timestamp && level.kind === (direction === "BUY" ? "Resistance" : "Support"))]
    .map((item) => ({ item, price: targetPrice(item, direction) }))
    .filter(({ price }) => direction === "BUY" ? price > entry : price < entry)
    .sort((first, second) => Math.abs(first.price - entry) - Math.abs(second.price - entry));
}

function buildPlan(signal: RTRSignal, candleSets: Record<MarketTimeframe, MarketCandle[]>, minimumRr: number): SwingTradePlan | null {
  const knownAt = signal.timestamp + timeframeSeconds[signal.timeframe];
  const fourHourCandles = closedBy(candleSets["4H"], "4H", knownAt);
  const oneHourCandles = closedBy(candleSets["1H"], "1H", knownAt);
  const entryCandle = candleSets[signal.timeframe].find((candle) => candle.time === signal.timestamp);
  if (!entryCandle || fourHourCandles.length < 30 || oneHourCandles.length < 30) return null;
  const kind = signal.direction === "BUY" ? "Demand" : "Supply";
  const fourHourZones = detectSupplyDemand(fourHourCandles, "4H").filter((zone) => zone.kind === kind && zone.confirmedTime <= signal.timestamp);
  const oneHourZones = detectSupplyDemand(oneHourCandles, "1H").filter((zone) => zone.kind === kind && zone.confirmedTime <= signal.timestamp && entryCandle.high >= zone.lower && entryCandle.low <= zone.upper);
  const aligned = oneHourZones.flatMap((oneHour) => fourHourZones.filter((fourHour) => alignedWithBias(fourHour, oneHour, signal.direction, signal.price)).map((fourHour) => ({ fourHour, oneHour }))).sort((first, second) => Math.abs(signal.price - first.fourHour[signal.direction === "BUY" ? "lower" : "upper"]) - Math.abs(signal.price - second.fourHour[signal.direction === "BUY" ? "lower" : "upper"]))[0];
  if (!aligned) return null;
  const zoneIndex = fourHourCandles.findIndex((candle) => candle.time === aligned.fourHour.createdTime);
  const zoneAtr = atrSeries(fourHourCandles)[zoneIndex];
  if (!(zoneAtr > 0)) return null;
  const atrBuffer = zoneAtr * 0.15;
  const stop = signal.direction === "BUY" ? aligned.fourHour.lower - atrBuffer : aligned.fourHour.upper + atrBuffer;
  const risk = signal.direction === "BUY" ? signal.price - stop : stop - signal.price;
  if (!(risk > 0)) return null;
  const rawTp1 = targetCandidates(oneHourCandles, "1H", signal.direction, signal.price, signal.timestamp)[0];
  const rawTp2 = targetCandidates(fourHourCandles, "4H", signal.direction, signal.price, signal.timestamp).find((candidate) => !rawTp1 || Math.abs(candidate.price - rawTp1.price) > Math.max(signal.price * 0.0005, risk * 0.1));
  const rr = (price: number | undefined) => price === undefined ? null : (signal.direction === "BUY" ? price - signal.price : signal.price - price) / risk;
  const rawRr1 = rr(rawTp1?.price); const rawRr2 = rr(rawTp2?.price);
  const tp1Valid = rawRr1 !== null && rawRr1 >= minimumRr; const tp2Valid = rawRr2 !== null && rawRr2 >= minimumRr;
  return { ...signal, id: `SWING-${signal.direction}-${aligned.fourHour.id}-${aligned.oneHour.id}-${signal.timestamp}`, signalKind: "SWING", zoneId: aligned.fourHour.id, zoneTimeframe: "4H", zoneLower: aligned.fourHour.lower, zoneUpper: aligned.fourHour.upper, fourHourBias: signal.direction === "BUY" ? "BULLISH" : "BEARISH", fourHourZoneId: aligned.fourHour.id, oneHourSetupId: aligned.oneHour.id, atrBuffer, stop, tp1: tp1Valid ? rawTp1!.price : null, tp2: tp2Valid ? rawTp2!.price : null, tp1StructureId: tp1Valid ? rawTp1!.item.id : null, tp2StructureId: tp2Valid ? rawTp2!.item.id : null, rrToTp1: tp1Valid ? rawRr1 : null, rrToTp2: tp2Valid ? rawRr2 : null, actionable: tp1Valid || tp2Valid };
}

export function analyzeHistoricalSwingSignals(symbol: MarketSymbol, candleSets: Record<MarketTimeframe, MarketCandle[]>, settings: AnalysisSettings, limit = 30, minimumRr = minimumSwingRiskReward): SwingSignalHistory {
  const execution = (["15m", "5m"] as const).flatMap((timeframe) => analyzeHistoricalSignals(symbol, timeframe, candleSets, settings, 100)).sort((first, second) => first.timestamp - second.timestamp || (first.timeframe === "15m" ? -1 : 1));
  const seen = new Set<string>(); const plans: SwingTradePlan[] = [];
  for (const signal of execution) { const plan = buildPlan(signal, candleSets, minimumRr); if (!plan) continue; const setup = `${plan.direction}:${plan.fourHourZoneId}:${plan.oneHourSetupId}`; if (seen.has(setup)) continue; seen.add(setup); plans.push(plan); }
  return { primary: plans.filter((plan) => plan.actionable).slice(-limit), holding: plans.filter((plan) => !plan.actionable).slice(-limit), execution: execution.slice(-limit) };
}
export function visibleSwingMarkers(history: SwingSignalHistory, filter: "ALL" | "BUY" | "SELL" | "HIDE", showExecution: boolean) { if (filter === "HIDE") return []; const signals = showExecution ? [...history.primary, ...history.execution] : history.primary; return signals.filter((signal) => filter === "ALL" || signal.direction === filter); }
