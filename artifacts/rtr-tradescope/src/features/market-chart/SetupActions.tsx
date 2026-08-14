import { useState } from "react";
import { BellPlus, Camera, Download, FilePlus2, X } from "lucide-react";
import type { RTRSignal } from "@/features/market-chart/analysis/types";
import type { PriceAlert } from "@/types/domain";

export function SetupActions({ selected, snapshotReady, onSaveAnalysis, onDownload, onLogTrade, onCreateAlert, onViewAlerts }: {
  selected: RTRSignal | null; snapshotReady: boolean; onSaveAnalysis: () => Promise<void>; onDownload: () => void; onLogTrade: () => void;
  onCreateAlert: (alert: PriceAlert) => Promise<void>; onViewAlerts: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<"Above" | "Below">("Above");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const showAlert = () => {
    if (!selected) return;
    setNote(`RTR ${selected.direction} RETEST · ${selected.score}/5\n${selected.zoneTimeframe} ${selected.zoneType}\n${selected.reason.join("\n")}`);
    setTarget(""); setSaved(false); setOpen(true);
  };
  const submit = async () => {
    if (!selected || !(Number(target) > 0)) return;
    setSaving(true);
    try {
      await onCreateAlert({ id: crypto.randomUUID(), instrument: selected.symbol, targetPrice: Number(target), condition, note, status: "Active", createdAt: new Date().toISOString(), source: "RTR_MARKET_CHART", sourceTimeframe: selected.timeframe, sourceSignal: `RTR_${selected.direction}_RETEST`, confluenceScore: selected.score });
      setSaved(true); setOpen(false);
    } finally { setSaving(false); }
  };
  return <>
    <div className="flex flex-wrap gap-2 rounded-xl border border-[#263541] bg-[#121b23] p-3">
      <button data-testid="button-setup-create-alert" disabled={!selected} onClick={showAlert} className="flex items-center gap-1.5 rounded-lg bg-[#315e55] px-3 py-2 text-[10px] font-bold text-[#a2ead4] disabled:opacity-35"><BellPlus size={13}/> Create Alert</button>
      <button data-testid="button-save-analysis" disabled={!selected} onClick={() => void onSaveAnalysis()} className="flex items-center gap-1.5 rounded-lg border border-[#30404c] px-3 py-2 text-[10px] font-semibold text-[#b5c4c8] disabled:opacity-35"><Camera size={13}/> Save Analysis</button>
      <button data-testid="button-download-analysis" disabled={!snapshotReady} onClick={onDownload} className="flex items-center gap-1.5 rounded-lg border border-[#30404c] px-3 py-2 text-[10px] font-semibold text-[#b5c4c8] disabled:opacity-35"><Download size={13}/> Download PNG</button>
      <button data-testid="button-log-this-trade" disabled={!selected} onClick={onLogTrade} className="flex items-center gap-1.5 rounded-lg border border-[#30404c] px-3 py-2 text-[10px] font-semibold text-[#b5c4c8] disabled:opacity-35"><FilePlus2 size={13}/> Log This Trade</button>
      {saved && <button onClick={onViewAlerts} className="ml-auto text-[10px] font-semibold text-[#69d8b5]">Alert saved · View Alerts</button>}
    </div>
    {open && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-[#05080c]/75 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#30404c] bg-[#131d26] p-5 shadow-2xl" role="dialog" aria-label="Create alert from setup">
        <div className="flex items-center justify-between"><div><div className="text-[14px] font-bold text-[#e5eeee]">Create setup alert</div><div className="mt-1 text-[10px] text-[#788993]">{selected.symbol} · {selected.direction} context · signal {selected.price}</div></div><button onClick={() => setOpen(false)}><X size={17}/></button></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[10px] text-[#82939c]">Condition<select data-testid="select-setup-alert-condition" value={condition} onChange={(e) => setCondition(e.target.value as "Above" | "Below")} className="mt-1 w-full rounded-lg border border-[#30404c] bg-[#0c141b] p-2 text-[#d5dfe1]"><option>Above</option><option>Below</option></select></label>
          <label className="text-[10px] text-[#82939c]">Target price<input data-testid="input-setup-alert-target" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-lg border border-[#30404c] bg-[#0c141b] p-2 text-[#d5dfe1]"/></label>
        </div>
        <label className="mt-3 block text-[10px] text-[#82939c]">Note<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-[#30404c] bg-[#0c141b] p-2 text-[#d5dfe1]"/></label>
        <button data-testid="button-save-setup-alert" disabled={saving || !(Number(target) > 0)} onClick={() => void submit()} className="mt-4 w-full rounded-lg bg-[#4ce0b1] py-2.5 text-[11px] font-bold text-[#0c1b18] disabled:opacity-40">{saving ? "Saving…" : "Save Alert"}</button>
      </div>
    </div>}
  </>;
}
