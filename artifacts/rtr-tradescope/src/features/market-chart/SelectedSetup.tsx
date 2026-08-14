import type { RTRSignal } from "@/features/market-chart/analysis/types";

export function SelectedSetup({ selected, signals, onSelect }: { selected: RTRSignal | null; signals: RTRSignal[]; onSelect: (signal: RTRSignal) => void }) {
  const passed = selected?.reason ?? [];
  const structure = passed.find((item) => item === "Higher-timeframe structure" || item === "Structural support" || item === "Structural resistance");
  const rsi = passed.find((item) => item.startsWith("RSI "));
  const trend = passed.find((item) => item.startsWith("EMA ") || item === "Market-structure momentum");
  return <section className="rounded-xl border border-[#263541] bg-[#121b23] p-3" data-testid="selected-setup-card">
    <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#4ce0b1]">Selected setup</div>
    {selected ? <div className="mt-2">
      <div className={`text-[13px] font-bold ${selected.direction === "BUY" ? "text-[#63dbb6]" : "text-[#ec8178]"}`}>RTR {selected.direction} RETEST</div>
      <div className="mt-1 text-[10px] text-[#84959e]">{selected.symbol} · {selected.timeframe} · Score {selected.score}/5</div>
      <div className="mt-1 text-[9px] text-[#687a84]">{new Date(selected.timestamp * 1000).toLocaleString()}</div>
      <div className="mt-2 space-y-1 text-[10px] text-[#aab8bd]">
        <div>{selected.zoneTimeframe} {selected.zoneType} ✓ · {selected.price.toFixed(selected.symbol === "XAUUSD" ? 2 : 5)}</div>
        <div>{structure ? `${structure} ✓` : "HTF/S&R alignment —"}</div>
        <div>{rsi ? `${rsi} ✓ · ${selected.rsi.toFixed(1)}` : `RSI confirmation — · ${selected.rsi.toFixed(1)}`}</div>
        <div>Retest / rejection confirmed ✓</div>
        <div>{trend ? `${trend} ✓` : "Trend confirmation —"}</div>
        <div className="pt-1 text-[9px] text-[#788a93]">Passed: {passed.join(" · ")}</div>
        {selected.score < 5 && <div className="text-[9px] text-[#947d79]">Missing: {selected.missing.length ? selected.missing.join(" · ") : "One confluence point"}</div>}
      </div>
    </div> : <div className="mt-2 text-[10px] leading-relaxed text-[#74858f]">Select a signal marker or a recent setup below.</div>}
    {signals.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">
      {signals.slice(-6).reverse().map((signal) => <button key={signal.id} data-testid={`select-setup-${signal.id}`} onClick={() => onSelect(signal)} className={`rounded-md border px-2 py-1 text-[9px] ${selected?.id === signal.id ? "border-[#4ce0b1] bg-[#24443d] text-[#89e3c8]" : "border-[#30404c] text-[#82939c] hover:text-[#c2d0d3]"}`}>{signal.direction} {signal.score}/5</button>)}
    </div>}
  </section>;
}
