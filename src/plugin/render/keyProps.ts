import type { UsageResponseT, UtilizationBucketT } from "../api/types.js";
import type { UsageSnapshot } from "../state/store.js";
import { gradeColor, DEFAULT_BANDS, type ColorBands } from "../util/colors.js";
import { formatCountdown, formatResetClock } from "../util/intervals.js";
import { palette } from "./theme.js";
import type {
  UsageBucketProps,
  ExtraUsageProps,
  StatusTreeProps,
  NormalizedStatusKey,
} from "./keyTrees.js";
import { normalizeComponentStatus, normalizeStatusIndicator } from "../api/types.js";
import type { StatusSnapshot } from "../state/store.js";

export type BucketName =
  | "five_hour"
  | "seven_day"
  | "seven_day_sonnet"
  | "seven_day_opus"
  | "seven_day_omelette";

export function bucketDisplayLabel(b: BucketName): string {
  switch (b) {
    case "five_hour": return "5h";
    case "seven_day": return "Weekly";
    case "seven_day_sonnet": return "Sonnet";
    case "seven_day_opus": return "Opus";
    case "seven_day_omelette": return "Design";
  }
}

function bucketAt(data: UsageResponseT, name: BucketName): UtilizationBucketT | null {
  const v = data[name];
  return v ?? null;
}

export interface BuildUsageBucketPropsInput {
  snapshot: UsageSnapshot | null;
  bucket: BucketName;
  now: Date;
  stale: boolean;
  bands?: ColorBands;
  timeZone?: string;
}

export function buildUsageBucketProps(input: BuildUsageBucketPropsInput): UsageBucketProps {
  const bands = input.bands ?? DEFAULT_BANDS;
  const label = bucketDisplayLabel(input.bucket);

  if (!input.snapshot) {
    return {
      label,
      percent: null,
      color: palette.textMuted,
      resetText: "—",
      stale: input.stale,
      unknown: true,
    };
  }

  const bucket = bucketAt(input.snapshot.data, input.bucket);
  if (!bucket) {
    return {
      label,
      percent: null,
      color: palette.textMuted,
      resetText: "—",
      stale: input.stale,
      unknown: true,
    };
  }

  const clockOpts = input.timeZone ? { timeZone: input.timeZone } : {};
  const resetText = formatResetClock(bucket.resets_at, input.now, clockOpts);
  return {
    label,
    percent: bucket.utilization,
    color: gradeColor(bucket.utilization, bands),
    resetText,
    stale: input.stale,
    unknown: false,
  };
}

export interface BuildResetCountdownPropsInput {
  snapshot: UsageSnapshot | null;
  bucket: BucketName;
  now: Date;
  bands?: ColorBands;
}

export interface ResetCountdownComputedProps {
  label: string;
  countdownText: string;
  utilization: number | null;
  color: string;
  unknown: boolean;
}

export function buildResetCountdownProps(input: BuildResetCountdownPropsInput): ResetCountdownComputedProps {
  const bands = input.bands ?? DEFAULT_BANDS;
  const label = bucketDisplayLabel(input.bucket);
  if (!input.snapshot) {
    return { label, countdownText: "—", utilization: null, color: palette.textMuted, unknown: true };
  }
  const bucket = bucketAt(input.snapshot.data, input.bucket);
  if (!bucket) {
    return { label, countdownText: "—", utilization: null, color: palette.textMuted, unknown: true };
  }
  return {
    label,
    countdownText: formatCountdown(bucket.resets_at, input.now),
    utilization: bucket.utilization,
    color: gradeColor(bucket.utilization, bands),
    unknown: bucket.resets_at === null,
  };
}

export interface BuildExtraUsagePropsInput {
  snapshot: UsageSnapshot | null;
  now: Date;
  stale: boolean;
  bands?: ColorBands;
}

