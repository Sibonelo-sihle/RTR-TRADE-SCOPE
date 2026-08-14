import { deriveLiveAnalysisStatus } from "@/features/market-chart/analysis/liveStatus";
import type { AnalysisSettings, SignalAnalysis, StructureAnalysis } from "@/features/market-chart/analysis/types";
import type { MarketCandle, MarketSymbol, MarketTimeframe } from "@/types/market";

export interface AnalysisActivity { id: string; time: Date; message: string }

const timeframeSeconds: Record<MarketTimeframe, number> = { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 };

function clock(value: Date | null) {
  return value?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "—";
}

function countdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function Check({ label, value }: { label: string; value: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[#83949d]">{label}</span><span className={value ? "text-[#66dcb8]" : "text-[#53646f]"}>{value ? "✓" : "—"}</span></div>;
}

export function StructurePanel({ symbol, timeframe, candles, analysis, signals, settings, lastUpdated, nextRefreshAt, now, activity }: {
  symbol: MarketSymbol;
  timeframe: MarketTimeframe;
  candles: MarketCandle[];
  analysis: StructureAnalysis;
  signals: SignalAnalysis;
  settings: AnalysisSettings;
  lastUpdated: Date | null;
  nextRefreshAt: Date | null;
  now: number;
  activity: AnalysisActivity[];
}) {
  const live = deriveLiveAnalysisStatus(candles, analysis, signals, settings);
  const latestCandle = candles.at(-1);
  const interval = timeframeSeconds[timeframe];
  const secondsToClose = Math.ceil((Math.floor(now / 1000 / interval) + 1) * interval - now / 1000);
  const secondsToRefresh = nextRefreshAt ? Math.ceil((nextRefreshAt.getTime() - now) / 1000) : 0;
  const statusTone = live.state === "BUY RETEST" ? "text-[#73dfbe]" : live.state === "SELL RETEST" ? "text-[#e79a92]" : "text-[#d7e1e3]";
  const statusBackground = live.state === "BUY RETEST" ? "border-[#2c6858] bg-[#17352e]" : live.state === "SELL RETEST" ? "border-[#714348] bg-[#342228]" : "border-[#2c3a45] bg-[#111920]";
  return (
    <aside data-testid="rtr-structure-panel" className="rounded-xl border border-[#263541] bg-[#121b23] p-4">
      <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#4ce0b1]">RTR Market Engine</div>
      <div className="mt-3 rounded-lg border border-[#263b42] bg-[#0e171e] p-3 text-[9px]">
        <div className="font-bold tracking-[.12em] text-[#69dcb9]">● LIVE — ANALYZING</div>
        <div className="mt-1 font-mono text-[8px] tracking-[.1em] text-[#71858e]">LOW-CREDIT BETA MODE</div>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[#82939d]">
          <span>Symbol</span><span className="text-right font-semibold text-[#c5d1d4]">{symbol}</span>
          <span>Timeframe</span><span className="text-right font-semibold text-[#c5d1d4]">{timeframe}</span>
          <span>Last candle</span><span className="text-right text-[#aebdc1]">{latestCandle ? clock(new Date(latestCandle.time * 1000)) : "—"}</span>
          <span>Next candle close</span><span className="text-right text-[#aebdc1]">{countdown(secondsToClose)}</span>
          <span>Current price</span><span className="text-right text-[#aebdc1]">{latestCandle?.close.toFixed(symbol === "XAUUSD" ? 2 : 5) ?? "—"}</span>
        </div>
        <div className="mt-2 border-t border-[#22303a] pt-2 text-[#657781]">Last data update: {clock(lastUpdated)}<br />Next market refresh: {nextRefreshAt ? countdown(secondsToRefresh) : "—"}</div>
      </div>
      <div className="mt-4 font-mono text-[9px] uppercase tracking-[.16em] text-[#82949d]">Current Setup</div>
      <div className="mt-2 space-y-1.5 text-[9px]">
        <div className="flex justify-between gap-3"><span className="text-[#60727e]">Direction</span><span className="font-semibold text-[#c3d0d3]">{live.direction}</span></div>
        <div className="flex justify-between gap-3"><span className="text-[#60727e]">Zone</span><span className="font-semibold text-[#c3d0d3]">{live.zone?.kind.toUpperCase() ?? "NONE"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-[#60727e]">Zone status</span><span className="font-semibold text-[#c3d0d3]">{live.zone?.state.toUpperCase() ?? "NONE"}</span></div>
      </div>
      <div className="mt-4 border-t border-[#22303a] pt-3">
        <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#82949d]">RTR Confluence</div>
        <div className="mt-2 space-y-1.5 text-[9px]"><Check label="Zone Location" value={live.checks.zone} /><Check label="HTF Alignment" value={live.checks.htf} /><Check label="S/R Alignment" value={live.checks.supportResistance} /><Check label="RSI Confirmation" value={live.checks.rsi} /><Check label="Retest / Rejection" value={live.checks.retest} /><Check label="Trend" value={live.checks.trend} /></div>
        <div className="mt-3 flex items-end justify-between"><span className="text-[9px] text-[#647680]">Configured threshold {settings.threshold}/5</span><span className="text-[18px] font-bold text-[#d9e4e5]">{live.score === null ? "—" : live.score} <span className="text-[10px] text-[#687a84]">/ 5</span></span></div>
      </div>
      {live.potentialSetup && <div data-testid="rtr-potential-setup" className="mt-3 rounded-lg border border-[#665b38] bg-[#282417] p-2.5 text-center"><div className="text-[9px] font-bold text-[#d6bd69]">POTENTIAL SETUP</div><div className="mt-1 text-[9px] text-[#a7996e]">Waiting for candle close</div></div>}
      <div data-testid="rtr-signal-status" className={`mt-3 rounded-lg border p-2.5 text-center ${statusBackground}`}><div className={`text-[10px] font-bold ${statusTone}`}>{live.state}{live.score !== null ? ` · ${live.score}/5` : ""}</div><div className="mt-1 text-[9px] leading-relaxed text-[#83939c]">{live.reason}</div></div>
      <div className="mt-4 border-t border-[#22303a] pt-3"><div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#82949d]">Analysis Activity</div><div className="mt-2 space-y-1.5 text-[8px] leading-relaxed text-[#73858e]">{activity.length ? activity.map((event) => <div key={event.id}><span className="text-[#536670]">{event.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> — {event.message}</div>) : <div>Waiting for the first market-data analysis.</div>}</div></div>
      <div className="mt-3 text-[9px] text-[#61727d]">{analysis.zones.length} ranked zones · {analysis.levels.length} levels · {signals.signals.length} confirmed signals</div>
    </aside>
  );
}
