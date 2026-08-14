import { api } from "@/services/api";
import type { PersistedSwingState, SwingTradePlan } from "@/features/market-chart/analysis/types";

export const swingState = {
  list: (symbol: string) => api.get<PersistedSwingState[]>(`/api/swings?${new URLSearchParams({ symbol })}`),
  create: (signal: SwingTradePlan) => api.post<PersistedSwingState>("/api/swings", {
    symbol: signal.symbol,
    direction: signal.direction,
    htf_zone_id: signal.zoneId,
    htf_timeframe: signal.zoneTimeframe,
    signal_timestamp: signal.timestamp,
    entry_timeframe: signal.timeframe,
    score: signal.score,
    zone_type: signal.zoneType,
    zone_lower: signal.zoneLower,
    zone_upper: signal.zoneUpper,
    four_h_bias: signal.fourHourBias,
    four_h_zone_id: signal.fourHourZoneId,
    one_h_setup_id: signal.oneHourSetupId,
    entry_price: signal.price,
    atr_buffer: signal.atrBuffer,
    stop: signal.stop,
    tp1: signal.tp1,
    tp2: signal.tp2,
    tp1_structure_id: signal.tp1StructureId,
    tp2_structure_id: signal.tp2StructureId,
    rr_to_tp1: signal.rrToTp1,
    rr_to_tp2: signal.rrToTp2,
  }),
  close: (id: string) => api.put<PersistedSwingState>(`/api/swings/${id}/close`, {}),
  invalidate: (id: string) => api.put<PersistedSwingState>(`/api/swings/${id}/invalidate`, {}),
};
