import type { RTRSignal } from "@/features/market-chart/analysis/types";

export function SelectedSetup({ selected, signals, onSelect }: { selected: RTRSignal | null; signals: RTRSignal[]; onSelect: (signal: RTRSignal) => void }) {
  return <section className="rounded-xl border border-[#263541] bg-[#121b23] p-3" data-testid="selected-setup-card">
    <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#4ce0b1]">Selected setup</div>
    {selected ? <div className="mt-2">
      <div className={`text-[13px] font-bold ${selected.direction === "BUY" ? "text-[#63dbb6]" : "text-[#ec8178]"}`}>RTR {selected.direction} RETEST</div>
      <div className="mt-1 text-[10px] text-[#84959e]">{selected.symbol} · {selected.timeframe} · Score {selected.score}/5</div>
      <div className="mt-2 space-y-1 text-[10px] text-[#aab8bd]">
        <div>{selected.zoneTimeframe} {selected.zoneType} · {selected.price.toFixed(selected.symbol === "XAUUSD" ? 2 : 5)}</div>
        <div>RSI {selected.rsi.toFixed(1)}</div>
        {selected.reason.slice(0, 4).map((reason) => <div key={reason}>• {reason}</div>)}
      </div>
    </div> : <div className="mt-2 text-[10px] leading-relaxed text-[#74858f]">Select a signal marker or a recent setup below.</div>}
    {signals.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">
      {signals.slice(-6).reverse().map((signal) => <button key={signal.id} data-testid={`select-setup-${signal.id}`} onClick={() => onSelect(signal)} className={`rounded-md border px-2 py-1 text-[9px] ${selected?.id === signal.id ? "border-[#4ce0b1] bg-[#24443d] text-[#89e3c8]" : "border-[#30404c] text-[#82939c] hover:text-[#c2d0d3]"}`}>{signal.direction} {signal.score}/5</button>)}
    </div>}
  </section>;
}
