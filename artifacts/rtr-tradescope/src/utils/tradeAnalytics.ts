import type { Direction, Trade } from "@/types/domain";

export function calculateTrade(trade: Trade): Trade {
  const unitRisk = Math.abs(trade.entry - trade.stopLoss);
  const planned =
    trade.direction === "BUY"
      ? trade.takeProfit - trade.entry
      : trade.entry - trade.takeProfit;
  const actual =
    trade.direction === "BUY"
      ? trade.exit - trade.entry
      : trade.entry - trade.exit;
  const pnl =
    trade.status === "Closed" && trade.exit > 0
      ? actual * trade.positionSize
      : 0;
  return {
    ...trade,
    rr: unitRisk > 0 && trade.takeProfit > 0 ? Math.abs(planned) / unitRisk : 0,
    pnl,
    rMultiple:
      unitRisk > 0 && trade.status === "Closed" && trade.exit > 0
        ? actual / unitRisk
        : 0,
  };
}
export function validateTrade(t: Trade) {
  const errors: Partial<Record<keyof Trade, string>> = {};
  if (!t.symbol.trim()) errors.symbol = "Symbol is required.";
  if (!(t.entry > 0)) errors.entry = "Enter a valid entry price.";
  if (!(t.stopLoss > 0)) errors.stopLoss = "Enter a valid stop loss.";
  if (t.positionSize < 0)
    errors.positionSize = "Position size cannot be negative.";
  if (!t.date) errors.date = "Date is required.";
  if (t.direction === "BUY" && t.stopLoss >= t.entry)
    errors.stopLoss = "A BUY stop should be below entry.";
  if (t.direction === "SELL" && t.stopLoss <= t.entry)
    errors.stopLoss = "A SELL stop should be above entry.";
  if (t.takeProfit > 0 && t.direction === "BUY" && t.takeProfit <= t.entry)
    errors.takeProfit = "A BUY target should be above entry.";
  if (t.takeProfit > 0 && t.direction === "SELL" && t.takeProfit >= t.entry)
    errors.takeProfit = "A SELL target should be below entry.";
  return errors;
}
export function summary(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "Closed");
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const grossProfit = wins.reduce((n, t) => n + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((n, t) => n + t.pnl, 0));
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return {
    total: trades.length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: closed.filter((t) => t.pnl === 0).length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    netPnl: grossProfit - grossLoss,
    averageRR: average(closed.map((t) => t.rr)),
    averageR: average(closed.map((t) => t.rMultiple)),
    averageWinner: average(wins.map((t) => t.pnl)),
    averageLoser: average(losses.map((t) => Math.abs(t.pnl))),
    profitFactor: grossLoss
      ? grossProfit / grossLoss
      : grossProfit
        ? Infinity
        : 0,
  };
}
export function directionPnl(trades: Trade[], direction: Direction) {
  return trades
    .filter((t) => t.status === "Closed" && t.direction === direction)
    .reduce((n, t) => n + t.pnl, 0);
}
