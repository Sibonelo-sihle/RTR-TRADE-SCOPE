import type { Direction, Session } from "@/types/domain";

export interface TradePrefill { symbol: string; direction: Direction; date: string; session: Session; strategy: string; notes: string }
const key = "rtr-market-chart-trade-prefill";

export function sessionForTimestamp(timestamp: number): Session {
  const hour = new Date(timestamp * 1000).getUTCHours();
  if (hour < 7) return "Asian";
  if (hour < 12) return "London";
  if (hour < 16) return "Overlap";
  return "New York";
}
export const tradePrefill = {
  save(value: TradePrefill) { sessionStorage.setItem(key, JSON.stringify(value)); },
  read(): TradePrefill | null { try { return JSON.parse(sessionStorage.getItem(key) || "null") as TradePrefill | null; } catch { return null; } },
  clear() { sessionStorage.removeItem(key); },
};
