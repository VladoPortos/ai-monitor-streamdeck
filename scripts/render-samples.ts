// Render sample key PNGs for visual QA.
// Run with: node scripts/render-samples.mjs
// Output: ./preview/*.png

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFonts, renderToPng } from "../src/plugin/render/renderer.ts";
import {
  buildUsageBucketTree,
  buildExtraUsageTree,
  buildStatusTree,
  buildSimpleIconTree,
  buildResetCountdownTree,
} from "../src/plugin/render/keyTrees.ts";
import { palette } from "../src/plugin/render/theme.ts";
import {
  buildUsageBucketProps,
  buildExtraUsageProps,
  buildStatusOverallProps,
  buildComponentStatusProps,
  buildResetCountdownProps,
} from "../src/plugin/render/keyProps.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fontsDir = join(ROOT, "com.vladoportos.aimonitor.sdPlugin", "fonts");
const outDir = join(ROOT, "preview");
mkdirSync(outDir, { recursive: true });

await loadFonts(fontsDir);

const now = new Date("2026-05-17T12:00:00Z");

// Synthetic snapshots for variety
const lowSnap = {
  fetchedAt: now,
  data: {
    five_hour: { utilization: 12, resets_at: new Date("2026-05-17T16:33:00Z") },
    seven_day: { utilization: 18, resets_at: new Date("2026-05-18T10:00:00Z") },
    seven_day_sonnet: { utilization: 4, resets_at: null },
    seven_day_omelette: { utilization: 0, resets_at: null },
    seven_day_opus: null,
    seven_day_oauth_apps: null,
    seven_day_cowork: null,
    tangelo: null,
    iguana_necktie: null,
    omelette_promotional: null,
    extra_usage: { is_enabled: true, monthly_limit: 10000, used_credits: 0, utilization: 0, currency: "USD", disabled_reason: null },
  },
};

const warnSnap = JSON.parse(JSON.stringify(lowSnap, (k, v) => v instanceof Date ? { __d: v.toISOString() } : v));
function revive(o) {
  if (o && typeof o === "object") {
    if ("__d" in o) return new Date(o.__d);
    for (const k of Object.keys(o)) o[k] = revive(o[k]);
  }
  return o;
}
revive(warnSnap);
warnSnap.data.five_hour.utilization = 72;
warnSnap.data.seven_day.utilization = 88;
warnSnap.data.extra_usage.used_credits = 6300;
warnSnap.data.extra_usage.utilization = 63;

const dangerSnap = JSON.parse(JSON.stringify(warnSnap, (k, v) => v instanceof Date ? { __d: v.toISOString() } : v));
revive(dangerSnap);
dangerSnap.data.five_hour.utilization = 97;
dangerSnap.data.seven_day.utilization = 99;
dangerSnap.data.extra_usage.used_credits = 9500;
dangerSnap.data.extra_usage.utilization = 95;

const statusOk = { fetchedAt: now, data: { status: { indicator: "none", description: "All Systems Operational" }, components: [], incidents: [], scheduled_maintenances: [], page: { id: "x", name: "Claude", url: "x", time_zone: "UTC", updated_at: now.toISOString() } } };
const statusBad = { fetchedAt: now, data: { status: { indicator: "major", description: "Service Disruption" }, components: [{ id: "k8w3r06qmzrp", name: "Claude API (api.anthropic.com)", status: "major_outage", updated_at: "", position: 3, description: null, showcase: true, only_show_if_degraded: false }], incidents: [{ id: "1", name: "Elevated error rates", status: "identified", impact: "major", started_at: "", created_at: "", updated_at: "", resolved_at: null, shortlink: "" }], scheduled_maintenances: [], page: { id: "x", name: "Claude", url: "x", time_zone: "UTC", updated_at: now.toISOString() } } };

function bucketWith(style: "ring" | "bar", input: Parameters<typeof buildUsageBucketProps>[0]) {
  return buildUsageBucketTree({ ...buildUsageBucketProps(input), style });
}

const samples = [
  // RING style — circular gauge
  ["ring-5h-low",        bucketWith("ring", { snapshot: lowSnap,    bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["ring-5h-warn",       bucketWith("ring", { snapshot: warnSnap,   bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["ring-5h-danger",     bucketWith("ring", { snapshot: dangerSnap, bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["ring-weekly-warn",   bucketWith("ring", { snapshot: warnSnap,   bucket: "seven_day",        now, stale: false, timeZone: "UTC" })],
  ["ring-sonnet-empty",  bucketWith("ring", { snapshot: lowSnap,    bucket: "seven_day_sonnet", now, stale: false, timeZone: "UTC" })],
  ["ring-stale",         bucketWith("ring", { snapshot: warnSnap,   bucket: "five_hour",        now, stale: true,  timeZone: "UTC" })],
  ["ring-unknown",       bucketWith("ring", { snapshot: null,       bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  // BAR style — bold label + giant %, thick bar
  ["bar-5h-low",         bucketWith("bar",  { snapshot: lowSnap,    bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["bar-5h-warn",        bucketWith("bar",  { snapshot: warnSnap,   bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["bar-5h-danger",      bucketWith("bar",  { snapshot: dangerSnap, bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["bar-weekly-warn",    bucketWith("bar",  { snapshot: warnSnap,   bucket: "seven_day",        now, stale: false, timeZone: "UTC" })],
  ["bar-stale",          bucketWith("bar",  { snapshot: warnSnap,   bucket: "five_hour",        now, stale: true,  timeZone: "UTC" })],
  ["bar-unknown",        bucketWith("bar",  { snapshot: null,       bucket: "five_hour",        now, stale: false, timeZone: "UTC" })],
  ["extra-zero",           buildExtraUsageTree(buildExtraUsageProps({ snapshot: lowSnap,    now, stale: false }))],
  ["extra-warn",           buildExtraUsageTree(buildExtraUsageProps({ snapshot: warnSnap,   now, stale: false }))],
  ["extra-danger",         buildExtraUsageTree(buildExtraUsageProps({ snapshot: dangerSnap, now, stale: false }))],
  ["status-ok",            buildStatusTree(buildStatusOverallProps({ snapshot: statusOk }))],
  ["status-outage",        buildStatusTree(buildStatusOverallProps({ snapshot: statusBad }))],
  ["status-api-outage",    buildStatusTree(buildComponentStatusProps({ snapshot: statusBad, component: "api" }))],
  ["icon-refresh",         buildSimpleIconTree({ glyph: "↻", sublabel: "Refresh", color: palette.text })],
  ["icon-open",            buildSimpleIconTree({ glyph: "✦", sublabel: "Open", color: palette.accent })],
  // RESET COUNTDOWN
  ["reset-5h-low",         buildResetCountdownTree(buildResetCountdownProps({ snapshot: lowSnap,    bucket: "five_hour", now }))],
  ["reset-5h-warn",        buildResetCountdownTree(buildResetCountdownProps({ snapshot: warnSnap,   bucket: "five_hour", now }))],
  ["reset-5h-danger",      buildResetCountdownTree(buildResetCountdownProps({ snapshot: dangerSnap, bucket: "five_hour", now }))],
  ["reset-weekly",         buildResetCountdownTree(buildResetCountdownProps({ snapshot: warnSnap,   bucket: "seven_day", now }))],
];

for (const [name, tree] of samples) {
  const png = await renderToPng(tree);
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file}`);
}
console.log(`\n${samples.length} sample(s) in ${outDir}`);