export function buildExtraUsageProps(input: BuildExtraUsagePropsInput): ExtraUsageProps {
  const bands = input.bands ?? DEFAULT_BANDS;
  if (!input.snapshot) {
    return {
      currency: "USD",
      usedMinor: 0,
      limitMinor: 0,
      utilization: null,
      color: palette.textMuted,
      stale: input.stale,
      disabled: true,
    };
  }
  const e = input.snapshot.data.extra_usage;
  const pct = e.utilization ?? (e.monthly_limit > 0 ? (e.used_credits / e.monthly_limit) * 100 : 0);
  return {
    currency: e.currency,
    usedMinor: e.used_credits,
    limitMinor: e.monthly_limit,
    utilization: e.utilization,
    color: gradeColor(pct, bands),
    stale: input.stale,
    disabled: !e.is_enabled,
  };
}

export interface PickHeadlineInput {
  snapshot: UsageSnapshot | null;
  candidates: BucketName[];
}

export function pickHeadlineBucket(input: PickHeadlineInput): BucketName | null {
  if (!input.snapshot) return null;
  let best: { name: BucketName; pct: number } | null = null;
  for (const name of input.candidates) {
    const b = bucketAt(input.snapshot.data, name);
    if (b === null) continue;
    if (best === null || b.utilization > best.pct) {
      best = { name, pct: b.utilization };
    }
  }
  return best?.name ?? null;
}

// =============================================================================
// STATUS PROPS
// =============================================================================

export type ComponentKey = "web" | "api" | "console" | "code" | "cowork" | "gov";

const COMPONENT_NAME_MAP: Record<ComponentKey, { label: string; nameContains: string }> = {
  web: { label: "claude.ai", nameContains: "claude.ai" },
  api: { label: "Claude API", nameContains: "Claude API" },
  console: { label: "Console", nameContains: "Claude Console" },
  code: { label: "Claude Code", nameContains: "Claude Code" },
  cowork: { label: "Cowork", nameContains: "Cowork" },
  gov: { label: "Government", nameContains: "Government" },
};

export interface BuildStatusOverallPropsInput {
  snapshot: StatusSnapshot | null;
}

export function buildStatusOverallProps(input: BuildStatusOverallPropsInput): StatusTreeProps {
  if (!input.snapshot) {
    return {
      label: "Status",
      description: "Unknown",
      status: "outage",
      pulse: false,
    };
  }
  const indicator = input.snapshot.data.status.indicator;
  const normalized: NormalizedStatusKey = normalizeStatusIndicator(indicator);
  const incidents = input.snapshot.data.incidents;
  const description = incidents.length > 0
    ? incidents[0]!.name
    : input.snapshot.data.status.description;
  return {
    label: "All Systems",
    description,
    status: normalized,
    pulse: normalized !== "ok" && normalized !== "maintenance",
  };
}

export interface BuildComponentStatusPropsInput {
  snapshot: StatusSnapshot | null;
  component: ComponentKey;
}

export function buildComponentStatusProps(input: BuildComponentStatusPropsInput): StatusTreeProps {
  const meta = COMPONENT_NAME_MAP[input.component];
  if (!input.snapshot) {
    return { label: meta.label, description: "Unknown", status: "outage", pulse: false };
  }
  const match = input.snapshot.data.components.find((c) => c.name.includes(meta.nameContains));
  if (!match) {
    return { label: meta.label, description: "Not tracked", status: "outage", pulse: false };
  }
  const normalized = normalizeComponentStatus(match.status);
  return {
    label: meta.label,
    description: humanizeComponentStatus(match.status),
    status: normalized,
    pulse: normalized !== "ok" && normalized !== "maintenance",
  };
}

function humanizeComponentStatus(s: string): string {
  switch (s) {
    case "operational": return "Operational";
    case "under_maintenance": return "Maintenance";
    case "degraded_performance": return "Degraded";
    case "partial_outage": return "Partial outage";
    case "major_outage": return "Major outage";
    default: return s;
  }
}
