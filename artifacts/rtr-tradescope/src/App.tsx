import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Link, Router as WouterRouter, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Download,
  Edit3,
  FileText,
  Filter,
  Gauge,
  Layers3,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PriceAlert as Alert,
  Session,
  Settings as WorkspaceSettings,
  Strategy,
  Trade,
  TradeResult as Result,
  TradeStatus as Status,
} from "@/types/domain";
import {
  alertStorage,
  defaultSettings,
  exportWorkspace,
  resetStorage,
  settingsStorage,
  strategyStorage,
  tradeStorage,
} from "@/services/storage";
import { usePersistentState } from "@/hooks/usePersistentState";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { MarketChartPage } from "@/features/market-chart/MarketChartPage";
import { tradePrefill } from "@/features/market-chart/services/tradePrefill";
import { alertResource, strategyResource, tradeResource, useBackendCollection } from "@/services/backendData";
import { toast } from "@/hooks/use-toast";
import {
  calculateTrade,
  directionPnl,
  summary,
  validateTrade,
} from "@/utils/tradeAnalytics";

const initialTrades: Trade[] = [
  {
    id: "tr-01",
    symbol: "NVDA",
    direction: "BUY",
    entry: 872.4,
    stopLoss: 856.2,
    takeProfit: 914.8,
    exit: 914.8,
    positionSize: 18,
    date: "2025-02-21",
    session: "New York",
    strategy: "Opening Range",
    status: "Closed",
    result: "Win",
    notes:
      "Clean break and retest of the opening range. Held through first pullback.",
    pnl: 763.2,
    rMultiple: 2.62,
    rr: 2.62,
  },
  {
    id: "tr-02",
    symbol: "EURUSD",
    direction: "SELL",
    entry: 1.0842,
    stopLoss: 1.0876,
    takeProfit: 1.0768,
    exit: 1.0768,
    positionSize: 100000,
    date: "2025-02-20",
    session: "London",
    strategy: "London Sweep",
    status: "Closed",
    result: "Win",
    notes: "Liquidity sweep into daily level. Waited for displacement.",
    pnl: 682.4,
    rMultiple: 2.18,
    rr: 2.18,
  },
  {
    id: "tr-03",
    symbol: "TSLA",
    direction: "BUY",
    entry: 342.1,
    stopLoss: 335.6,
    takeProfit: 358.2,
    exit: 337.8,
    positionSize: 42,
    date: "2025-02-19",
    session: "New York",
    strategy: "VWAP Reclaim",
    status: "Closed",
    result: "Loss",
    notes: "Entered early before reclaim was confirmed. Process miss.",
    pnl: -180.6,
    rMultiple: -0.66,
    rr: 2.48,
  },
  {
    id: "tr-04",
    symbol: "ES",
    direction: "SELL",
    entry: 6048.25,
    stopLoss: 6062.5,
    takeProfit: 6011.5,
    exit: 6011.5,
    positionSize: 2,
    date: "2025-02-18",
    session: "Overlap",
    strategy: "Liquidity Fade",
    status: "Closed",
    result: "Win",
    notes: "Faded failed auction at prior week high.",
    pnl: 735,
    rMultiple: 2.58,
    rr: 2.58,
  },
  {
    id: "tr-05",
    symbol: "AAPL",
    direction: "BUY",
    entry: 244.8,
    stopLoss: 241.2,
    takeProfit: 251.4,
    exit: 248.6,
    positionSize: 36,
    date: "2025-02-17",
    session: "New York",
    strategy: "Opening Range",
    status: "Closed",
    result: "Win",
    notes: "Scaled half at 1R and let remainder run.",
    pnl: 136.8,
    rMultiple: 1.06,
    rr: 1.83,
  },
  {
    id: "tr-06",
    symbol: "BTCUSD",
    direction: "SELL",
    entry: 98240,
    stopLoss: 99180,
    takeProfit: 95800,
    exit: 98240,
    positionSize: 0.4,
    date: "2025-02-16",
    session: "Asian",
    strategy: "Liquidity Fade",
    status: "Closed",
    result: "Breakeven",
    notes: "Moved stop to entry after momentum stalled.",
    pnl: 0,
    rMultiple: 0,
    rr: 2.6,
  },
  {
    id: "tr-07",
    symbol: "AMD",
    direction: "BUY",
    entry: 116.2,
    stopLoss: 113.8,
    takeProfit: 121.8,
    exit: 0,
    positionSize: 65,
    date: "2025-02-22",
    session: "New York",
    strategy: "VWAP Reclaim",
    status: "Open",
    result: "Pending",
    notes: "Watching for continuation above anchored VWAP.",
    pnl: 0,
    rMultiple: 0,
    rr: 2.33,
  },
];
const initialAlerts: Alert[] = [
  {
    id: "al-01",
    instrument: "NVDA",
    targetPrice: 925,
    condition: "Above",
    note: "Look for continuation setup at weekly high.",
    status: "Active",
    createdAt: "Today, 08:42",
  },
  {
    id: "al-02",
    instrument: "EURUSD",
    targetPrice: 1.078,
    condition: "Below",
    note: "Revisit short thesis if support gives way.",
    status: "Active",
    createdAt: "Yesterday, 16:18",
  },
  {
    id: "al-03",
    instrument: "BTCUSD",
    targetPrice: 100000,
    condition: "Above",
    note: "Round number reaction zone.",
    status: "Triggered",
    createdAt: "Feb 16, 11:09",
  },
];
const initialStrategies: Strategy[] = [
  {
    id: "st-01",
    name: "Opening Range",
    description: "Trade the first decisive expansion after the cash open.",
    preferredMarkets: "US equities, index futures",
    preferredSession: "New York",
    riskRules: "0.50% account risk. One attempt per session.",
    entryRules: "Wait for 5m close outside range, then enter on retest.",
    exitRules: "Scale at 1R. Runner targets 2.5R or opposing liquidity.",
    notes: "Best on clean catalyst days.",
    tradeCount: 31,
    winRate: 64.5,
    profitFactor: 1.86,
    totalPnl: 2840,
  },
  {
    id: "st-02",
    name: "London Sweep",
    description:
      "Capture the reversal after an engineered European session liquidity run.",
    preferredMarkets: "FX majors",
    preferredSession: "London",
    riskRules: "0.35% account risk. No entry before 08:00 UTC.",
    entryRules: "Sweep Asian high/low, then wait for displacement.",
    exitRules: "Target opposing session extreme or 2R.",
    notes: "Avoid on major rate decisions.",
    tradeCount: 18,
    winRate: 61.1,
    profitFactor: 1.62,
    totalPnl: 1196,
  },
  {
    id: "st-03",
    name: "VWAP Reclaim",
    description: "Join a trend when price re-establishes above anchored VWAP.",
    preferredMarkets: "Liquid tech equities",
    preferredSession: "New York",
    riskRules: "Hard stop beneath reclaim candle. Max two trades.",
    entryRules: "Higher low plus volume expansion through VWAP.",
    exitRules: "Trim into prior high, trail remainder.",
    notes: "Requires patience — confirmation is the edge.",
    tradeCount: 24,
    winRate: 58.3,
    profitFactor: 1.41,
    totalPnl: 874,
  },
];

const chartData = [
  { date: "Jan 27", value: 0, benchmark: 0 },
  { date: "Jan 30", value: 420, benchmark: 180 },
  { date: "Feb 03", value: 268, benchmark: 230 },
  { date: "Feb 06", value: 890, benchmark: 440 },
  { date: "Feb 10", value: 740, benchmark: 510 },
  { date: "Feb 13", value: 1320, benchmark: 690 },
  { date: "Feb 17", value: 1456.8, benchmark: 820 },
  { date: "Feb 21", value: 3320.2, benchmark: 960 },
];

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/journal", label: "Trade journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  {
    href: "/tradingview",
    label: "TradingView",
    icon: CandlestickChart,
  },
  { href: "/market-chart", label: "RTR Market Chart", icon: LineChart },
  { href: "/alerts", label: "Alerts", icon: Bell },
];
const workspaceItems = [
  { href: "/strategies", label: "Strategies", icon: Crosshair },
  { href: "/settings", label: "Settings", icon: Settings },
];

