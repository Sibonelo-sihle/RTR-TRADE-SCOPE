import { Activity, BarChart3, DatabaseZap, ShieldCheck } from "lucide-react";

const syntheticMarkets = [
  { name: "Volatility 75 Index", family: "Volatility", short: "V75" },
  { name: "Volatility 100 Index", family: "Volatility", short: "V100" },
  { name: "Boom 1000 Index", family: "Boom", short: "B1000" },
  { name: "Crash 1000 Index", family: "Crash", short: "C1000" },
  { name: "Boom 500 Index", family: "Boom", short: "B500" },
  { name: "Crash 500 Index", family: "Crash", short: "C500" },
] as const;

const futurePipeline = [
  "Deriv market data",
  "RTR candles",
  "4H structure",
  "1H setup",
  "15m/5m entry confirmation",
  "RTR Swing Planner",
] as const;

export function SyntheticMarketsPage() {
  return (
    <div>
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#4ce0b1]">
            Deriv workspace
          </div>
          <h1 className="mt-2 text-[26px] font-bold tracking-[-.04em] text-[#eef5f4] sm:text-[30px]">
            Synthetic Markets
          </h1>
          <p className="mt-1 text-[11px] text-[#71818d]">
            RTR analysis for synthetic indices
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#55462b] bg-[#2a2418] px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#dabd72]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4a84e]" />
          Data Provider: Not Connected
        </div>
      </header>

      <section aria-labelledby="synthetic-market-list">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="synthetic-market-list" className="text-[13px] font-bold text-[#dbe6e7]">
            Synthetic instruments
          </h2>
          <span className="font-mono text-[8px] uppercase tracking-[.14em] text-[#586b76]">
            Awaiting Deriv connection
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {syntheticMarkets.map((market) => (
            <article key={market.name} className="group rounded-xl border border-[#263642] bg-[#131b24] p-4 transition-colors hover:border-[#35504f]">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#2b4846] bg-[#18302f] font-mono text-[9px] font-bold text-[#74ddbf]">
                  {market.short}
                </div>
                <span className="rounded border border-[#37424a] bg-[#192129] px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] text-[#71818d]">
                  Pending
                </span>
              </div>
              <h3 className="mt-4 text-[13px] font-bold text-[#d8e3e5]">{market.name}</h3>
              <div className="mt-1 text-[9px] uppercase tracking-[.12em] text-[#60727d]">{market.family} series</div>
              <div className="mt-4 flex items-center gap-2 border-t border-[#202e38] pt-3 text-[9px] text-[#778892]">
                <DatabaseZap size={13} className="text-[#697c85]" />
                Deriv market data connection pending
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[#263642] bg-[#111a22] p-5" aria-labelledby="synthetic-pipeline">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#203b3a] text-[#70dbbc]"><Activity size={17} /></div>
          <div>
            <h2 id="synthetic-pipeline" className="text-[13px] font-bold text-[#dbe6e7]">Prepared RTR analysis flow</h2>
            <p className="mt-1 text-[10px] text-[#71818d]">The workspace is isolated from Twelve Data and ready for a dedicated Deriv provider.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {futurePipeline.map((step, index) => (
            <div key={step} className="relative rounded-lg border border-[#25343e] bg-[#0e161d] p-3">
              <div className="font-mono text-[8px] text-[#4f665f]">{String(index + 1).padStart(2, "0")}</div>
              <div className="mt-2 text-[10px] font-semibold leading-snug text-[#aebdc1]">{step}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-[9px] text-[#637680]">
          <ShieldCheck size={13} className="text-[#60bba2]" />
          No prices, candles, zones, or signals are generated until verified Deriv data is connected.
        </div>
      </section>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#23313c] bg-[#0f171e] px-4 py-3 text-[9px] text-[#637680]">
        <BarChart3 size={14} /> Existing forex and metals analysis remains available in RTR Market Chart.
      </div>
    </div>
  );
}
