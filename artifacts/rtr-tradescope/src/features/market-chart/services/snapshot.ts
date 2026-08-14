export function chartSnapshot(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to generate chart PNG")), "image/png"));
}

export function snapshotFilename(symbol: string, timeframe: string, date = new Date()) {
  return `RTR_${symbol}_${timeframe}_${date.toISOString().slice(0, 10)}.png`;
}

export function downloadSnapshot(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
