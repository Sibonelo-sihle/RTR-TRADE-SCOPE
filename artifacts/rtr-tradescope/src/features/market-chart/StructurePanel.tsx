import type { AnalysisSettings, SignalAnalysis, StructureAnalysis } from "@/features/market-chart/analysis/types";
import type { MarketSymbol, MarketTimeframe } from "@/types/market";

export function StructurePanel({ symbol, timeframe, analysis, signals, settings }: { symbol: MarketSymbol; timeframe: MarketTimeframe; analysis: StructureAnalysis; signals: SignalAnalysis; settings: AnalysisSettings }) {
  const inside = analysis.zones.filter((zone) => analysis.currentPrice >= zone.lower && analysis.currentPrice <= zone.upper).sort((a, b) => b.strength - a.strength)[0];
  const latestSignal = signals.signals.at(-1);
  const activeSignal = signals.currentSignal;
  const latestLocation = signals.currentRetest?.zone;
  return (
    <aside data-testid="rtr-structure-panel" className="rounded-xl border border-[#263541] bg-[#121b23] p-4">
      <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#4ce0b1]">RTR Market Structure</div>
      <div className="mt-2 text-[11px] text-[#8797a1]">{symbol} · viewing {timeframe}</div>
      <div className="mt-4 space-y-3">
        {(["4H", "1H", "15m", "5m"] as MarketTimeframe[]).map((item) => {
          const zones = analysis.zones.filter((zone) => zone.timeframe === item);
          const demand = zones.find((zone) => zone.kind === "Demand");
          const supply = zones.find((zone) => zone.kind === "Supply");
          return <div key={item} className="border-t border-[#22303a] pt-2 first:border-0 first:pt-0"><div className="text-[10px] font-bold text-[#b8c6ca]">{item}</div><div className="mt-1 grid grid-cols-2 gap-2 text-[9px]"><span className={demand ? "text-[#6dd9b5]" : "text-[#566773]"}>Demand: {demand?.state || "None"}</span><span className={supply ? "text-[#e0958e]" : "text-[#566773]"}>Supply: {supply?.state || "None"}</span></div></div>;
        })}
      </div>
      <div className="mt-4 space-y-2 border-t border-[#22303a] pt-3 text-[9px]"><div><span className="text-[#60727e]">Location: </span><span className="font-semibold text-[#c3d0d3]">{latestLocation ? `${latestLocation.timeframe} ${latestLocation.kind}` : inside ? `${inside.timeframe} ${inside.kind}` : "Between active zones"}</span></div><div><span className="text-[#60727e]">HTF alignment: </span><span className="text-[#b7c7ca]">{latestLocation && (["4H", "1H"].includes(latestLocation.timeframe) || latestLocation.confluence.some((item) => item === "4H" || item === "1H")) ? "YES" : "NO"}</span></div><div><span className="text-[#60727e]">RSI: </span><span className="text-[#b7c7ca]">{signals.rsiBias}{settings.showRsi && signals.rsi !== null ? ` · ${signals.rsi.toFixed(1)}` : ""}</span></div><div><span className="text-[#60727e]">Retest: </span><span className="text-[#b7c7ca]">{signals.currentRetest ? "Confirmed" : "Waiting"}</span></div><div><span className="text-[#60727e]">Trend: </span><span className="text-[#b7c7ca]">{signals.trend}</span></div><div><span className="text-[#60727e]">Confluence: </span><span className="text-[#b7c7ca]">{activeSignal ? `${activeSignal.score}/5` : `Below ${settings.threshold}/5`}</span></div></div>
      <div data-testid="rtr-signal-status" className={`mt-4 rounded-lg border p-2.5 text-center text-[10px] font-bold ${activeSignal?.direction === "BUY" ? "border-[#2c6858] bg-[#17352e] text-[#73dfbe]" : activeSignal?.direction === "SELL" ? "border-[#714348] bg-[#342228] text-[#e79a92]" : "border-[#2c3a45] bg-[#111920] text-[#7d8d97]"}`}>{activeSignal ? `RTR ${activeSignal.direction} RETEST · ${activeSignal.score}/5` : "WAITING"}</div>
      {latestSignal && <div data-testid="rtr-signal-details" className="mt-3 border-t border-[#22303a] pt-3"><div className="text-[9px] font-semibold text-[#aebdc1]">Latest confirmed: RTR {latestSignal.direction} RETEST</div><div className="mt-2 text-[8px] leading-relaxed text-[#71828d]">Confirmed: {latestSignal.reason.join(" · ")}</div>{latestSignal.missing.length > 0 && <div className="mt-1 text-[8px] leading-relaxed text-[#8b7371]">Missing: {latestSignal.missing.join(" · ")}</div>}</div>}
      <div className="mt-3 text-[9px] text-[#61727d]">{analysis.zones.length} ranked zones · {analysis.levels.length} levels · {signals.signals.length} confirmed signals</div>
    </aside>
  );
}
