import type { MarketTimeframe } from "@/types/market";

export type ZoneKind = "Supply" | "Demand";
export type ZoneState = "Fresh" | "Tested" | "Mitigated" | "Invalid";

export interface StructureZone {
  id: string;
  kind: ZoneKind;
  timeframe: MarketTimeframe;
  lower: number;
  upper: number;
  createdTime: number;
  confirmedTime: number;
  state: ZoneState;
  strength: number;
  touches: number;
  confluence: MarketTimeframe[];
}

export interface StructureLevel {
  id: string;
  kind: "Support" | "Resistance";
  timeframe: MarketTimeframe;
  price: number;
  createdTime: number;
  confirmedTime: number;
  touches: number;
  strength: number;
}

export interface StructureAnalysis {
  zones: StructureZone[];
  levels: StructureLevel[];
  currentPrice: number;
}

export interface StructureVisibility {
  supply: boolean;
  demand: boolean;
  levels: boolean;
  hideMitigated: boolean;
  timeframes: Record<MarketTimeframe, boolean>;
}

export interface AnalysisSettings {
  rsiLength: number;
  rsiOversold: number;
  rsiOverbought: number;
  threshold: 3 | 4 | 5;
  trendEnabled: boolean;
  emaLength: number;
  retestSensitivity: 1 | 2 | 3;
  rejectionSensitivity: 1 | 2 | 3;
  cooldownBars: number;
  showMarkers: boolean;
  showRsi: boolean;
}

export interface RetestEvent {
  direction: "BUY" | "SELL";
  candleIndex: number;
  timestamp: number;
  price: number;
  zone: StructureZone;
  rejectionScore: number;
  reasons: string[];
}

export interface RTRSignal {
  id: string;
  symbol: string;
  timeframe: MarketTimeframe;
  direction: "BUY" | "SELL";
  timestamp: number;
  price: number;
  score: number;
  zoneTimeframe: MarketTimeframe;
  zoneType: ZoneKind;
  rsi: number;
  reason: string[];
  missing: string[];
}

export interface SignalAnalysis {
  signals: RTRSignal[];
  currentSignal: RTRSignal | null;
  rsi: number | null;
  rsiBias: "Bullish" | "Bearish" | "Neutral";
  trend: "Bullish" | "Bearish" | "Neutral";
  latestRetest: RetestEvent | null;
  currentRetest: RetestEvent | null;
}
