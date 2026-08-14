import { api } from "@/services/api";
import type { PersistedSwingState, RTRSignal } from "@/features/market-chart/analysis/types";

export const swingState = {
  list: (symbol: string) => api.get<PersistedSwingState[]>(`/api/swings?${new URLSearchParams({ symbol })}`),
  create: (signal: RTRSignal) => api.post<PersistedSwingState>("/api/swings", {
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
  }),
  close: (id: string) => api.put<PersistedSwingState>(`/api/swings/${id}/close`, {}),
  invalidate: (id: string) => api.put<PersistedSwingState>(`/api/swings/${id}/invalidate`, {}),
};
