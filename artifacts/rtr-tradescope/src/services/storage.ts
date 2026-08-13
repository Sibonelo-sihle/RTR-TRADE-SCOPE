import type { PriceAlert, Settings, Strategy, Trade } from "@/types/domain";

const keys = {
  trades: "rtr-tradescope:trades:v1",
  alerts: "rtr-tradescope:alerts:v1",
  strategies: "rtr-tradescope:strategies:v1",
  settings: "rtr-tradescope:settings:v1",
} as const;
export const defaultSettings: Settings = {
  currency: "USD",
  defaultRisk: 0.5,
  defaultSession: "New York",
  weekStart: "Monday",
  density: "Comfortable",
  confirmDestructive: true,
};

function read<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : seed;
  } catch {
    localStorage.removeItem(key);
    return seed;
  }
}
function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export const tradeStorage = {
  get: (seed: Trade[] = []) => read(keys.trades, seed),
  save: (v: Trade[]) => write(keys.trades, v),
};
export const alertStorage = {
  get: (seed: PriceAlert[] = []) => read(keys.alerts, seed),
  save: (v: PriceAlert[]) => write(keys.alerts, v),
};
export const strategyStorage = {
  get: (seed: Strategy[] = []) => read(keys.strategies, seed),
  save: (v: Strategy[]) => write(keys.strategies, v),
};
export const settingsStorage = {
  get: () => read(keys.settings, defaultSettings),
  save: (v: Settings) => write(keys.settings, v),
};
export function resetStorage() {
  Object.values(keys).forEach((key) => localStorage.removeItem(key));
}
export function exportWorkspace(data: {
  trades: Trade[];
  alerts: PriceAlert[];
  strategies: Strategy[];
  settings: Settings;
}) {
  const blob = new Blob(
    [
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), ...data },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rtr-tradescope-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
