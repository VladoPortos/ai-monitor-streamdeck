/** Visual constants used by every render. Matches spec §7. */

export const KEY_SIZE = 144;

export const palette = {
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  text: "#f5f5f4",
  textMuted: "#a3a3a3",
  accent: "#cc785c",
  ok: "#16d97e",         // brighter, more saturated than tailwind green-500
  warn: "#f59e0b",
  caution: "#f97316",
  danger: "#ef4444",
  maintenance: "#3b82f6",
} as const;

export const font = {
  family: "Inter",
  label: { size: 14, weight: 400 },
  body: { size: 16, weight: 400 },
  big: { size: 32, weight: 700 },
  reset: { size: 12, weight: 400 },
} as const;

/** Map a normalized service-status enum to a palette color. */
export function statusColor(status: "ok" | "degraded" | "outage" | "maintenance"): string {
  switch (status) {
    case "ok": return palette.ok;
    case "degraded": return palette.warn;
    case "outage": return palette.danger;
    case "maintenance": return palette.maintenance;
  }
}
