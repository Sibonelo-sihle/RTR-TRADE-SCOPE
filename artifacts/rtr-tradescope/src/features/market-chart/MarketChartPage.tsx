import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, CandlestickChart, RefreshCw } from "lucide-react";
import { MarketChart, type MarketChartHandle } from "@/features/market-chart/MarketChart";
import { SelectedSetup } from "@/features/market-chart/SelectedSetup";
import { SetupActions } from "@/features/market-chart/SetupActions";
import { chartSnapshot, downloadSnapshot, snapshotFilename } from "@/features/market-chart/services/snapshot";
import { sessionForTimestamp, tradePrefill } from "@/features/market-chart/services/tradePrefill";
import { StructureControls } from "@/features/market-chart/StructureControls";
import { StructurePanel } from "@/features/market-chart/StructurePanel";
import { AnalysisSettings } from "@/features/market-chart/AnalysisSettings";
import { analyzeMultiTimeframe } from "@/features/market-chart/analysis/multiTimeframe";
import { analyzeSignals } from "@/features/market-chart/analysis/signals";
import type { AnalysisSettings as SignalSettings, RTRSignal, StructureVisibility } from "@/features/market-chart/analysis/types";
import type { PriceAlert } from "@/types/domain";
import { marketData } from "@/services/marketData";
import { toast } from "@/hooks/use-toast";
import type { MarketCandle, MarketDataStatus, MarketSymbol, MarketTimeframe } from "@/types/market";

const symbols: MarketSymbol[] = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];
const timeframes: MarketTimeframe[] = ["5m", "15m", "1H", "4H"];
const pollIntervals: Record<MarketTimeframe, number> = { "5m": 300_000, "15m": 900_000, "1H": 3_600_000, "4H": 14_400_000 };

function formatClock(value: Date | null) {
  return value?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "—";
}

function sameCandles(first: MarketCandle[] | undefined, second: MarketCandle[]) {
  if (!first || first.length !== second.length) return false;
  return first.every((candle, index) => {
    const other = second[index];
    return candle.time === other.time && candle.open === other.open && candle.high === other.high && candle.low === other.low && candle.close === other.close && candle.volume === other.volume;
  });
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Market data is unavailable.";
  try {
    const parsed = JSON.parse(error.message) as { detail?: string | { detail?: string } };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (typeof parsed.detail === "object" && parsed.detail?.detail) return parsed.detail.detail;
  } catch {
    // The backend may return a plain-text error.
  }
  return error.message;
}

