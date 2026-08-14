import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, SeriesAttachedParameter, UTCTimestamp } from "lightweight-charts";
import type { StructureLevel, StructureZone } from "@/features/market-chart/analysis/types";

const prominence = { "4H": 1, "1H": 0.78, "15m": 0.58, "5m": 0.42 };

export class StructureOverlay implements ISeriesPrimitive<UTCTimestamp> {
  private attachedState?: SeriesAttachedParameter<UTCTimestamp>;
  private readonly view: IPrimitivePaneView;

  constructor(private zones: StructureZone[], private levels: StructureLevel[]) {
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };
    this.view = { zOrder: () => "bottom", renderer: () => renderer };
  }

  attached(parameter: SeriesAttachedParameter<UTCTimestamp>) {
    this.attachedState = parameter;
    parameter.requestUpdate();
  }

  detached() {
    this.attachedState = undefined;
  }

  paneViews() {
    return [this.view];
  }

  update(zones: StructureZone[], levels: StructureLevel[]) {
    this.zones = zones;
    this.levels = levels;
    this.attachedState?.requestUpdate();
  }

  private draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) {
    const state = this.attachedState;
    if (!state) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      for (const zone of this.zones) {
        const top = state.series.priceToCoordinate(zone.upper);
        const bottom = state.series.priceToCoordinate(zone.lower);
        const created = state.chart.timeScale().timeToCoordinate(zone.confirmedTime as UTCTimestamp);
        if (top === null || bottom === null || created === null) continue;
        const alpha = prominence[zone.timeframe] * (zone.state === "Mitigated" ? 0.45 : zone.state === "Tested" ? 0.72 : 1);
        const supply = zone.kind === "Supply";
        context.fillStyle = supply ? `rgba(212, 91, 91, ${0.12 * alpha})` : `rgba(57, 190, 142, ${0.12 * alpha})`;
        context.strokeStyle = supply ? `rgba(230, 115, 110, ${0.62 * alpha})` : `rgba(75, 214, 169, ${0.62 * alpha})`;
        context.lineWidth = zone.timeframe === "4H" ? 1.5 : 1;
        const x = Math.max(0, created);
        const y = Math.min(top, bottom);
        const height = Math.max(1, Math.abs(bottom - top));
        context.fillRect(x, y, mediaSize.width - x, height);
        context.strokeRect(x, y, mediaSize.width - x, height);
        context.fillStyle = supply ? `rgba(238, 157, 149, ${0.9 * alpha})` : `rgba(132, 229, 198, ${0.9 * alpha})`;
        context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
        const nested = zone.confluence.length ? ` +${zone.confluence.join("/")}` : "";
        context.fillText(`${zone.timeframe} ${zone.kind.toUpperCase()}${nested}`, Math.min(mediaSize.width - 115, x + 5), y + 11);
      }
      for (const level of this.levels) {
        const y = state.series.priceToCoordinate(level.price);
        const created = state.chart.timeScale().timeToCoordinate(level.confirmedTime as UTCTimestamp);
        if (y === null || created === null) continue;
        const alpha = prominence[level.timeframe];
        context.beginPath();
        context.setLineDash([4, 4]);
        context.strokeStyle = level.kind === "Support" ? `rgba(93, 184, 156, ${0.66 * alpha})` : `rgba(204, 151, 100, ${0.66 * alpha})`;
        context.lineWidth = 1;
        context.moveTo(Math.max(0, created), y);
        context.lineTo(mediaSize.width, y);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = level.kind === "Support" ? "#83cdb6" : "#d5aa7c";
        context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.fillText(`${level.timeframe} ${level.kind.toUpperCase()}`, Math.max(5, mediaSize.width - 105), y - 4);
      }
      context.restore();
    });
  }
}
