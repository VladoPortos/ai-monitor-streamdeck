export interface ColorBand {
  upTo: number;
  color: string;
}

export interface ColorBands {
  ok: ColorBand;
  warn: ColorBand;
  caution: ColorBand;
  danger: { color: string };
}

export const DEFAULT_BANDS: ColorBands = {
  ok: { upTo: 60, color: "#22c55e" },
  warn: { upTo: 80, color: "#f59e0b" },
  caution: { upTo: 95, color: "#f97316" },
  danger: { color: "#ef4444" },
};

export function gradeColor(utilization: number, bands: ColorBands = DEFAULT_BANDS): string {
  if (Number.isNaN(utilization)) return bands.danger.color;
  if (utilization < bands.ok.upTo) return bands.ok.color;
  if (utilization < bands.warn.upTo) return bands.warn.color;
  if (utilization < bands.caution.upTo) return bands.caution.color;
  return bands.danger.color;
}