export function MarketChartPage({ createAlert }: { createAlert: (alert: PriceAlert) => Promise<PriceAlert> }) {
  const [, setLocation] = useLocation();
  const chartRef = useRef<MarketChartHandle>(null);
  const [symbol, setSymbol] = useState<MarketSymbol>("XAUUSD");
  const [timeframe, setTimeframe] = useState<MarketTimeframe>("15m");
  const [status, setStatus] = useState<MarketDataStatus | null>(null);
  const [candleSets, setCandleSets] = useState<Record<MarketTimeframe, MarketCandle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [visibility, setVisibility] = useState<StructureVisibility>({ supply: true, demand: true, levels: true, hideMitigated: false, timeframes: { "4H": true, "1H": true, "15m": true, "5m": true } });
  const [signalSettings, setSignalSettings] = useState<SignalSettings>({ rsiLength: 14, rsiOversold: 30, rsiOverbought: 70, threshold: 4, trendEnabled: true, emaLength: 50, retestSensitivity: 2, rejectionSensitivity: 2, cooldownBars: 20, showMarkers: true, showRsi: false });
  const [selected, setSelected] = useState<RTRSignal | null>(null);
  const [snapshot, setSnapshot] = useState<{ blob: Blob; filename: string } | null>(null);
  const candleSetsRef = useRef(candleSets);
  const statusRef = useRef(status);
  const reconnectingRef = useRef(reconnecting);
  const refreshingRef = useRef(false);
  const requestVersion = useRef(0);
  const dueAt = useRef<Record<MarketTimeframe, number>>({ "5m": 0, "15m": 0, "1H": 0, "4H": 0 });
  const notifiedSignals = useRef(new Set<string>());
  const signalBaselineScopes = useRef(new Set<string>());
  const lastClosedByScope = useRef(new Map<string, number>());
  candleSetsRef.current = candleSets;
  statusRef.current = status;
  reconnectingRef.current = reconnecting;

  const refresh = useCallback(async (requested: MarketTimeframe[], initial = false) => {
    if (refreshingRef.current && !initial) return;
    refreshingRef.current = true;
    const version = requestVersion.current;
    if (initial) setLoading(true);
    try {
      const providerStatus = initial || reconnectingRef.current || !statusRef.current ? await marketData.getStatus() : statusRef.current;
      if (version !== requestVersion.current) return;
      setStatus(providerStatus);
      if (!providerStatus.connected) throw new Error(providerStatus.detail || `${providerStatus.provider} is offline.`);
      const entries = await Promise.all(requested.map(async (item) => [item, await marketData.getCandles(symbol, item)] as const));
      if (version !== requestVersion.current) return;
      if (entries.some(([, values]) => !values.length)) throw new Error("The provider returned an empty timeframe required for structure analysis.");
      const previous = candleSetsRef.current;
      const nextSets = { ...(previous ?? {}), ...Object.fromEntries(entries) } as Record<MarketTimeframe, MarketCandle[]>;
      if (timeframes.every((item) => nextSets[item]?.length)) {
        if (!previous || entries.some(([item, values]) => !sameCandles(previous[item], values))) setCandleSets(nextSets);
        const refreshedAt = new Date();
        setLastUpdated(refreshedAt);
        setError("");
        setReconnecting(false);
      }
      const completedAt = Date.now();
      for (const item of requested) dueAt.current[item] = completedAt + pollIntervals[item];
      setNextRefreshAt(new Date(Math.min(...Object.values(dueAt.current).filter((value) => value > completedAt))));
    } catch (caught) {
      setError(errorMessage(caught));
      setReconnecting(true);
      const retryAt = Date.now() + 30_000;
      for (const item of requested) dueAt.current[item] = retryAt;
      setNextRefreshAt(new Date(retryAt));
    } finally {
      refreshingRef.current = false;
      if (version === requestVersion.current) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    requestVersion.current += 1;
    candleSetsRef.current = null;
    setCandleSets(null);
    setStatus(null);
    setError("");
    setReconnecting(false);
    setLastUpdated(null);
    notifiedSignals.current.clear();
    signalBaselineScopes.current.clear();
    lastClosedByScope.current.clear();
    const startedAt = Date.now();
    dueAt.current = Object.fromEntries(timeframes.map((item) => [item, startedAt + pollIntervals[item]])) as Record<MarketTimeframe, number>;
    void refresh(timeframes, true);
  }, [refresh, symbol]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (loading || refreshingRef.current) return;
      const due = timeframes.filter((item) => dueAt.current[item] <= current);
      if (due.length) void refresh(due);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [loading, refresh]);

  const confirmedCandleSets = useMemo(() => candleSets ? Object.fromEntries(timeframes.map((item) => [item, candleSets[item].slice(0, -1)])) as Record<MarketTimeframe, MarketCandle[]> : null, [candleSets]);
  const analysis = useMemo(() => confirmedCandleSets ? analyzeMultiTimeframe(confirmedCandleSets) : null, [confirmedCandleSets]);
  const visibleZones = useMemo(() => analysis?.zones.filter((zone) => visibility.timeframes[zone.timeframe] && (zone.kind === "Supply" ? visibility.supply : visibility.demand) && (!visibility.hideMitigated || zone.state !== "Mitigated")) ?? [], [analysis, visibility]);
  const visibleLevels = useMemo(() => analysis?.levels.filter((level) => visibility.levels && visibility.timeframes[level.timeframe]) ?? [], [analysis, visibility]);
  const candles = candleSets?.[timeframe] ?? [];
  const signalAnalysis = useMemo(() => analysis && candles.length ? analyzeSignals(symbol, timeframe, candles, analysis, signalSettings) : null, [analysis, candles, signalSettings, symbol, timeframe]);
  useEffect(() => {
    if (!signalAnalysis) return;
    const scope = `${symbol}:${timeframe}`;
    const latestClosed = candles.at(-2)?.time ?? 0;
    const previouslyClosed = lastClosedByScope.current.get(scope) ?? latestClosed;
    const ids = signalAnalysis.signals.map((signal) => `${signal.symbol}:${signal.timeframe}:${signal.timestamp}:${signal.direction}`);
    if (!signalBaselineScopes.current.has(scope)) {
      ids.forEach((id) => notifiedSignals.current.add(id));
      signalBaselineScopes.current.add(scope);
      lastClosedByScope.current.set(scope, latestClosed);
      return;
    }
    for (const signal of signalAnalysis.signals) {
      const id = `${signal.symbol}:${signal.timeframe}:${signal.timestamp}:${signal.direction}`;
      if (notifiedSignals.current.has(id) || signal.timestamp <= previouslyClosed) continue;
      notifiedSignals.current.add(id);
      toast({ title: `New RTR ${signal.direction} signal`, description: `${signal.symbol} · ${signal.timeframe} · ${formatClock(new Date(signal.timestamp * 1000))}` });
    }
    lastClosedByScope.current.set(scope, latestClosed);
  }, [candles, signalAnalysis, symbol, timeframe]);
  useEffect(() => { setSelected(null); setSnapshot(null); }, [symbol, timeframe]);
  const saveAnalysis = async () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) throw new Error("Chart is not ready");
    setSnapshot({ blob: await chartSnapshot(canvas), filename: snapshotFilename(symbol, timeframe) });
  };
  const logTrade = () => {
    if (!selected) return;
    tradePrefill.save({ symbol: selected.symbol, direction: selected.direction, date: new Date(selected.timestamp * 1000).toISOString().slice(0, 10), session: sessionForTimestamp(selected.timestamp), strategy: "RTR Retest", notes: [`RTR ${selected.direction} RETEST · ${selected.score}/5`, `${selected.zoneTimeframe} ${selected.zoneType}`, ...selected.reason].join("\n") });
    setLocation("/add-trade");
  };

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[.2em] text-[#4ce0b1]">RTR analysis workspace</div>
          <h1 className="text-[28px] font-bold tracking-[-.04em] text-[#e7eeee]">RTR Market Chart</h1>
          <p className="mt-2 text-[12px] text-[#71818d]">RTR-powered market structure analysis</p>
        </div>
        <div data-testid="market-provider-status" className="flex items-center gap-3 rounded-xl border border-[#2b3b46] bg-[#141e27] px-3 py-2 text-[10px] text-[#91a1aa]">
          <span className={`h-1.5 w-1.5 rounded-full ${!reconnecting && status?.connected ? "bg-[#4ce0b1]" : "bg-[#dd776f]"}`} />
          <div>
            <div className={`font-bold tracking-[.12em] ${reconnecting ? "text-[#df8a72]" : "text-[#4ce0b1]"}`}>{reconnecting ? "RECONNECTING" : status?.connected ? "LIVE" : "CONNECTING"} · {symbol}</div>
            <div>Last updated: {formatClock(lastUpdated)} · Next refresh: {nextRefreshAt ? `${Math.max(0, Math.ceil((nextRefreshAt.getTime() - now) / 1000))}s` : "…"}</div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#263541] bg-[#121b23] p-3">
        <select data-testid="select-market-symbol" aria-label="Market symbol" value={symbol} onChange={(event) => setSymbol(event.target.value as MarketSymbol)} className="rounded-lg border border-[#30404c] bg-[#0c141b] px-3 py-2 text-[11px] font-semibold text-[#d4dfe1]">
          {symbols.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div className="flex rounded-lg border border-[#30404c] bg-[#0c141b] p-1">
          {timeframes.map((item) => <button key={item} data-testid={`button-timeframe-${item}`} onClick={() => setTimeframe(item)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${timeframe === item ? "bg-[#315e55] text-[#9ae5ce]" : "text-[#71818d] hover:text-[#b8c6ca]"}`}>{item}</button>)}
        </div>
        <StructureControls value={visibility} onChange={setVisibility} />
        <AnalysisSettings value={signalSettings} onChange={setSignalSettings} />
        <button data-testid="button-refresh-market-data" onClick={() => void refresh(timeframes)} disabled={loading} className="ml-auto rounded-lg border border-[#30404c] p-2 text-[#82939c] hover:bg-[#1b2933] disabled:opacity-40" aria-label="Refresh market data"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <SetupActions selected={selected} snapshotReady={Boolean(snapshot)} onSaveAnalysis={saveAnalysis} onDownload={() => snapshot && downloadSnapshot(snapshot.blob, snapshot.filename)} onLogTrade={logTrade} onCreateAlert={async (alert) => { await createAlert(alert); }} onViewAlerts={() => setLocation("/alerts")} />
        <SelectedSetup selected={selected} signals={signalAnalysis?.signals ?? []} onSelect={setSelected} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-[#273541] bg-[#0d1118] shadow-[0_18px_50px_rgba(0,0,0,.22)]" style={{ height: "clamp(520px, 70vh, 760px)" }}>
          {candles.length > 0 && analysis && signalAnalysis && <MarketChart ref={chartRef} candles={candles} zones={visibleZones} levels={visibleLevels} signals={signalSettings.showMarkers ? signalAnalysis.signals : []} onSelectSignal={setSelected} />}
          {(loading || (error && !candles.length)) && <div className="absolute inset-0 grid place-items-center bg-[#0d1118] p-6 text-center">
            {loading ? <div><RefreshCw size={22} className="mx-auto animate-spin text-[#4ce0b1]" /><div className="mt-3 text-[11px] text-[#7f909a]">Loading real {symbol} multi-timeframe structure…</div></div> : <div className="max-w-md"><AlertTriangle size={24} className="mx-auto text-[#df8a72]" /><div className="mt-3 text-[13px] font-bold text-[#d9e3e4]">Market data unavailable</div><div role="alert" className="mt-2 text-[11px] leading-relaxed text-[#81909a]">{error}</div></div>}
          </div>}
        </div>
        {analysis && signalAnalysis && <StructurePanel symbol={symbol} timeframe={timeframe} analysis={analysis} signals={signalAnalysis} settings={signalSettings} />}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#62737e]"><CandlestickChart size={13} /> Candles and future RTR analysis use the same provider dataset. Analysis only — no trade execution.</div>
    </>
  );
}
