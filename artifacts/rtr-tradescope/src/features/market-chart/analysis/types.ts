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
  zoneId: string;
  zoneLower: number;
  zoneUpper: number;
  signalKind?: "SWING" | "EXECUTION";
  rsi: number;
  reason: string[];
  missing: string[];
}

export interface SwingTradePlan extends RTRSignal {
  fourHourBias: "BULLISH" | "BEARISH";
  fourHourZoneId: string;
  oneHourSetupId: string;
  atrBuffer: number;
  stop: number;
  tp1: number | null;
  tp2: number | null;
  tp1StructureId: string | null;
  tp2StructureId: string | null;
  rrToTp1: number | null;
  rrToTp2: number | null;
  actionable: boolean;
}

export type SwingStateStatus = "ACTIVE" | "CLOSED" | "INVALIDATED";
export interface PersistedSwingState {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  htf_zone_id: string;
  htf_timeframe: "4H" | "1H";
  signal_timestamp: number;
  entry_timeframe: "15m" | "5m";
  score: number;
  zone_type: ZoneKind;
  zone_lower: number;
  zone_upper: number;
  status: SwingStateStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  four_h_bias: "BULLISH" | "BEARISH" | null;
  four_h_zone_id: string | null;
  one_h_setup_id: string | null;
  entry_price: number | null;
  atr_buffer: number | null;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
  tp1_structure_id: string | null;
  tp2_structure_id: string | null;
  rr_to_tp1: number | null;
  rr_to_tp2: number | null;
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