function money(value: number, decimals = 2) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tester, signOut } = useAuth();
  const identity = tester?.name || "Trader";
  const initials = identity
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const current = [...navItems, ...workspaceItems].find(
    (item) => item.href === location,
  );
  return (
    <div className="app-noise min-h-[100dvh] bg-[#0d1118] text-[#d9e2ed]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-[#202b38] bg-[#111820] px-4 py-5 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <img
            src="/assets/rtr-logo.jpeg"
            alt="Rags to Riches FX"
            className="h-11 w-11 shrink-0 rounded-full bg-white object-contain shadow-[0_0_25px_rgba(76,224,177,.14)]"
          />
          <div>
            <div className="text-[15px] font-bold tracking-[-.02em] text-[#edf5f4]">
              RTR-TradeScope
            </div>
            <div className="mt-0.5 text-[9px] tracking-[.08em] text-[#6c7c8d]">
              Track. Review. Refine.
            </div>
          </div>
        </div>
        <div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-[#596a7a]">
          Workspace
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={location === item.href}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
        <div className="mb-3 mt-8 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-[#596a7a]">
          Refine
        </div>
        <nav className="space-y-1">
          {workspaceItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={location === item.href}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-[#263443] bg-[#16212a] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#718493]">
              Process health
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ce0b1]" />
          </div>
          <div className="mb-2 text-[13px] font-semibold text-[#dbe8e7]">
            Your review loop is strong
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#263542]">
            <div className="h-full w-[78%] rounded-full bg-[#4ce0b1]" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-[#778894]">
            <span>Last 30 days</span>
            <span className="font-mono text-[#4ce0b1]">78 / 100</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2.5 border-t border-[#202b38] px-2 pt-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#253a45] text-[11px] font-bold text-[#8de4cb]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{identity}</div>
            <div className="truncate text-[10px] text-[#72818d]">
              {tester?.email}
            </div>
          </div>
          <button
            data-testid="button-sign-out"
            title="Sign Out"
            aria-label="Sign Out"
            onClick={() => void signOut()}
            className="rounded-md p-1.5 text-[#71808b] hover:bg-[#263642] hover:text-[#dce7e8]"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          data-testid="button-close-mobile-nav"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[#05080c]/70 lg:hidden"
        />
      )}
      <main className="min-h-[100dvh] lg:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#202b38] bg-[#0d1118]/95 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              data-testid="button-open-mobile-nav"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-[#91a2af] hover:bg-[#1b2732] lg:hidden"
            >
              <Menu size={19} />
            </button>
            <div className="text-[12px] text-[#72808c]">
              Workspace <span className="mx-1.5 text-[#3e4c58]">/</span>
              <span className="text-[#c7d2dd]">
                {current?.label || "Overview"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full border border-[#31594f] bg-[#18302c] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[#72d8bb]">
              RTR-TradeScope Beta
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-[#25323f] bg-[#131b24] px-2.5 py-1.5 text-[10px] text-[#738391] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ce0b1]" /> Shared
              beta workspace
            </div>
            <button
              data-testid="button-help"
              className="rounded-md p-2 text-[#72818e] hover:bg-[#1b2732]"
            >
              <CircleHelp size={17} />
            </button>
            <button
              data-testid="button-header-settings"
              onClick={() => setLocation("/settings")}
              className="rounded-md p-2 text-[#72818e] hover:bg-[#1b2732]"
            >
              <Settings size={17} />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof Activity;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all ${active ? "bg-[#203e3d] font-semibold text-[#83e4c8] shadow-[inset_2px_0_0_#4ce0b1]" : "text-[#83929f] hover:bg-[#1a252f] hover:text-[#d4e0e2]"}`}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
      {label === "Alerts" && (
        <span className="ml-auto rounded-full bg-[#b38a38]/20 px-1.5 py-0.5 font-mono text-[9px] text-[#e7c56d]">
          2
        </span>
      )}
    </Link>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.19em] text-[#4ce0b1]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ce0b1]" />
          {eyebrow}
        </div>
        <h1 className="text-[27px] font-bold tracking-[-.04em] text-[#edf3f5] sm:text-[31px]">
          {title}
        </h1>
        <p className="mt-1.5 text-[13px] text-[#778692]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Card({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <section
      className={`rounded-xl border border-[#222e3b] bg-[#131b24] ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
function Stat({
  label,
  value,
  sub,
  positive = true,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  accent?: boolean;
}) {
  return (
    <Card
      className={`relative overflow-hidden p-4 ${accent ? "border-[#2a6257] bg-[#142b2b]" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#778694]">
          {label}
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${accent ? "bg-[#4ce0b1]" : "bg-[#4a5b69]"}`}
        />
      </div>
      <div className="font-mono text-[22px] font-bold tracking-[-.04em] text-[#e4eeef]">
        {value}
      </div>
      <div
        className={`mt-2 flex items-center gap-1 text-[11px] ${positive ? "text-[#56d4aa]" : "text-[#df7c72]"}`}
      >
        {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {sub}
      </div>
    </Card>
  );
}

function Overview({ trades }: { trades: Trade[] }) {
  const { tester } = useAuth();
  const [metric, setMetric] = useState<"pnl" | "rMultiple">("pnl");
  const closed = trades.filter((t) => t.status === "Closed");
  const stats = summary(trades);
  let pnl = 0;
  let r = 0;
  const performance = [...closed]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((trade) => ({
      date: trade.date.slice(5).replace("-", "/"),
      value: (pnl += trade.pnl),
      benchmark: (r += trade.rMultiple),
    }));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <PageTitle
        eyebrow="Friday, February 21, 2025"
        title={`${greeting}${tester?.name ? `, ${tester.name}` : ""}.`}
        subtitle="A clear read on your decisions, before the next one."
        action={
          <Link
            href="/add-trade"
            data-testid="link-add-trade-top"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4ce0b1] px-4 py-2.5 text-[12px] font-bold text-[#0d1b1a] shadow-[0_4px_16px_rgba(76,224,177,.12)] transition-transform hover:-translate-y-0.5"
          >
            <Plus size={15} /> Log a trade
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 rise">
        {
          <Stat
            label="Net P&L"
            value={money(stats.netPnl)}
            sub={`${stats.closed} closed trades`}
            positive={stats.netPnl >= 0}
            accent
          />
        }
        {
          <Stat
            label="Win rate"
            value={`${stats.winRate.toFixed(1)}%`}
            sub={`${stats.wins} wins · ${stats.losses} losses`}
          />
        }
        {
          <Stat
            label="Profit factor"
            value={
              Number.isFinite(stats.profitFactor)
                ? stats.profitFactor.toFixed(2)
                : "∞"
            }
            sub={`${stats.breakevens} breakeven`}
          />
        }
        {
          <Stat
            label="Avg. R multiple"
            value={`${stats.averageR >= 0 ? "+" : ""}${stats.averageR.toFixed(2)}R`}
            sub={`${stats.averageRR.toFixed(2)} planned R:R`}
            positive={stats.averageR >= 0}
          />
        }
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
        <Card className="p-5 rise-2">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="text-[14px] font-bold text-[#e1ebed]">
                Performance curve
              </div>
              <div className="mt-1 text-[11px] text-[#71818d]">
                Cumulative outcome · Last 30 days
              </div>
            </div>
            <div className="flex items-center rounded-md border border-[#263440] bg-[#0f161e] p-0.5">
              <button
                data-testid="button-metric-pnl"
                onClick={() => setMetric("pnl")}
                className={`rounded px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider ${metric === "pnl" ? "bg-[#263a3b] text-[#79dfc0]" : "text-[#667685]"}`}
              >
                P&L
              </button>
              <button
                data-testid="button-metric-r"
                onClick={() => setMetric("rMultiple")}
                className={`rounded px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider ${metric === "rMultiple" ? "bg-[#263a3b] text-[#79dfc0]" : "text-[#667685]"}`}
              >
                R multiple
              </button>
            </div>
          </div>
          {performance.length ? (
            <div className="h-[255px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance}>
                  <defs>
                    <linearGradient id="fillTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ce0b1" stopOpacity=".22" />
                      <stop offset="100%" stopColor="#4ce0b1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2a35" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#687886", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fill: "#687886", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      metric === "pnl" ? `$${v}` : `${v}R`
                    }
                    width={55}
                  />
                  <Tooltip content={<ChartTip metric={metric} />} />
                  <Area
                    type="monotone"
                    dataKey={metric === "pnl" ? "value" : "benchmark"}
                    stroke="#4ce0b1"
                    strokeWidth={2}
                    fill="url(#fillTeal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No closed trades yet"
              detail="Close a journal trade to build your performance curve."
            />
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#202b37] pt-4 text-[10px] text-[#748391]">
            <span className="flex items-center gap-2">
              <i className="h-1.5 w-4 rounded-full bg-[#4ce0b1]" /> Your
              performance
            </span>
            <span className="flex items-center gap-2">
              <i className="h-1.5 w-4 rounded-full bg-[#536374]" /> Baseline
            </span>
            <span className="ml-auto font-mono text-[#4ce0b1]">
              +22.8% this period
            </span>
          </div>
        </Card>
        <Card className="p-5 rise-2">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="text-[14px] font-bold text-[#e1ebed]">
                Decision quality
              </div>
              <div className="mt-1 text-[11px] text-[#71818d]">
                Process score by category
              </div>
            </div>
            <Gauge size={17} className="text-[#4ce0b1]" />
          </div>
          <div className="space-y-4">
            {[
              ["Risk discipline", 86, "No oversized positions"],
              ["Entry patience", 72, "2 early entries"],
              ["Exit execution", 78, "Strong partials"],
              ["Review consistency", 91, "7/7 days logged"],
            ].map(([label, value, note]) => (
              <div key={label as string}>
                <div className="mb-1.5 flex justify-between text-[11px]">
                  <span className="text-[#aab7c0]">{label as string}</span>
                  <span className="font-mono text-[#d8e3e4]">
                    {value as number}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#25323e]">
                  <div
                    className="h-full rounded-full bg-[#4ce0b1]"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-[#687783]">
                  {note as string}
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/analytics"
            data-testid="link-review-analytics"
            className="mt-6 flex items-center justify-between border-t border-[#202b37] pt-4 text-[11px] font-semibold text-[#84d7c0]"
          >
            Open full review <ChevronRight size={14} />
          </Link>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
        <RecentTrades trades={trades} />
        <InsightCard />
      </div>
    </>
  );
}
function ChartTip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  metric: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="mb-1 text-[10px] text-[#7d8d9a]">{label}</div>
      <div className="font-mono text-[12px] text-[#72ddbe]">
        {metric === "pnl" ? money(payload[0].value) : `${payload[0].value}R`}
      </div>
    </div>
  );
}
function RecentTrades({
  trades,
  compact = false,
}: {
  trades: Trade[];
  compact?: boolean;
}) {
  const visible = compact ? trades.slice(0, 4) : trades.slice(0, 6);
  return (
    <Card className="overflow-hidden rise-3">
      <div className="flex items-center justify-between border-b border-[#202b37] px-5 py-4">
        <div>
          <div className="text-[14px] font-bold text-[#e1ebed]">
            Recent trades
          </div>
          <div className="mt-1 text-[11px] text-[#71818d]">
            Your latest decisions
          </div>
        </div>
        <Link
          href="/journal"
          data-testid="link-view-journal"
          className="text-[11px] font-semibold text-[#84d7c0]"
        >
          View journal <ChevronRight className="ml-1 inline" size={13} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead>
            <tr className="border-b border-[#202b37] font-mono text-[9px] uppercase tracking-[.13em] text-[#60717e]">
              <th className="px-5 py-3 font-normal">Instrument</th>
              <th className="px-3 py-3 font-normal">Direction</th>
              <th className="px-3 py-3 font-normal">Strategy</th>
              <th className="px-3 py-3 font-normal">Date</th>
              <th className="px-5 py-3 text-right font-normal">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <TradeRow key={t.id} trade={t} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function TradeRow({ trade, onClick }: { trade: Trade; onClick?: () => void }) {
  return (
    <tr
      data-testid={`row-trade-${trade.id}`}
      onClick={onClick}
      className={`border-b border-[#1d2833] last:border-0 ${onClick ? "cursor-pointer hover:bg-[#18232d]" : ""}`}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#23313d] font-mono text-[9px] font-bold text-[#b8c9ce]">
            {trade.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="font-mono text-[12px] font-bold text-[#dfe9eb]">
              {trade.symbol}
            </div>
            <div className="text-[10px] text-[#6e7e8b]">{trade.session}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold ${trade.direction === "BUY" ? "text-[#55d9b0]" : "text-[#ee9388]"}`}
        >
          {trade.direction === "BUY" ? (
            <ArrowUpRight size={13} />
          ) : (
            <ArrowDownRight size={13} />
          )}
          {trade.direction}
        </span>
      </td>
      <td className="px-3 py-3.5 text-[11px] text-[#9aa9b4]">
        {trade.strategy}
      </td>
      <td className="px-3 py-3.5 font-mono text-[10px] text-[#758490]">
        {trade.date.slice(5).replace("-", "/")}
      </td>
      <td
        className={`px-5 py-3.5 text-right font-mono text-[12px] font-bold ${trade.result === "Loss" ? "text-[#e98078]" : trade.result === "Pending" ? "text-[#b3bdc3]" : "text-[#5bdab0]"}`}
      >
        {trade.status === "Open" ? (
          <span className="rounded bg-[#7e6b30]/20 px-2 py-1 text-[9px] text-[#e1c361]">
            OPEN
          </span>
        ) : (
          `${trade.pnl >= 0 ? "+" : ""}${money(trade.pnl)}`
        )}
      </td>
    </tr>
  );
}
function InsightCard() {
  return (
    <Card className="relative overflow-hidden bg-[#18262c] p-5">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#4ce0b1]/10 blur-2xl" />
      <div className="relative">
        <div className="mb-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-[#4ce0b1]">
          <Sparkles size={13} /> Pattern noticed
        </div>
        <div className="max-w-[280px] text-[19px] font-bold leading-[1.25] tracking-[-.03em] text-[#e7f0ef]">
          Your best trades wait for the second move.
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#889aa1]">
          Trades entered after a retest are up{" "}
          <span className="font-semibold text-[#72dfbd]">+1.1R</span> on
          average. Keep making room for confirmation.
        </p>
        <Link
          href="/journal"
          data-testid="link-explore-pattern"
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#82dfc1]"
        >
          Explore the pattern <ArrowUpRight size={13} />
        </Link>
      </div>
    </Card>
  );
}

function Journal({
  trades,
  setTrades,
}: {
  trades: Trade[];
  setTrades: (t: Trade[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [directionFilter, setDirectionFilter] = useState("All");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [selected, setSelected] = useState<Trade | null>(null);
  const [edit, setEdit] = useState<Trade | null>(null);
  const filtered = trades.filter(
    (t) =>
      (filter === "All" || t.result === filter || t.status === filter) &&
      (directionFilter === "All" || t.direction === directionFilter) &&
      (sessionFilter === "All" || t.session === sessionFilter) &&
      (strategyFilter === "All" || t.strategy === strategyFilter) &&
      `${t.symbol} ${t.strategy} ${t.notes}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Review loop"
        title="Trade journal"
        subtitle={`${filtered.length} decisions in your workspace`}
        action={
          <Link
            href="/add-trade"
            data-testid="link-journal-add"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4ce0b1] px-4 py-2.5 text-[12px] font-bold text-[#0d1b1a]"
          >
            <Plus size={15} /> Log a trade
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#202b37] p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-2.5 text-[#657582]"
            />
            <input
              data-testid="input-journal-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbols, strategies, notes..."
              className="h-9 w-full rounded-md border border-[#2a3744] bg-[#0f161e] pl-9 pr-3 text-[12px] text-[#dce7e8] outline-none placeholder:text-[#5d6c79] focus:border-[#4ce0b1]"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {["All", "Win", "Loss", "Open", "Planned"].map((f) => (
              <button
                data-testid={`button-filter-${f.toLowerCase()}`}
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-semibold ${filter === f ? "bg-[#28433f] text-[#81dfc0]" : "text-[#778792] hover:bg-[#1b2732]"}`}
              >
                {f}
              </button>
            ))}
            <button
              data-testid="button-more-filters"
              className="ml-1 rounded-md border border-[#293640] px-2.5 text-[#768692]"
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>
        <div className="grid gap-2 border-b border-[#202b37] p-4 sm:grid-cols-3">
          <select
            aria-label="Filter by direction"
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
          >
            <option>All</option>
            <option>BUY</option>
            <option>SELL</option>
          </select>
          <select
            aria-label="Filter by session"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option>All</option>
            {["Asian", "London", "New York", "Overlap", "Other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter by strategy"
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
          >
            <option>All</option>
            {[...new Set(trades.map((t) => t.strategy).filter(Boolean))].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-[#202b37] font-mono text-[9px] uppercase tracking-[.13em] text-[#60717e]">
                <th className="px-5 py-3 font-normal">Trade</th>
                <th className="px-3 py-3 font-normal">Setup</th>
                <th className="px-3 py-3 font-normal">Risk / reward</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-3 py-3 font-normal">Date</th>
                <th className="px-5 py-3 text-right font-normal">P&L</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  data-testid={`journal-row-${t.id}`}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer border-b border-[#1d2833] transition-colors hover:bg-[#192530]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-[#23313d] font-mono text-[9px] font-bold text-[#b8c9ce]">
                        {t.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-mono text-[12px] font-bold text-[#dfe9eb]">
                          {t.symbol}
                        </div>
                        <div
                          className={`mt-0.5 text-[10px] ${t.direction === "BUY" ? "text-[#55d9b0]" : "text-[#ee9388]"}`}
                        >
                          {t.direction} · {t.positionSize} units
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-[11px] text-[#b0bdc5]">
                      {t.strategy}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#697a87]">
                      {t.session} session
                    </div>
                  </td>
                  <td className="px-3 py-4 font-mono text-[11px] text-[#b3c1c8]">
                    {t.rr.toFixed(2)}R{" "}
                    <span className="text-[#62727f]">planned</span>
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill status={t.status} result={t.result} />
                  </td>
                  <td className="px-3 py-4 font-mono text-[10px] text-[#778691]">
                    {t.date}
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-mono text-[12px] font-bold ${t.pnl < 0 ? "text-[#e98078]" : "text-[#5bdab0]"}`}
                  >
                    {t.status === "Open"
                      ? "—"
                      : `${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}`}
                  </td>
                  <td className="pr-3">
                    <button
                      data-testid={`button-edit-trade-${t.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdit(t);
                      }}
                      className="rounded p-1.5 text-[#617381] hover:bg-[#273743] hover:text-[#c5d9d9]"
                    >
                      <Edit3 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            title="No trades match"
            detail="Try a different symbol, strategy, or result filter."
          />
        )}
      </Card>
      {selected && (
        <TradeDetail
          trade={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEdit(selected);
            setSelected(null);
          }}
          onDelete={() => {
            if (
              window.confirm(`Delete ${selected.symbol} from your journal?`)
            ) {
              setTrades(trades.filter((t) => t.id !== selected.id));
              setSelected(null);
            }
          }}
        />
      )}
      {edit && (
        <TradeForm
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(t) => {
            setTrades(trades.map((x) => (x.id === t.id ? t : x)));
            setEdit(null);
          }}
        />
      )}
    </>
  );
}
function StatusPill({ status, result }: { status: Status; result: Result }) {
  const tone =
    status === "Open"
      ? "yellow"
      : result === "Win"
        ? "green"
        : result === "Loss"
          ? "red"
          : "gray";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${tone === "green" ? "bg-[#3cae8420] text-[#64dcb5]" : tone === "red" ? "bg-[#d5605622] text-[#ed8b82]" : tone === "yellow" ? "bg-[#b8933220] text-[#e4c461]" : "bg-[#65727e20] text-[#a9b4ba]"}`}
    >
      {status === "Closed" ? result : status}
    </span>
  );
}
function TradeDetail({
  trade,
  onClose,
  onEdit,
  onDelete,
}: {
  trade: Trade;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#05080c]/70 sm:items-stretch">
      <div className="flex h-[92vh] w-full flex-col border-l border-[#293746] bg-[#121b24] shadow-2xl sm:h-full sm:max-w-[480px]">
        <div className="flex items-center justify-between border-b border-[#273441] px-5 py-4">
          <div>
            <div className="font-mono text-[17px] font-bold text-[#e5eff0]">
              {trade.symbol}
            </div>
            <div className="mt-1 text-[10px] text-[#73828e]">
              {trade.date} · {trade.strategy}
            </div>
          </div>
          <button
            data-testid="button-close-trade-detail"
            onClick={onClose}
            className="rounded-md p-2 text-[#72828e] hover:bg-[#21303b]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={trade.status} result={trade.result} />
            <div
              className={`font-mono text-[20px] font-bold ${trade.pnl < 0 ? "text-[#ed847b]" : "text-[#59d9b0]"}`}
            >
              {trade.status === "Open" ? "In progress" : money(trade.pnl)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Entry", trade.entry],
              ["Stop loss", trade.stopLoss],
              ["Take profit", trade.takeProfit],
              ["Exit", trade.exit || "—"],
              ["Position", trade.positionSize],
              [
                "Risk",
                money(
                  Math.abs(trade.entry - trade.stopLoss) * trade.positionSize,
                ),
              ],
              [
                "Reward",
                money(
                  Math.abs(trade.takeProfit - trade.entry) * trade.positionSize,
                ),
              ],
              ["Planned R:R", `${trade.rr.toFixed(2)} : 1`],
              ["Realized R", `${trade.rMultiple.toFixed(2)}R`],
              ["Result", trade.result],
              ["Status", trade.status],
            ].map(([l, v]) => (
              <div
                key={l as string}
                className="rounded-lg border border-[#24313d] bg-[#0f171f] p-3"
              >
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[#697b88]">
                  {l as string}
                </div>
                <div className="font-mono text-[13px] text-[#d3e0e1]">
                  {typeof v === "number" ? v.toLocaleString() : (v as string)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#697b88]">
              Trade notes
            </div>
            <div className="rounded-lg border border-[#24313d] bg-[#0f171f] p-3 text-[12px] leading-relaxed text-[#a9b7be]">
              {trade.notes}
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#697b88]">
              Context
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-[#20333c] px-2.5 py-1.5 text-[10px] text-[#8dd7c4]">
                {trade.session} session
              </span>
              <span className="rounded-md bg-[#20333c] px-2.5 py-1.5 text-[10px] text-[#8dd7c4]">
                {trade.direction} direction
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-[#273441] p-4">
          <button
            data-testid="button-detail-edit"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#30404d] py-2.5 text-[11px] font-bold text-[#bac8ce] hover:bg-[#20303a]"
          >
            <Pencil size={14} /> Edit trade
          </button>
          <button
            data-testid="button-detail-delete"
            onClick={onDelete}
            className="rounded-lg border border-[#523139] px-3 text-[#dc817a] hover:bg-[#351f26]"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TradeForm({
  initial,
  prefilled,
  onClose,
  onSave,
  onAdd,
}: {
  initial?: Trade;
  prefilled?: boolean;
  onClose?: () => void;
  onSave?: (t: Trade) => void;
  onAdd?: (t: Trade) => void | Promise<void>;
}) {
  const [form, setForm] = useState<Trade>(
    initial || {
      id: crypto.randomUUID(),
      symbol: "",
      direction: "BUY",
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      exit: 0,
      positionSize: 1,
      date: new Date().toISOString().slice(0, 10),
      session: "New York",
      strategy: "Opening Range",
      status: "Closed",
      result: "Win",
      notes: "",
      pnl: 0,
      rMultiple: 0,
      rr: 0,
    },
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [screenshotName, setScreenshotName] = useState("");
  const update = (key: keyof Trade, value: string) =>
    setForm((f) => ({
      ...f,
      [key]: [
        "entry",
        "stopLoss",
        "takeProfit",
        "exit",
        "positionSize",
      ].includes(key)
        ? Number(value) || 0
        : value,
    }));
  const risk = Math.abs(form.entry - form.stopLoss) * form.positionSize;
  const reward = Math.abs(form.takeProfit - form.entry) * form.positionSize;
  const ratio = risk ? reward / risk : 0;
  const realized = form.exit
    ? (form.direction === "BUY"
        ? form.exit - form.entry
        : form.entry - form.exit) * form.positionSize
    : 0;
  const submit = async () => {
    const found = Object.values(validateTrade(form));
    if (found.length) {
      setErrors(found);
      return;
    }
    const t = calculateTrade(form);
    setSaving(true);
    try {
      onSave?.(t);
      await onAdd?.(t);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save trade"]);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080c]/80 p-3 sm:p-6">
      <div className="max-h-[94vh] w-full max-w-[700px] overflow-y-auto rounded-xl border border-[#2a3946] bg-[#131d26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#273441] px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-[#e6efef]">
              {initial && !prefilled ? "Edit trade" : "Log a trade"}
            </div>
            <div className="mt-1 text-[10px] text-[#71818d]">
              Capture the decision while it is still fresh.
            </div>
          </div>
          {onClose && (
            <button
              data-testid="button-close-trade-form"
              onClick={onClose}
              className="text-[#74848e]"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="space-y-5 p-5">
          {errors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-[#743f45] bg-[#351f26] p-3 text-[11px] text-[#f0a29a]"
            >
              {errors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
            <Field label="Instrument">
              <input
                data-testid="input-trade-symbol"
                value={form.symbol}
                onChange={(e) => update("symbol", e.target.value.toUpperCase())}
                placeholder="NVDA"
              />
            </Field>
            <Field label="Direction">
              <select
                data-testid="select-trade-direction"
                value={form.direction}
                onChange={(e) => update("direction", e.target.value)}
              >
                <option>BUY</option>
                <option>SELL</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                data-testid="input-trade-date"
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Entry">
              <input
                data-testid="input-trade-entry"
                type="number"
                step="any"
                value={form.entry || ""}
                onChange={(e) => update("entry", e.target.value)}
              />
            </Field>
            <Field label="Stop loss">
              <input
                data-testid="input-trade-stop"
                type="number"
                step="any"
                value={form.stopLoss || ""}
                onChange={(e) => update("stopLoss", e.target.value)}
              />
            </Field>
            <Field label="Take profit">
              <input
                data-testid="input-trade-target"
                type="number"
                step="any"
                value={form.takeProfit || ""}
                onChange={(e) => update("takeProfit", e.target.value)}
              />
            </Field>
            <Field label="Position size">
              <input
                data-testid="input-trade-size"
                type="number"
                step="any"
                value={form.positionSize || ""}
                onChange={(e) => update("positionSize", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Exit price">
              <input
                data-testid="input-trade-exit"
                type="number"
                step="any"
                value={form.exit || ""}
                onChange={(e) => update("exit", e.target.value)}
              />
            </Field>
            <Field label="Session">
              <select
                data-testid="select-trade-session"
                value={form.session}
                onChange={(e) => update("session", e.target.value)}
              >
                {["Asian", "London", "New York", "Overlap", "Other"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Strategy">
              <select
                data-testid="select-trade-strategy"
                value={form.strategy}
                onChange={(e) => update("strategy", e.target.value)}
              >
                {[
                  "Opening Range",
                  "London Sweep",
                  "VWAP Reclaim",
                  "Liquidity Fade",
                  "RTR Retest",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#23433f] bg-[#142927] p-3">
            <Calc label="At risk" value={money(risk)} />
            <Calc label="Potential" value={money(reward)} />
            <Calc label="Planned R:R" value={`${ratio.toFixed(2)} : 1`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select
                data-testid="select-trade-status"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option>Closed</option>
                <option>Open</option>
                <option>Planned</option>
              </select>
            </Field>
            <Field label="Result">
              <select
                data-testid="select-trade-result"
                value={form.result}
                onChange={(e) => update("result", e.target.value)}
              >
                <option>Win</option>
                <option>Loss</option>
                <option>Breakeven</option>
                <option>Pending</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              data-testid="textarea-trade-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="What did you see? What did you do well? What would you change?"
              rows={4}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#334452] p-3 text-[11px] text-[#83929c] hover:border-[#4ce0b1]">
            <Download size={15} /> {screenshotName || "Attach chart screenshot"}
            <input
              data-testid="input-trade-screenshot"
              type="file"
              accept="image/*"
              onChange={(event) => setScreenshotName(event.target.files?.[0]?.name ?? "")}
              className="hidden"
            />
          </label>
          {screenshotName && (
            <p className="-mt-3 text-[9px] text-[#70818c]">
              Image selected locally. Persistent screenshot storage is not configured yet.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#273441] px-5 py-4">
          <button
            data-testid="button-cancel-trade"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-[11px] font-semibold text-[#8997a1] hover:bg-[#21303b]"
          >
            Cancel
          </button>
          <button
            data-testid="button-save-trade"
            onClick={submit}
            disabled={!form.symbol || saving}
            className="rounded-lg bg-[#4ce0b1] px-5 py-2.5 text-[11px] font-bold text-[#0d1b1a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : initial && !prefilled ? "Save changes" : "Save trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-wider text-[#71818c]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Calc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[#6c8f88]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] font-bold text-[#77dfbf]">
        {value}
      </div>
    </div>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-[#2c4246] bg-[#172a2c] text-[#4ce0b1]">
        <Search size={18} />
      </div>
      <div className="text-[14px] font-bold text-[#d7e2e4]">{title}</div>
      <div className="mt-1 max-w-xs text-[11px] text-[#71828d]">{detail}</div>
    </div>
  );
}

function AddTrade({
  createTrade,
}: {
  createTrade: (trade: Trade) => Promise<Trade>;
}) {
  const [, setLocation] = useLocation();
  const [prefill] = useState(() => tradePrefill.read());
  useEffect(() => { tradePrefill.clear(); }, []);
  const initial = prefill ? {
    id: crypto.randomUUID(), symbol: prefill.symbol, direction: prefill.direction,
    entry: 0, stopLoss: 0, takeProfit: 0, exit: 0, positionSize: 0,
    date: prefill.date, session: prefill.session, strategy: prefill.strategy,
    status: "Planned" as const, result: "Pending" as const, notes: prefill.notes,
    pnl: 0, rMultiple: 0, rr: 0,
  } : undefined;
  return (
    <>
      <PageTitle
        eyebrow="Capture the decision"
        title="Log a trade"
        subtitle="A complete record makes the next review more useful."
      />
      <TradeForm
        initial={initial}
        prefilled={Boolean(prefill)}
        onAdd={async (t) => {
          const saved = await createTrade(t);
          toast({ title: "Trade saved", description: `${saved.symbol} is now in your journal.` });
          setLocation("/journal");
        }}
        onClose={() => setLocation("/")}
      />
    </>
  );
}

function Analytics({ trades }: { trades: Trade[] }) {
  const stats = summary(trades);
  const sessions = ["New York", "London", "Overlap", "Asian", "Other"].map(
    (name) => {
      const ts = trades.filter(
        (t) => t.session === name && t.status === "Closed",
      );
      return {
        name,
        pnl: ts.reduce((a, t) => a + t.pnl, 0),
        trades: ts.length,
        wins: ts.filter((t) => t.result === "Win").length,
      };
    },
  );
  const strategies = [
    ...new Set(trades.map((trade) => trade.strategy).filter(Boolean)),
  ].map((name) => {
    const ts = trades.filter((t) => t.strategy === name);
    return {
      name,
      pnl: ts.reduce((a, t) => a + t.pnl, 0),
      winRate: ts.length
        ? Math.round(
            (ts.filter((t) => t.result === "Win").length / ts.length) * 100,
          )
        : 0,
    };
  });
  const bestSession = [...sessions].sort((a, b) => b.pnl - a.pnl)[0];
  const buyPnl = directionPnl(trades, "BUY");
  const sellPnl = directionPnl(trades, "SELL");
  const directionData = [
    { name: "Buy", value: Math.abs(buyPnl) },
    { name: "Sell", value: Math.abs(sellPnl) },
  ];
  return (
    <>
      <PageTitle
        eyebrow="Find the edge"
        title="Analytics"
        subtitle="A deeper read on where your process is working."
        action={
          <button
            data-testid="button-export-analytics"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2b3946] px-4 py-2.5 text-[11px] font-semibold text-[#aab8c1] hover:bg-[#1b2933]"
          >
            <Download size={14} /> Export review
          </button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Average realized R"
          value={`${stats.averageR >= 0 ? "+" : ""}${stats.averageR.toFixed(2)}R`}
          sub="Per closed trade"
          positive={stats.averageR >= 0}
          accent
        />
        <Stat
          label="Best session"
          value={bestSession?.name || "—"}
          sub={
            bestSession
              ? `${money(bestSession.pnl)} net P&L`
              : "No closed trades"
          }
          positive={(bestSession?.pnl || 0) >= 0}
        />
        <Stat
          label="Average winner / loser"
          value={`${money(stats.averageWinner)} / ${money(stats.averageLoser)}`}
          sub={`Profit factor ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}`}
          positive={stats.profitFactor >= 1}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="p-5">
          <div className="mb-5">
            <div className="text-[14px] font-bold text-[#e1ebed]">
              P&L by session
            </div>
            <div className="mt-1 text-[11px] text-[#71818d]">
              Net outcome and hit rate
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessions} barSize={28}>
                <CartesianGrid stroke="#1f2a35" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#82919b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#687886", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<AnalyticsTip />} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {sessions.map((x) => (
                    <Cell
                      key={x.name}
                      fill={x.pnl >= 0 ? "#4ce0b1" : "#dc8078"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-5">
            <div className="text-[14px] font-bold text-[#e1ebed]">
              Direction split
            </div>
            <div className="mt-1 text-[11px] text-[#71818d]">
              Closed-trade P&amp;L by direction
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={directionData}
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {["#4ce0b1", "#d6a84c"].map((c) => (
                    <Cell key={c} fill={c} />
                  ))}
                </Pie>
                <Tooltip content={<AnalyticsTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-[11px]">
            <span className="flex items-center gap-2 text-[#99aaaF]">
              <i className="h-2 w-2 rounded-full bg-[#4ce0b1]" />
              Buy <b className="font-mono text-[#dce6e7]">{money(buyPnl)}</b>
            </span>
            <span className="flex items-center gap-2 text-[#99aaaf]">
              <i className="h-2 w-2 rounded-full bg-[#d6a84c]" />
              Sell <b className="font-mono text-[#dce6e7]">{money(sellPnl)}</b>
            </span>
          </div>
        </Card>
      </div>
      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-[#202b37] px-5 py-4">
          <div className="text-[14px] font-bold text-[#e1ebed]">
            Strategy breakdown
          </div>
          <div className="mt-1 text-[11px] text-[#71818d]">
            The setups you keep coming back to
          </div>
        </div>
        <div className="grid gap-px bg-[#222e39] sm:grid-cols-2 xl:grid-cols-4">
          {strategies.map((s) => (
            <div key={s.name} className="bg-[#131b24] p-4">
              <div className="mb-4 flex items-start justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#c3d0d4]">
                  {s.name}
                </span>
                <Crosshair size={14} className="text-[#637683]" />
              </div>
              <div
                className={`font-mono text-[18px] font-bold ${s.pnl >= 0 ? "text-[#59d9b0]" : "text-[#ea8179]"}`}
              >
                {money(s.pnl)}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-[#70808b]">
                <span>{s.winRate}% win rate</span>
                <span>
                  {trades.filter((t) => t.strategy === s.name).length} trades
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function AnalyticsTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  return active && payload?.length ? (
    <div className="chart-tooltip font-mono text-[11px] text-[#70dfbf]">
      {money(payload[0].value)}
    </div>
  ) : null;
}

function TradingViewPage({ createAlert }: { createAlert: (alert: Alert) => Promise<Alert> }) {
  const container = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const [showAlert, setShowAlert] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);
  const [alertForm, setAlertForm] = useState({
    instrument: "XAUUSD",
    condition: "Above" as "Above" | "Below",
    targetPrice: "",
    note: "",
  });

  const saveAlert = async () => {
    const targetPrice = Number(alertForm.targetPrice);
    if (!alertForm.instrument.trim() || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      setAlertError("Enter an instrument and a valid target price.");
      return;
    }
    setSavingAlert(true);
    setAlertError("");
    try {
      const saved = await createAlert({
        id: crypto.randomUUID(),
        instrument: alertForm.instrument.trim().toUpperCase(),
        targetPrice,
        condition: alertForm.condition,
        note: alertForm.note.trim(),
        status: "Active",
        createdAt: new Date().toLocaleString(),
      });
      setShowAlert(false);
      setAlertSaved(true);
      setAlertForm({ instrument: "XAUUSD", condition: "Above", targetPrice: "", note: "" });
      toast({ title: "Alert created", description: `${saved.instrument} ${saved.condition.toLowerCase()} ${saved.targetPrice.toLocaleString()} is now active.` });
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : "Unable to create alert.");
    } finally {
      setSavingAlert(false);
    }
  };

  useEffect(() => {
    const mountNode = container.current;
    if (!mountNode) return;
    mountNode.replaceChildren();
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: "OANDA:XAUUSD",
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      backgroundColor: "#0d1118",
      gridColor: "rgba(71, 85, 105, 0.18)",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    mountNode.append(widget, script);
    return () => mountNode.replaceChildren();
  }, []);

  return (
    <>
      <PageTitle
        eyebrow="Market Analysis"
        title="TradingView"
        subtitle="Explore live market structure without leaving your RTR workspace."
        action={
          <div className="flex items-center gap-2">
            {alertSaved && (
              <button data-testid="button-view-alerts" onClick={() => setLocation("/alerts")} className="rounded-lg border border-[#334652] px-3 py-2 text-[10px] font-semibold text-[#8dddc5] hover:bg-[#172a2a]">View Alerts</button>
            )}
            <button data-testid="button-create-tradingview-alert" onClick={() => { setAlertError(""); setShowAlert(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[#4ce0b1] px-4 py-2.5 text-[12px] font-bold text-[#0d1b1a]"><Plus size={15} /> Create Alert</button>
          </div>
        }
      />
      <div
        className="min-h-[520px] w-full overflow-hidden rounded-xl border border-[#273541] bg-[#0d1118] shadow-[0_18px_50px_rgba(0,0,0,.22)]"
        style={{ height: "clamp(520px, 72vh, 760px)" }}
      >
        <div
          ref={container}
          data-testid="tradingview-chart"
          className="tradingview-widget-container h-full w-full max-w-full"
        />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#647580]">
        Market data and chart tools are supplied by TradingView. The embedded
        widget does not send RTR journal data or execute trades.
      </p>
      <p className="mt-1 text-[10px] text-[#78908f]">
        Save your analysis using TradingView's image control, then attach the image when logging your trade.
      </p>
      {showAlert && (
        <Modal title="Create RTR alert" onClose={() => setShowAlert(false)}>
          <div className="space-y-4">
            {alertError && <div role="alert" className="rounded-lg border border-[#743f45] bg-[#351f26] p-3 text-[11px] text-[#f0a29a]">{alertError}</div>}
            <Field label="Instrument"><input data-testid="input-tradingview-alert-instrument" value={alertForm.instrument} onChange={(event) => setAlertForm({ ...alertForm, instrument: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition"><select data-testid="select-tradingview-alert-condition" value={alertForm.condition} onChange={(event) => setAlertForm({ ...alertForm, condition: event.target.value as "Above" | "Below" })}><option>Above</option><option>Below</option></select></Field>
              <Field label="Target price"><input data-testid="input-tradingview-alert-price" type="number" step="any" value={alertForm.targetPrice} onChange={(event) => setAlertForm({ ...alertForm, targetPrice: event.target.value })} /></Field>
            </div>
            <Field label="Note"><textarea data-testid="textarea-tradingview-alert-note" rows={3} value={alertForm.note} onChange={(event) => setAlertForm({ ...alertForm, note: event.target.value })} placeholder="What will you review at this level?" /></Field>
            <p className="text-[9px] leading-relaxed text-[#6f818c]">Stored alert definition only. RTR does not monitor live prices or trigger trades.</p>
          </div>
          <ModalActions cancel={() => setShowAlert(false)} submit={() => void saveAlert()} label={savingAlert ? "Saving…" : "Create alert"} testId="button-save-tradingview-alert" />
        </Modal>
      )}
    </>
  );
}

function Alerts({
  alerts,
  setAlerts,
}: {
  alerts: Alert[];
  setAlerts: (a: Alert[]) => void;
}) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    instrument: "",
    targetPrice: "",
    condition: "Above",
    note: "",
  });
  const save = () => {
    if (!form.instrument || !form.targetPrice) return;
    setAlerts([
      {
        id: `al-${Date.now()}`,
        instrument: form.instrument.toUpperCase(),
        targetPrice: Number(form.targetPrice),
        condition: form.condition as "Above" | "Below",
        note: form.note,
        status: "Active",
        createdAt: "Just now",
      },
      ...alerts,
    ]);
    setForm({ instrument: "", targetPrice: "", condition: "Above", note: "" });
    setShow(false);
  };
  return (
    <>
      <PageTitle
        eyebrow="Stay intentional"
        title="Alerts"
        subtitle="A quiet nudge for levels worth reviewing."
        action={
          <button
            data-testid="button-new-alert"
            onClick={() => setShow(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4ce0b1] px-4 py-2.5 text-[12px] font-bold text-[#0d1b1a]"
          >
            <Plus size={15} /> New alert
          </button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Stat
          label="Active alerts"
          value={`${alerts.filter((a) => a.status === "Active").length}`}
          sub="Watching across 4 instruments"
          accent
        />
        <Stat
          label="Triggered this month"
          value={`${alerts.filter((a) => a.status === "Triggered").length}`}
          sub="Review before creating more"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#202b37] px-5 py-4">
            <div className="text-[14px] font-bold text-[#e1ebed]">
              Your alerts
            </div>
            <div className="mt-1 text-[11px] text-[#71818d]">
              Stored definitions · backend price monitoring
            </div>
          </div>
          <div className="divide-y divide-[#202b37]">
            {alerts.map((a) => (
              <div
                key={a.id}
                data-testid={`alert-row-${a.id}`}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-lg ${a.status === "Active" ? "bg-[#203d3c] text-[#68dcb8]" : "bg-[#303039] text-[#9d9a87]"}`}
                >
                  <Bell size={16} />
                </div>
                <div className="min-w-[120px] flex-1">
                  <div className="flex items-center gap-2 font-mono text-[13px] font-bold text-[#dbe6e8]">
                    {a.instrument}
                    <span
                      className={`rounded px-1.5 py-0.5 font-sans text-[8px] uppercase tracking-wider ${a.status === "Active" ? "bg-[#3cae8420] text-[#64dcb5]" : "bg-[#64625630] text-[#c2b87f]"}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#758590]">
                    {a.note || "No note added"}
                  </div>
                  {a.source && <div className="mt-1 font-mono text-[8px] uppercase tracking-wider text-[#4fae94]">{a.source.replaceAll("_", " ")} {a.sourceTimeframe ? `· ${a.sourceTimeframe}` : ""} {a.confluenceScore != null ? `· ${a.confluenceScore}/5` : ""}</div>}
                  {a.triggeredAt && <div className="mt-1 text-[9px] text-[#d2a45a]">Triggered {new Date(a.triggeredAt).toLocaleString()}</div>}
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] text-[#cbd8dc]">
                    {a.condition} {a.targetPrice.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[10px] text-[#687885]">
                    {a.createdAt === "Just now" ? a.createdAt : new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  data-testid={`button-toggle-alert-${a.id}`}
                  onClick={() =>
                    setAlerts(
                      alerts.map((x) =>
                        x.id === a.id
                          ? {
                              ...x,
                              status: x.status === "Active" ? "Disabled" : "Active",
                              triggeredAt: x.status === "Triggered" ? undefined : x.triggeredAt,
                            }
                          : x,
                      ),
                    )
                  }
                  className={`rounded-md border px-2.5 py-2 text-[10px] ${a.status === "Active" ? "border-[#35424c] text-[#85949e]" : "border-[#2d6155] text-[#71dabc]"}`}
                >
                  {a.status === "Active" ? "Disable" : "Reactivate"}
                </button>
                <button
                  data-testid={`button-delete-alert-${a.id}`}
                  onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))}
                  className="rounded p-2 text-[#6f7e88] hover:bg-[#322329] hover:text-[#df827a]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-[13px] font-bold text-[#dce7e7]">
            <Radio size={16} className="text-[#d6a84c]" />
            How alerts fit your process
          </div>
          <p className="text-[12px] leading-relaxed text-[#81909b]">
            Use alerts as review prompts, not permission to trade. When a level
            triggers, open the journal and write down the context before
            considering a setup.
          </p>
          <div className="mt-5 space-y-3 border-t border-[#202b37] pt-4">
            {[
              ["01", "Define the level", "Write why it matters"],
              ["02", "Wait for context", "Price is not a signal"],
              ["03", "Document the read", "Keep the loop honest"],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-3">
                <span className="font-mono text-[10px] text-[#4ce0b1]">
                  {n}
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-[#b8c7cc]">
                    {t}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#71818b]">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {show && (
        <Modal title="Create an alert" onClose={() => setShow(false)}>
          <div className="space-y-4">
            <Field label="Instrument">
              <input
                data-testid="input-alert-instrument"
                value={form.instrument}
                onChange={(e) =>
                  setForm({ ...form, instrument: e.target.value })
                }
                placeholder="NVDA"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition">
                <select
                  data-testid="select-alert-condition"
                  value={form.condition}
                  onChange={(e) =>
                    setForm({ ...form, condition: e.target.value })
                  }
                >
                  <option>Above</option>
                  <option>Below</option>
                </select>
              </Field>
              <Field label="Target price">
                <input
                  data-testid="input-alert-price"
                  type="number"
                  value={form.targetPrice}
                  onChange={(e) =>
                    setForm({ ...form, targetPrice: e.target.value })
                  }
                  placeholder="925"
                />
              </Field>
            </div>
            <Field label="Note">
              <textarea
                data-testid="textarea-alert-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
                placeholder="What will you review at this level?"
              />
            </Field>
          </div>
          <ModalActions
            cancel={() => setShow(false)}
            submit={save}
            label="Create alert"
            testId="button-save-alert"
          />
        </Modal>
      )}
    </>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080c]/80 p-4">
      <div className="w-full max-w-[470px] rounded-xl border border-[#2a3946] bg-[#131d26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#273441] px-5 py-4">
          <div className="text-[15px] font-bold text-[#e6efef]">{title}</div>
          <button
            data-testid="button-close-modal"
            onClick={onClose}
            className="text-[#74848e]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function ModalActions({
  cancel,
  submit,
  label,
  testId,
}: {
  cancel: () => void;
  submit: () => void;
  label: string;
  testId: string;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-[#273441] pt-4">
      <button
        data-testid="button-cancel-modal"
        onClick={cancel}
        className="rounded-lg px-4 py-2.5 text-[11px] font-semibold text-[#8997a1] hover:bg-[#21303b]"
      >
        Cancel
      </button>
      <button
        data-testid={testId}
        onClick={submit}
        className="rounded-lg bg-[#4ce0b1] px-5 py-2.5 text-[11px] font-bold text-[#0d1b1a]"
      >
        {label}
      </button>
    </div>
  );
}

function Strategies({
  strategies,
  setStrategies,
  trades,
}: {
  strategies: Strategy[];
  setStrategies: (s: Strategy[]) => void;
  trades: Trade[];
}) {
  const [selected, setSelected] = useState<Strategy | null>(strategies[0]);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const blank = {
    id: `st-${Date.now()}`,
    name: "",
    description: "",
    preferredMarkets: "",
    preferredSession: "New York" as Session,
    riskRules: "",
    entryRules: "",
    exitRules: "",
    notes: "",
    tradeCount: 0,
    winRate: 0,
    profitFactor: 0,
    totalPnl: 0,
  };
  const selectedStats = summary(
    trades.filter((trade) => trade.strategy === selected?.name),
  );
  return (
    <>
      <PageTitle
        eyebrow="Build your playbook"
        title="Strategies"
        subtitle="Make your edge specific enough to repeat."
        action={
          <button
            data-testid="button-new-strategy"
            onClick={() => setEditing(blank)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4ce0b1] px-4 py-2.5 text-[12px] font-bold text-[#0d1b1a]"
          >
            <Plus size={15} /> New strategy
          </button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(250px,.72fr)_minmax(0,1.28fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#202b37] px-5 py-4">
            <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#738490]">
              Your playbook
            </div>
          </div>
          <div className="divide-y divide-[#202b37]">
            {strategies.map((s) => (
              <button
                data-testid={`button-select-strategy-${s.id}`}
                key={s.id}
                onClick={() => setSelected(s)}
                className={`block w-full px-5 py-4 text-left transition-colors ${selected?.id === s.id ? "bg-[#1d3534]" : "hover:bg-[#192530]"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#dce7e8]">
                    {s.name}
                  </span>
                  <ChevronRight
                    size={14}
                    className={
                      selected?.id === s.id ? "text-[#4ce0b1]" : "text-[#526370"
                    }
                  />
                </div>
                <div className="mt-1.5 text-[10px] text-[#74848f]">
                  {s.tradeCount} trades · {s.winRate}% win rate
                </div>
              </button>
            ))}
          </div>
        </Card>
        {selected ? (
          <Card className="p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 border-b border-[#273441] pb-5 sm:flex-row sm:items-start">
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#4ce0b1]">
                  <Crosshair size={12} /> Active playbook
                </div>
                <h2 className="text-[24px] font-bold tracking-[-.03em] text-[#e7eff0]">
                  {selected.name}
                </h2>
                <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-[#84949d]">
                  {selected.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="button-edit-strategy"
                  onClick={() => setEditing(selected)}
                  className="rounded-md border border-[#30404d] p-2 text-[#91a0aa] hover:bg-[#21313b]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  data-testid="button-delete-strategy"
                  onClick={() => {
                    if (
                      window.confirm(`Delete the ${selected.name} strategy?`)
                    ) {
                      setStrategies(
                        strategies.filter((x) => x.id !== selected.id),
                      );
                      setSelected(
                        strategies.find((x) => x.id !== selected.id) || null,
                      );
                    }
                  }}
                  className="rounded-md border border-[#523139] p-2 text-[#dc817a] hover:bg-[#351f26]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-b border-[#273441] py-5">
              <Stat
                label="Trades"
                value={`${selectedStats.total}`}
                sub="Recorded"
              />
              <Stat
                label="Win rate"
                value={`${selectedStats.winRate.toFixed(1)}%`}
                sub="Historical"
              />
              <Stat
                label="Profit factor"
                value={
                  Number.isFinite(selectedStats.profitFactor)
                    ? selectedStats.profitFactor.toFixed(2)
                    : "∞"
                }
                sub={money(selectedStats.netPnl)}
              />
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                ["Risk rules", selected.riskRules],
                ["Entry rules", selected.entryRules],
                ["Exit rules", selected.exitRules],
                ["Notes", selected.notes],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[#71828c]">
                    {l as string}
                  </div>
                  <div className="text-[12px] leading-relaxed text-[#aab9bf]">
                    {v as string}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#273441] pt-5">
              <span className="rounded-md bg-[#20343c] px-2.5 py-1.5 text-[10px] text-[#91d7c5]">
                {selected.preferredMarkets}
              </span>
              <span className="rounded-md bg-[#20343c] px-2.5 py-1.5 text-[10px] text-[#91d7c5]">
                {selected.preferredSession} session
              </span>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="No strategy selected"
              detail="Choose a playbook to inspect it."
            />
          </Card>
        )}
      </div>
      {editing && (
        <StrategyEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            const exists = strategies.some((x) => x.id === s.id);
            setStrategies(
              exists
                ? strategies.map((x) => (x.id === s.id ? s : x))
                : [s, ...strategies],
            );
            setSelected(s);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
function StrategyEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Strategy;
  onClose: () => void;
  onSave: (s: Strategy) => void;
}) {
  const [form, setForm] = useState(initial);
  const update = (key: keyof Strategy, value: string) =>
    setForm({
      ...form,
      [key]:
        key === "tradeCount" ||
        key === "winRate" ||
        key === "profitFactor" ||
        key === "totalPnl"
          ? Number(value)
          : value,
    });
  return (
    <Modal
      title={initial.name ? "Edit strategy" : "New strategy"}
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            data-testid="input-strategy-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Momentum pullback"
          />
        </Field>
        <Field label="Preferred session">
          <select
            data-testid="select-strategy-session"
            value={form.preferredSession}
            onChange={(e) => update("preferredSession", e.target.value)}
          >
            {["Asian", "London", "New York", "Overlap", "Other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Description">
          <textarea
            data-testid="textarea-strategy-description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Preferred markets">
          <input
            data-testid="input-strategy-markets"
            value={form.preferredMarkets}
            onChange={(e) => update("preferredMarkets", e.target.value)}
            placeholder="US equities, index futures"
          />
        </Field>
        <Field label="Risk rules">
          <textarea
            data-testid="textarea-strategy-risk"
            value={form.riskRules}
            onChange={(e) => update("riskRules", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Entry rules">
          <textarea
            data-testid="textarea-strategy-entry"
            value={form.entryRules}
            onChange={(e) => update("entryRules", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Exit rules">
          <textarea
            data-testid="textarea-strategy-exit"
            value={form.exitRules}
            onChange={(e) => update("exitRules", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Notes">
          <textarea
            data-testid="textarea-strategy-notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
          />
        </Field>
      </div>
      <ModalActions
        cancel={onClose}
        submit={() => onSave(form)}
        label={initial.name ? "Save strategy" : "Create strategy"}
        testId="button-save-strategy"
      />
    </Modal>
  );
}

function SettingsPage({
  settings,
  setSettings,
  onExport,
  onReset,
}: {
  settings: WorkspaceSettings;
  setSettings: (s: WorkspaceSettings) => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="Workspace controls"
        title="Settings"
        subtitle="Tune the space around how you review decisions."
        action={
          saved ? (
            <span className="flex items-center gap-2 text-[11px] text-[#67dcb5]">
              <Check size={14} /> Saved locally
            </span>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <SectionHead
              icon={<SlidersHorizontal size={16} />}
              title="Trading preferences"
              detail="Defaults used when adding and reviewing trades"
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Default risk per trade">
                <div className="relative">
                  <input
                    data-testid="input-default-risk"
                    value={draft.defaultRisk}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultRisk: Math.max(0, Number(e.target.value)),
                      })
                    }
                    type="number"
                    step=".05"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-[#71818b]">
                    %
                  </span>
                </div>
              </Field>
              <Field label="Base currency">
                <select
                  data-testid="select-currency"
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      currency: e.target.value as WorkspaceSettings["currency"],
                    })
                  }
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — Pound Sterling</option>
                </select>
              </Field>
              <Field label="Default session">
                <select
                  data-testid="select-default-session"
                  value={draft.defaultSession}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultSession: e.target.value as Session,
                    })
                  }
                >
                  <option>New York</option>
                  <option>London</option>
                  <option>Asian</option>
                  <option>Overlap</option>
                </select>
              </Field>
              <Field label="Week starts on">
                <select
                  data-testid="select-week-start"
                  value={draft.weekStart}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      weekStart: e.target
                        .value as WorkspaceSettings["weekStart"],
                    })
                  }
                >
                  <option>Monday</option>
                  <option>Sunday</option>
                </select>
              </Field>
            </div>
          </Card>
          <Card className="p-5">
            <SectionHead
              icon={<Layers3 size={16} />}
              title="Appearance"
              detail="Make the review space work for your eyes"
            />
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold text-[#b7c5ca]">
                Interface density
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Compact", "Comfortable", "Spacious"].map((x) => (
                  <button
                    data-testid={`button-density-${x.toLowerCase()}`}
                    key={x}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        density: x as WorkspaceSettings["density"],
                      })
                    }
                    className={`rounded-lg border p-3 text-left ${draft.density === x ? "border-[#3f9f85] bg-[#193633] text-[#7ee0c0]" : "border-[#293744] text-[#7b8b96] hover:bg-[#1a2731]"}`}
                  >
                    <div className="mb-2 flex gap-1">
                      <i className="h-1.5 w-full rounded bg-current opacity-70" />
                      <i className="h-1.5 w-2/3 rounded bg-current opacity-40" />
                    </div>
                    <span className="text-[10px] font-semibold">{x}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[#202b37] pt-4">
              <div>
                <div className="text-[12px] font-semibold text-[#b7c5ca]">
                  Confirm destructive actions
                </div>
                <div className="mt-1 text-[10px] text-[#74848e]">
                  Ask before deleting journal records
                </div>
              </div>
              <button
                data-testid="button-toggle-confirm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    confirmDestructive: !draft.confirmDestructive,
                  })
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${draft.confirmDestructive ? "bg-[#3c9e82]" : "bg-[#33404b]"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-[#dce9e8] transition-transform ${draft.confirmDestructive ? "left-6" : "left-1"}`}
                />
              </button>
            </div>
          </Card>
        </div>
        <Card className="h-fit p-5">
          <SectionHead
            icon={<ShieldCheck size={16} />}
            title="Workspace & account"
            detail="Local MVP controls"
          />
          <div className="mt-5 rounded-lg border border-[#293744] bg-[#0f171f] p-4">
            <div className="mb-1 text-[12px] font-semibold text-[#c5d2d6]">
              Personal workspace
            </div>
            <div className="text-[10px] text-[#73838e]">
              Your data stays in this browser for now.
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#202b37] pt-3 text-[10px]">
              <span className="text-[#71818d]">Storage used</span>
              <span className="font-mono text-[#b9c9cc]">124 KB</span>
            </div>
          </div>
          <button
            data-testid="button-export-data"
            onClick={onExport}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#2d3b48] py-2.5 text-[11px] font-semibold text-[#a9b8be] hover:bg-[#1b2933]"
          >
            <Download size={14} /> Export all data
          </button>
          <button
            data-testid="button-save-settings"
            onClick={() => {
              setSettings(draft);
              setSaved(true);
              setTimeout(() => setSaved(false), 1800);
            }}
            className="mt-3 w-full rounded-lg bg-[#4ce0b1] py-2.5 text-[11px] font-bold text-[#0d1b1a]"
          >
            Save preferences
          </button>
          <button
            data-testid="button-reset-data"
            onClick={onReset}
            className="mt-3 w-full rounded-lg border border-[#523139] py-2.5 text-[11px] font-semibold text-[#dc817a] hover:bg-[#351f26]"
          >
            Reset demo data
          </button>
          <div className="mt-6 border-t border-[#202b37] pt-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#c1ced2]">
              <FileText size={14} className="text-[#6d8490]" /> About TradeScope
            </div>
            <p className="text-[10px] leading-relaxed text-[#70808c]">
              Built for the part of trading that happens after the position is
              closed: the honest review, the pattern, and the next better
              decision.
            </p>
            <div className="mt-3 font-mono text-[9px] text-[#50616d]">
              RTR-TS / MVP 0.1.0
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
function SectionHead({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-[#203b3a] text-[#6edcba]">
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-bold text-[#dbe6e7]">{title}</div>
        <div className="mt-0.5 text-[10px] text-[#71818d]">{detail}</div>
      </div>
    </div>
  );
}

function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <div className="font-mono text-[48px] font-bold text-[#4ce0b1]">
          404
        </div>
        <div className="mt-2 text-[16px] font-bold">
          This page is off the chart.
        </div>
        <button
          data-testid="button-back-overview"
          onClick={() => setLocation("/")}
          className="mt-5 rounded-lg bg-[#4ce0b1] px-4 py-2 text-[11px] font-bold text-[#0d1b1a]"
        >
          Back to overview
        </button>
      </div>
    </div>
  );
}

function WorkspaceRouter() {
  const [location] = useLocation();
  const localTrades = usePersistentState(
    () => tradeStorage.get(initialTrades),
    tradeStorage.save,
  );
  const localAlerts = usePersistentState(
    () => alertStorage.get(initialAlerts),
    alertStorage.save,
  );
  const localStrategies = usePersistentState(
    () => strategyStorage.get(initialStrategies),
    strategyStorage.save,
  );
  const [trades, setTradesState, createTrade] = useBackendCollection(tradeResource, localTrades);
  const [alerts, setAlerts, createAlert] = useBackendCollection(alertResource, localAlerts);
  const [strategies, setStrategies] = useBackendCollection(strategyResource, localStrategies);
  const [settings, setSettings] = usePersistentState(
    settingsStorage.get,
    settingsStorage.save,
  );
  const setTrades = (next: Trade[] | ((t: Trade[]) => Trade[])) =>
    setTradesState(next);
  let page: ReactNode;
  if (location === "/") page = <Overview trades={trades} />;
  else if (location === "/journal")
    page = <Journal trades={trades} setTrades={setTradesState} />;
  else if (location === "/add-trade") page = <AddTrade createTrade={createTrade} />;
  else if (location === "/analytics") page = <Analytics trades={trades} />;
  else if (location === "/tradingview") page = <TradingViewPage createAlert={createAlert} />;
  else if (location === "/market-chart") page = <MarketChartPage createAlert={createAlert} />;
  else if (location === "/alerts")
    page = <Alerts alerts={alerts} setAlerts={setAlerts} />;
  else if (location === "/strategies")
    page = (
      <Strategies
        strategies={strategies}
        setStrategies={setStrategies}
        trades={trades}
      />
    );
  else if (location === "/settings")
    page = (
      <SettingsPage
        settings={settings}
        setSettings={setSettings}
        onExport={() =>
          exportWorkspace({ trades, alerts, strategies, settings })
        }
        onReset={() => {
          if (
            window.confirm(
              "Replace your current workspace with the original demo data?",
            )
          ) {
            resetStorage();
            setTradesState(initialTrades);
            setAlerts(initialAlerts);
            setStrategies(initialStrategies);
            setSettings(defaultSettings);
          }
        }}
      />
    );
  else page = <NotFound />;
  return <AppShell>{page}</AppShell>;
}

function AuthenticatedRouter() {
  const [location, setLocation] = useLocation();
  const { tester, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!tester && location !== "/login") setLocation("/login", { replace: true });
    if (tester && location === "/login") setLocation("/", { replace: true });
  }, [loading, location, tester, setLocation]);

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#0a1016] text-center text-[#8ba09f]">
        <div><img src="/assets/rtr-logo.jpeg" alt="Rags to Riches FX" className="mx-auto h-16 w-16 rounded-full bg-white object-contain" /><div className="mt-4 text-[11px] uppercase tracking-[.18em]">Restoring beta access…</div></div>
      </div>
    );
  }
  if (!tester) return <LoginPage />;
  return <WorkspaceRouter />;
}

const queryClient = new QueryClient();
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AuthenticatedRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
