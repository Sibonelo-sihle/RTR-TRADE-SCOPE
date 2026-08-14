import { atrSeries } from "@/features/market-chart/analysis/atr";
import type { StructureLevel, StructureZone } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketTimeframe } from "@/types/market";

export function detectSupportResistance(candles: MarketCandle[], timeframe: MarketTimeframe, zones: StructureZone[]) {
  if (candles.length < 30) return [];
  const atr = atrSeries(candles);
  const pivots: { price: number; time: number; index: number }[] = [];
  for (let index = 3; index < candles.length - 3; index += 1) {
    const peers = candles.slice(index - 3, index + 4);
    if (candles[index].low === Math.min(...peers.map((candle) => candle.low))) pivots.push({ price: candles[index].low, time: candles[index].time, index });
    if (candles[index].high === Math.max(...peers.map((candle) => candle.high))) pivots.push({ price: candles[index].high, time: candles[index].time, index });
  }
  const clusters: typeof pivots[] = [];
  for (const pivot of pivots) {
    const tolerance = Math.max(atr[pivot.index] * 0.28, pivot.price * 0.00005);
    const cluster = clusters.find((items) => Math.abs(items.reduce((sum, item) => sum + item.price, 0) / items.length - pivot.price) <= tolerance);
    if (cluster) cluster.push(pivot); else clusters.push([pivot]);
  }
  const current = candles.at(-1)?.close ?? 0;
  return clusters.filter((cluster) => cluster.length >= 2).map((cluster): StructureLevel => {
    const price = cluster.reduce((sum, pivot) => sum + pivot.price, 0) / cluster.length;
    const latest = Math.max(...cluster.map((pivot) => pivot.index));
    const confirmationPivot = [...cluster].sort((a, b) => a.index - b.index)[1];
    return {
      id: `${timeframe}-level-${cluster[0].time}`,
      kind: price <= current ? "Support" : "Resistance",
      timeframe,
      price,
      createdTime: cluster[0].time,
      confirmedTime: candles[Math.min(candles.length - 1, confirmationPivot.index + 3)].time,
      touches: cluster.length,
      strength: cluster.length * 1.5 + latest / candles.length,
    };
  }).filter((level) => !zones.some((zone) => level.price >= zone.lower - atr.at(-1)! * 0.12 && level.price <= zone.upper + atr.at(-1)! * 0.12))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, timeframe === "4H" ? 2 : 1);
}
