import { useEffect, useState } from "react";
import { api, dataProvider } from "@/services/api";
import type { PriceAlert, Strategy, Trade } from "@/types/domain";

type ApiTrade = Record<string, unknown>;
type ApiStrategy = Record<string, unknown>;
type ApiAlert = Record<string, unknown>;

const number = (value: unknown) => Number(value ?? 0);

export const tradeResource = {
  path: "/api/trades",
  fromApi: (row: ApiTrade): Trade => ({
    id: String(row.id), symbol: String(row.symbol), direction: row.direction as Trade["direction"],
    entry: number(row.entry_price), stopLoss: number(row.stop_loss), takeProfit: number(row.take_profit),
    exit: number(row.exit_price), positionSize: number(row.position_size), date: String(row.trade_date),
    session: row.session as Trade["session"], strategy: String(row.strategy_name ?? ""),
    status: row.status as Trade["status"], result: row.result as Trade["result"], notes: String(row.notes ?? ""),
    pnl: number(row.pnl), rMultiple: number(row.realized_r), rr: number(row.risk_reward_ratio),
    screenshot: row.screenshot_url ? String(row.screenshot_url) : undefined,
  }),
  toApi: (trade: Trade) => ({
    symbol: trade.symbol, direction: trade.direction, entry_price: trade.entry, stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit || null, exit_price: trade.exit || null, position_size: trade.positionSize,
    trade_date: trade.date, closed_at: null, session: trade.session, strategy_id: null,
    strategy_name: trade.strategy, status: trade.status, result: trade.result, notes: trade.notes,
    screenshot_url: trade.screenshot || null,
  }),
};

export const strategyResource = {
  path: "/api/strategies",
  fromApi: (row: ApiStrategy): Strategy => ({
    id: String(row.id), name: String(row.name), description: String(row.description ?? ""),
    preferredMarkets: String(row.preferred_markets ?? ""), preferredSession: row.preferred_session as Strategy["preferredSession"],
    riskRules: String(row.risk_rules ?? ""), entryRules: String(row.entry_rules ?? ""),
    exitRules: String(row.exit_rules ?? ""), notes: String(row.notes ?? ""),
    tradeCount: 0, winRate: 0, profitFactor: 0, totalPnl: 0,
  }),
  toApi: (strategy: Strategy) => ({
    name: strategy.name, description: strategy.description, preferred_markets: strategy.preferredMarkets,
    preferred_session: strategy.preferredSession, risk_rules: strategy.riskRules, entry_rules: strategy.entryRules,
    exit_rules: strategy.exitRules, notes: strategy.notes,
  }),
};

export const alertResource = {
  path: "/api/alerts",
  fromApi: (row: ApiAlert): PriceAlert => ({
    id: String(row.id), instrument: String(row.symbol), targetPrice: number(row.target_price),
    condition: row.condition === "BELOW" ? "Below" : "Above",
    note: String(row.note ?? ""), status: row.status === "TRIGGERED" ? "Triggered" : "Active",
    createdAt: new Date(String(row.created_at)).toLocaleString(),
  }),
  toApi: (alert: PriceAlert) => ({
    symbol: alert.instrument, target_price: alert.targetPrice, condition: alert.condition.toUpperCase(),
    note: alert.note, status: alert.status.toUpperCase(), triggered_at: null,
  }),
};

type Resource<T> = { path: string; fromApi: (row: Record<string, unknown>) => T; toApi: (item: T) => unknown };

export function useBackendCollection<T extends { id: string }>(resource: Resource<T>, fallback: readonly [T[], (next: T[] | ((old: T[]) => T[])) => void]) {
  const [remote, setRemote] = useState<T[]>([]);
  useEffect(() => {
    if (dataProvider !== "api") return;
    api.get<Record<string, unknown>[]>(resource.path).then((rows) => setRemote(rows.map(resource.fromApi))).catch(console.error);
  }, [resource]);
  const create = async (item: T) => {
    if (dataProvider !== "api") {
      fallback[1]((current) => [item, ...current]);
      return item;
    }
    const saved = await api.post<Record<string, unknown>>(resource.path, resource.toApi(item));
    const mapped = resource.fromApi(saved);
    setRemote((current) => [mapped, ...current]);
    return mapped;
  };
  if (dataProvider !== "api") return [fallback[0], fallback[1], create] as const;
  const set = (next: T[] | ((old: T[]) => T[])) => setRemote((old) => {
    const resolved = typeof next === "function" ? next(old) : next;
    const oldIds = new Set(old.map((item) => item.id));
    const nextIds = new Set(resolved.map((item) => item.id));
    for (const item of old) if (!nextIds.has(item.id)) api.delete(`${resource.path}/${item.id}`).catch(console.error);
    for (const item of resolved) {
      const previous = old.find((candidate) => candidate.id === item.id);
      if (!oldIds.has(item.id)) {
        api.post<Record<string, unknown>>(resource.path, resource.toApi(item)).then((saved) =>
          setRemote((current) => current.map((candidate) => candidate.id === item.id ? resource.fromApi(saved) : candidate)),
        ).catch(console.error);
      } else if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
        api.put<Record<string, unknown>>(`${resource.path}/${item.id}`, resource.toApi(item)).then((saved) =>
          setRemote((current) => current.map((candidate) => candidate.id === item.id ? resource.fromApi(saved) : candidate)),
        ).catch(console.error);
      }
    }
    return resolved;
  });
  return [remote, set, create] as const;
}
