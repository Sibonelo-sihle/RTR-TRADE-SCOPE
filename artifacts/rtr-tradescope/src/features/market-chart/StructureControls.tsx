import type { StructureVisibility } from "@/features/market-chart/analysis/types";
import type { MarketTimeframe } from "@/types/market";

export function StructureControls({ value, onChange }: { value: StructureVisibility; onChange: (value: StructureVisibility) => void }) {
  const toggle = (key: "supply" | "demand" | "levels" | "hideMitigated") => onChange({ ...value, [key]: !value[key] });
  const timeframe = (item: MarketTimeframe) => onChange({ ...value, timeframes: { ...value.timeframes, [item]: !value.timeframes[item] } });
  const control = (active: boolean) => `rounded-md px-2.5 py-1.5 text-[9px] font-semibold transition-colors ${active ? "bg-[#285247] text-[#91e0c6]" : "text-[#71818d] hover:text-[#b8c6ca]"}`;
  return (
    <div data-testid="rtr-structure-controls" className="flex flex-wrap items-center gap-1 rounded-lg border border-[#30404c] bg-[#0c141b] p-1">
      <span className="px-2 font-mono text-[8px] uppercase tracking-wider text-[#5f727e]">RTR Structure</span>
      <button data-testid="toggle-structure-supply" onClick={() => toggle("supply")} className={control(value.supply)}>Supply</button>
      <button data-testid="toggle-structure-demand" onClick={() => toggle("demand")} className={control(value.demand)}>Demand</button>
      <button data-testid="toggle-structure-levels" onClick={() => toggle("levels")} className={control(value.levels)}>S/R</button>
      {(["4H", "1H", "15m", "5m"] as MarketTimeframe[]).map((item) => <button key={item} data-testid={`toggle-structure-${item}`} onClick={() => timeframe(item)} className={control(value.timeframes[item])}>{item}</button>)}
      <button data-testid="toggle-hide-mitigated" onClick={() => toggle("hideMitigated")} className={control(value.hideMitigated)}>Hide mitigated</button>
    </div>
  );
}
