import { z } from "zod";

/** ISO 8601 timestamp coerced into a Date, or null. */
const NullableTimestamp = z
  .union([z.string(), z.null()])
  .transform((v) => (v === null ? null : new Date(v)));

const UtilizationBucket = z.object({
  utilization: z.number(),
  resets_at: NullableTimestamp,
});

const NullableBucket = z.union([UtilizationBucket, z.null()]);

export const ExtraUsage = z.object({
  is_enabled: z.boolean(),
  monthly_limit: z.number(),
  used_credits: z.number(),
  utilization: z.number().nullable(),
  currency: z.string(),
  disabled_reason: z.string().nullable(),
});

/**
 * Response from `GET https://api.anthropic.com/api/oauth/usage`
 * and the equivalent `claude.ai/api/organizations/{orgId}/usage`.
 *
 * Verified against a Max 20x plan response on 2026-05-17.
 */
export const UsageResponse = z.object({
  five_hour: UtilizationBucket,
  seven_day: UtilizationBucket,
  seven_day_oauth_apps: NullableBucket.optional().default(null),
  seven_day_opus: NullableBucket.optional().default(null),
  seven_day_sonnet: NullableBucket.optional().default(null),
  seven_day_cowork: NullableBucket.optional().default(null),
  seven_day_omelette: NullableBucket.optional().default(null),
  tangelo: NullableBucket.optional().default(null),
  iguana_necktie: NullableBucket.optional().default(null),
  omelette_promotional: NullableBucket.optional().default(null),
  extra_usage: ExtraUsage,
});
export type UsageResponseT = z.infer<typeof UsageResponse>;
export type UtilizationBucketT = z.infer<typeof UtilizationBucket>;
export type ExtraUsageT = z.infer<typeof ExtraUsage>;

/** Statuspage v2 component status values. */
export const StatusComponentStatus = z.enum([
  "operational",
  "under_maintenance",
  "degraded_performance",
  "partial_outage",
  "major_outage",
]);
export type StatusComponentStatusT = z.infer<typeof StatusComponentStatus>;

/** Statuspage v2 overall indicator values. */
export const StatusIndicator = z.enum(["none", "minor", "major", "critical", "maintenance"]);
export type StatusIndicatorT = z.infer<typeof StatusIndicator>;

const StatusComponent = z.object({
  id: z.string(),
  name: z.string(),
  status: StatusComponentStatus,
  updated_at: z.string(),
  position: z.number().int(),
  description: z.string().nullable(),
  showcase: z.boolean(),
  only_show_if_degraded: z.boolean(),
});

const StatusIncident = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string(),
  started_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  shortlink: z.string(),
});

const ScheduledMaintenance = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string(),
  scheduled_for: z.string(),
  scheduled_until: z.string(),
});

export const StatusSummaryResponse = z.object({
  page: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    time_zone: z.string(),
    updated_at: z.string(),
  }),
  status: z.object({
    indicator: StatusIndicator,
    description: z.string(),
  }),
  components: z.array(StatusComponent),
  incidents: z.array(StatusIncident),
  scheduled_maintenances: z.array(ScheduledMaintenance),
});
export type StatusSummaryResponseT = z.infer<typeof StatusSummaryResponse>;

/** Plugin-internal normalized status enum for UI display. */
export type NormalizedStatus = "ok" | "degraded" | "outage" | "maintenance";

export function normalizeStatusIndicator(indicator: StatusIndicatorT): NormalizedStatus {
  switch (indicator) {
    case "none":
      return "ok";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "outage";
    case "maintenance":
      return "maintenance";
  }
}

export function normalizeComponentStatus(status: StatusComponentStatusT): NormalizedStatus {
  switch (status) {
    case "operational":
      return "ok";
    case "under_maintenance":
      return "maintenance";
    case "degraded_performance":
      return "degraded";
    case "partial_outage":
    case "major_outage":
      return "outage";
  }
}
