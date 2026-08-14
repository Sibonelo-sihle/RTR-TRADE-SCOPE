import { scoreConfluence } from "@/features/market-chart/analysis/confluence";
import { calculateRsi, rsiConfirmation } from "@/features/market-chart/analysis/rsi";
import { calculateEma, trendDirection } from "@/features/market-chart/analysis/trend";
import type { AnalysisSettings, SignalAnalysis, StructureAnalysis, StructureZone } from "@/features/market-chart/analysis/types";
import type { MarketCandle } from "@/types/market";

export type LiveEngineState = "WAITING FOR SETUP" | "WATCHING DEMAND" | "WATCHING SUPPLY" | "RETEST DETECTED" | "BULLISH CONFLUENCE BUILDING" | "BEARISH CONFLUENCE BUILDING" | "BUY RETEST" | "SELL RETEST";

export interface LiveAnalysisStatus {
  state: LiveEngineState;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  zone: StructureZone | null;
  score: number | null;
  potentialSetup: boolean;
  waitingForClose: boolean;
  reason: string;
  checks: { zone: boolean; htf: boolean; supportResistance: boolean; rsi: boolean; retest: boolean; trend: boolean };
}

function zoneAtCandle(candle: MarketCandle | undefined, analysis: StructureAnalysis) {
  if (!candle) return null;
  return analysis.zones
    .filter((zone) => zone.state !== "Invalid" && candle.high >= zone.lower && candle.low <= zone.upper)
    .sort((first, second) => second.strength - first.strength)[0] ?? null;
}

function structureChecks(zone: StructureZone | null, direction: "BUY" | "SELL" | null, price: number, timestamp: number, analysis: StructureAnalysis) {
  if (!zone || !direction) return { htf: false, supportResistance: false };
  const tolerance = Math.max(zone.upper - zone.lower, price * 0.0005);
  const supportResistance = analysis.levels.some((level) => {
    const expected = direction === "BUY" ? "Support" : "Resistance";
    return level.confirmedTime <= timestamp && level.kind === expected && Math.abs(level.price - price) <= tolerance;
  });
  const htf = [zone.timeframe, ...zone.confluence].some((item) => item === "4H" || item === "1H")
    || analysis.zones.some((candidate) => candidate.confirmedTime <= timestamp && candidate.id !== zone.id && candidate.kind === zone.kind && (candidate.timeframe === "4H" || candidate.timeframe === "1H") && price >= candidate.lower && price <= candidate.upper);
  return { htf, supportResistance };
}

export function deriveLiveAnalysisStatus(candles: MarketCandle[], analysis: StructureAnalysis, signals: SignalAnalysis, settings: AnalysisSettings): LiveAnalysisStatus {
  const formingCandle = candles.at(-1);
  const activeSignal = signals.currentSignal;
  const retest = signals.currentRetest;
  const signalZone = activeSignal ? analysis.zones.find((candidate) => candidate.timeframe === activeSignal.zoneTimeframe && candidate.kind === activeSignal.zoneType && activeSignal.price >= candidate.lower && activeSignal.price <= candidate.upper) ?? null : null;
  const zone = signalZone ?? retest?.zone ?? zoneAtCandle(formingCandle, analysis);
  const direction = activeSignal?.direction ?? retest?.direction ?? (zone?.kind === "Demand" ? "BUY" : zone?.kind === "Supply" ? "SELL" : null);
  const price = activeSignal?.price ?? retest?.price ?? formingCandle?.close ?? analysis.currentPrice;
  const timestamp = activeSignal?.timestamp ?? retest?.timestamp ?? formingCandle?.time ?? 0;
  const structure = structureChecks(zone, direction, price, timestamp, analysis);
  let rsi = false;
  let trend = false;
  let score: number | null = activeSignal?.score ?? null;
  if (retest) {
    const rsiValues = calculateRsi(candles, settings.rsiLength);
    const confirmation = rsiConfirmation(rsiValues, retest.candleIndex, settings.rsiOversold, settings.rsiOverbought);
    rsi = retest.direction === "BUY" ? confirmation.bullish : confirmation.bearish;
    const ema = calculateEma(candles, settings.emaLength);
    const eventTrend = trendDirection(candles, ema, retest.candleIndex, settings.trendEnabled);
    trend = eventTrend === (retest.direction === "BUY" ? "Bullish" : "Bearish");
    score ??= scoreConfluence(retest, analysis, rsi, trend, settings).score;
  }
  if (activeSignal) {
    rsi = activeSignal.reason.some((item) => item.startsWith("RSI "));
    trend = activeSignal.reason.some((item) => item.startsWith("EMA ") || item === "Market-structure momentum");
  }
  const checks = { zone: Boolean(zone), htf: structure.htf, supportResistance: structure.supportResistance, rsi, retest: Boolean(retest), trend };
  if (activeSignal) return { state: activeSignal.direction === "BUY" ? "BUY RETEST" : "SELL RETEST", direction: activeSignal.direction === "BUY" ? "BULLISH" : "BEARISH", zone, score, potentialSetup: false, waitingForClose: false, reason: `Confirmed on the closed ${activeSignal.timeframe} candle.`, checks };
  if (retest) {
    const building = score !== null && score >= 3;
    return { state: building ? (retest.direction === "BUY" ? "BULLISH CONFLUENCE BUILDING" : "BEARISH CONFLUENCE BUILDING") : "RETEST DETECTED", direction: retest.direction === "BUY" ? "BULLISH" : "BEARISH", zone, score, potentialSetup: false, waitingForClose: false, reason: score !== null && score < settings.threshold ? `Confirmed retest is below the configured ${settings.threshold}/5 threshold.` : "Confirmed retest is still missing a required confluence condition.", checks };
  }
  if (zone) return { state: zone.kind === "Demand" ? "WATCHING DEMAND" : "WATCHING SUPPLY", direction: zone.kind === "Demand" ? "BULLISH" : "BEARISH", zone, score: null, potentialSetup: true, waitingForClose: true, reason: `Price is interacting with ${zone.timeframe} ${zone.kind.toLowerCase()}. Waiting for candle close and confirmed rejection.`, checks };
  return { state: "WAITING FOR SETUP", direction: "NEUTRAL", zone: null, score: null, potentialSetup: false, waitingForClose: false, reason: "No valid supply/demand retest currently detected.", checks };
}
