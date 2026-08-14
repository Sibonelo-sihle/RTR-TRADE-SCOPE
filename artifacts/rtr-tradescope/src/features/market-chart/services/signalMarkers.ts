import type { SeriesMarker, UTCTimestamp } from "lightweight-charts";
import type { RTRSignal } from "@/features/market-chart/analysis/types";

export function signalMarkers(signals: RTRSignal[]): SeriesMarker<UTCTimestamp>[] {
  return signals.map((signal) => ({
    time: signal.timestamp as UTCTimestamp,
    position: signal.direction === "BUY" ? "belowBar" : "aboveBar",
    color: signal.direction === "BUY" ? "#4ce0b1" : "#ec8178",
    shape: signal.direction === "BUY" ? "arrowUp" : "arrowDown",
    text: `RTR ${signal.direction} RETEST ${signal.score}/5`,
    size: 1,
  }));
}
