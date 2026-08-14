import { detectSupplyDemand, substantialZoneOverlap } from "@/features/market-chart/analysis/supplyDemand";
import { detectSupportResistance } from "@/features/market-chart/analysis/supportResistance";
import type { StructureAnalysis, StructureLevel, StructureZone } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketTimeframe } from "@/types/market";

export const structureTimeframes: MarketTimeframe[] = ["4H", "1H", "15m", "5m"];

export function analyzeMultiTimeframe(candleSets: Record<MarketTimeframe, MarketCandle[]>): StructureAnalysis {
  const zones: StructureZone[] = [];
  const levels: StructureLevel[] = [];
  for (const timeframe of structureTimeframes) {
    const detected = detectSupplyDemand(candleSets[timeframe], timeframe);
    for (const candidate of detected) {
      const stronger = zones.find((zone) => substantialZoneOverlap(zone, candidate));
      if (stronger) {
        if (!stronger.confluence.includes(timeframe)) stronger.confluence.push(timeframe);
        stronger.strength += 1;
      } else {
        zones.push(candidate);
      }
    }
    levels.push(...detectSupportResistance(candleSets[timeframe], timeframe, zones));
  }
  return { zones, levels, currentPrice: candleSets["5m"].at(-1)?.close ?? candleSets["15m"].at(-1)?.close ?? 0 };
}
