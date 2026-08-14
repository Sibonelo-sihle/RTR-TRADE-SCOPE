import { atrSeries } from "@/features/market-chart/analysis/atr";
import type { StructureZone, ZoneKind } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketTimeframe } from "@/types/market";

const limits: Record<MarketTimeframe, number> = { "4H": 2, "1H": 2, "15m": 2, "5m": 1 };

function overlapRatio(first: StructureZone, second: StructureZone) {
  const overlap = Math.max(0, Math.min(first.upper, second.upper) - Math.max(first.lower, second.lower));
  return overlap / Math.max(1e-10, Math.min(first.upper - first.lower, second.upper - second.lower));
}

function zoneState(zone: StructureZone, candles: MarketCandle[], startIndex: number, tolerance: number) {
  let touches = 0;
  let leftZone = true;
  for (let index = startIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    if (zone.kind === "Demand" && candle.close < zone.lower - tolerance) return { state: "Invalid" as const, touches };
    if (zone.kind === "Supply" && candle.close > zone.upper + tolerance) return { state: "Invalid" as const, touches };
    const intersects = candle.high >= zone.lower && candle.low <= zone.upper;
    if (intersects && leftZone) {
      touches += 1;
      leftZone = false;
    } else if (!intersects) {
      leftZone = true;
    }
  }
  return { state: touches >= 2 ? "Mitigated" as const : touches === 1 ? "Tested" as const : "Fresh" as const, touches };
}

function isPivot(candles: MarketCandle[], index: number, kind: ZoneKind, wing = 3) {
  const value = kind === "Supply" ? candles[index].high : candles[index].low;
  for (let cursor = index - wing; cursor <= index + wing; cursor += 1) {
    if (cursor === index) continue;
    if (kind === "Supply" ? candles[cursor].high >= value : candles[cursor].low <= value) return false;
  }
  return true;
}

export function detectSupplyDemand(candles: MarketCandle[], timeframe: MarketTimeframe) {
  if (candles.length < 30) return [];
  const atr = atrSeries(candles);
  const candidates: StructureZone[] = [];
  for (let index = 4; index < candles.length - 4; index += 1) {
    const averageRange = atr[index];
    if (!averageRange) continue;
    for (const kind of ["Supply", "Demand"] as const) {
      if (!isPivot(candles, index, kind)) continue;
      const base = candles.slice(Math.max(0, index - 2), index + 1);
      const baseHigh = Math.max(...base.map((candle) => candle.high));
      const baseLow = Math.min(...base.map((candle) => candle.low));
      if (baseHigh - baseLow > averageRange * 2.6) continue;
      const departure = candles.slice(index + 1, index + 4);
      const bearishBody = Math.max(...departure.map((candle) => candle.open - candle.close));
      const bullishBody = Math.max(...departure.map((candle) => candle.close - candle.open));
      const displacement = kind === "Supply"
        ? baseLow - Math.min(...departure.map((candle) => candle.close))
        : Math.max(...departure.map((candle) => candle.close)) - baseHigh;
      const body = kind === "Supply" ? bearishBody : bullishBody;
      if (displacement < averageRange * 0.55 || body < averageRange * 0.45) continue;
      const lower = kind === "Supply" ? Math.min(...base.map((candle) => Math.min(candle.open, candle.close))) : baseLow;
      const upper = kind === "Supply" ? baseHigh : Math.max(...base.map((candle) => Math.max(candle.open, candle.close)));
      if (upper <= lower) continue;
      const draft: StructureZone = {
        id: `${timeframe}-${kind}-${candles[index].time}`,
        kind,
        timeframe,
        lower,
        upper,
        createdTime: candles[index].time,
        confirmedTime: candles[index + 3].time,
        state: "Fresh",
        strength: displacement / averageRange + body / averageRange + index / candles.length,
        touches: 0,
        confluence: [],
      };
      const state = zoneState(draft, candles, index + 4, averageRange * 0.15);
      candidates.push({ ...draft, ...state, strength: draft.strength + (state.state === "Fresh" ? 1.5 : state.state === "Tested" ? 0.7 : 0) });
    }
  }
  return (["Supply", "Demand"] as const).flatMap((kind) => {
    const ranked = candidates.filter((zone) => zone.kind === kind && zone.state !== "Invalid").sort((a, b) => b.strength - a.strength || b.createdTime - a.createdTime);
    const selected: StructureZone[] = [];
    for (const zone of ranked) {
      if (selected.some((existing) => overlapRatio(existing, zone) >= 0.55)) continue;
      selected.push(zone);
      if (selected.length >= limits[timeframe]) break;
    }
    return selected;
  });
}

export function substantialZoneOverlap(first: StructureZone, second: StructureZone) {
  return first.kind === second.kind && overlapRatio(first, second) >= 0.5;
}
