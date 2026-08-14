import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CandlestickSeries, ColorType, CrosshairMode, createChart, createSeriesMarkers, LineStyle, type IChartApi, type IPriceLine, type ISeriesApi, type SeriesMarker, type UTCTimestamp } from "lightweight-charts";
import { StructureOverlay } from "@/features/market-chart/StructureOverlay";
import { signalMarkers } from "@/features/market-chart/services/signalMarkers";
import type { PersistedSwingState, RTRSignal, StructureLevel, StructureZone } from "@/features/market-chart/analysis/types";
import type { MarketCandle } from "@/types/market";

export interface MarketChartHandle { takeScreenshot: () => HTMLCanvasElement | null }

export const MarketChart = forwardRef<MarketChartHandle, { candles: MarketCandle[]; zones: StructureZone[]; levels: StructureLevel[]; signals: RTRSignal[]; activePlan?: PersistedSwingState | null; onSelectSignal?: (signal: RTRSignal) => void }>(function MarketChart({ candles, zones, levels, signals, activePlan, onSelectSignal }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const overlay = useRef<StructureOverlay | null>(null);
  const markerApi = useRef<{ setMarkers: (markers: SeriesMarker<UTCTimestamp>[]) => void } | null>(null);
  const seriesApi = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const planLines = useRef<IPriceLine[]>([]);
  const signalsRef = useRef(signals);
  const selectRef = useRef(onSelectSignal);
  signalsRef.current = signals;
  selectRef.current = onSelectSignal;
  useImperativeHandle(ref, () => ({ takeScreenshot: () => chartApi.current?.takeScreenshot(true, false) ?? null }), []);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const chart = createChart(node, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#0d1118" }, textColor: "#81909b", attributionLogo: true },
      grid: { vertLines: { color: "#1a2530" }, horzLines: { color: "#1a2530" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2a3946", scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "#2a3946", timeVisible: true, secondsVisible: false, rightOffset: 5 },
    });
    chartApi.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#4ce0b1",
      downColor: "#ec6f68",
      borderUpColor: "#4ce0b1",
      borderDownColor: "#ec6f68",
      wickUpColor: "#75d8bc",
      wickDownColor: "#db7772",
    });
    seriesApi.current = series;
    series.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    const structure = new StructureOverlay(zones, levels);
    series.attachPrimitive(structure);
    overlay.current = structure;
    markerApi.current = createSeriesMarkers(series, signalMarkers(signals));
    chart.subscribeClick((param) => {
      if (!param.time) return;
      const signal = signalsRef.current.find((item) => item.timestamp === Number(param.time));
      if (signal) selectRef.current?.(signal);
    });
    chart.timeScale().fitContent();
    return () => {
      overlay.current = null;
      markerApi.current = null;
      seriesApi.current = null;
      chartApi.current = null;
      chart.remove();
    };
    // Structure visibility updates the primitive separately so toggles preserve zoom/pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  useEffect(() => { overlay.current?.update(zones, levels); }, [zones, levels]);
  useEffect(() => { markerApi.current?.setMarkers(signalMarkers(signals)); }, [signals]);
  useEffect(() => {
    const series = seriesApi.current;
    if (!series) return;
    for (const line of planLines.current) series.removePriceLine(line);
    planLines.current = [];
    if (!activePlan?.entry_price || !activePlan.stop) return;
    const tp1 = activePlan.tp1 == null ? null : Number(activePlan.tp1);
    const tp2 = activePlan.tp2 == null ? null : Number(activePlan.tp2);
    const levels = [
      { price: Number(activePlan.entry_price), title: "ENTRY", color: "#d7e1e3", style: LineStyle.Solid },
      { price: Number(activePlan.stop), title: "STOP", color: "#ec8178", style: LineStyle.Solid },
      ...(tp1 !== null && Number.isFinite(tp1) ? [{ price: tp1, title: "TP1", color: "#65cfae", style: LineStyle.Dashed }] : []),
      ...(tp2 !== null && Number.isFinite(tp2) ? [{ price: tp2, title: "TP2", color: "#4ce0b1", style: LineStyle.Solid }] : []),
    ];
    planLines.current = levels.map((level) => series.createPriceLine({ ...level, lineWidth: 2, axisLabelVisible: true, lineVisible: true }));
    series.priceScale().applyOptions({ autoScale: true });
  }, [activePlan, candles]);

  return <div ref={container} data-testid="rtr-market-chart-canvas" className="h-full min-h-[520px] w-full" />;
});
