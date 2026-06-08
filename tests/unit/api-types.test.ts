import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  UsageResponse,
  StatusSummaryResponse,
  normalizeStatusIndicator,
  normalizeComponentStatus,
} from "../../src/plugin/api/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name: string) => resolve(__dirname, "../fixtures", name);
const readJson = (name: string) => {
  const raw = readFileSync(fixturePath(name), "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
};

describe("UsageResponse schema", () => {
  it("parses the idle Max 20x fixture", () => {
    const parsed = UsageResponse.parse(readJson("usage-max20x-idle.json"));
    expect(parsed.five_hour.utilization).toBe(0);
    expect(parsed.seven_day.utilization).toBe(1);
    expect(parsed.extra_usage.currency).toBe("USD");
    expect(parsed.extra_usage.monthly_limit).toBe(10000);
  });

  it("parses the warning fixture", () => {
    const parsed = UsageResponse.parse(readJson("usage-max20x-warning.json"));
    expect(parsed.five_hour.utilization).toBe(68);
    expect(parsed.seven_day.utilization).toBe(78.5);
    expect(parsed.extra_usage.utilization).toBeCloseTo(8.33);
  });

  it("parses the critical fixture", () => {
    const parsed = UsageResponse.parse(readJson("usage-max20x-critical.json"));
    expect(parsed.five_hour.utilization).toBe(96);
    expect(parsed.seven_day.utilization).toBe(98.5);
    expect(parsed.seven_day_sonnet?.utilization).toBe(67);
  });

  it("parses the Pro fixture (seven_day_opus populated)", () => {
    const parsed = UsageResponse.parse(readJson("usage-pro.json"));
    expect(parsed.seven_day_opus).not.toBeNull();
    expect(parsed.seven_day_opus?.utilization).toBe(58);
    expect(parsed.extra_usage.is_enabled).toBe(false);
    expect(parsed.extra_usage.disabled_reason).toBe("not_eligible");
  });

  it("parses the empty fixture (all nulls)", () => {
    const parsed = UsageResponse.parse(readJson("usage-empty.json"));
    expect(parsed.five_hour.utilization).toBe(0);
    expect(parsed.seven_day.utilization).toBe(0);
    expect(parsed.seven_day_sonnet).toBeNull();
    expect(parsed.seven_day_omelette).toBeNull();
  });

  it("rejects payload missing required five_hour bucket", () => {
    const bad = { ...readJson("usage-max20x-idle.json") };
    delete bad.five_hour;
    expect(() => UsageResponse.parse(bad)).toThrow();
  });

  it("accepts ISO timestamps in resets_at", () => {
    const parsed = UsageResponse.parse(readJson("usage-max20x-idle.json"));
    expect(parsed.five_hour.resets_at).toBeInstanceOf(Date);
  });
});

describe("StatusSummaryResponse schema", () => {
  it("parses the operational fixture", () => {
    const parsed = StatusSummaryResponse.parse(readJson("status-summary-operational.json"));
    expect(parsed.status.indicator).toBe("none");
    expect(parsed.components.length).toBeGreaterThan(0);
    expect(parsed.incidents).toEqual([]);
  });

  it("parses the degraded fixture", () => {
    const parsed = StatusSummaryResponse.parse(readJson("status-summary-degraded.json"));
    expect(parsed.status.indicator).toBe("minor");
    const api = parsed.components.find((c) => c.name.includes("Claude API"));
    expect(api?.status).toBe("degraded_performance");
  });

  it("parses the incident fixture with active incident", () => {
    const parsed = StatusSummaryResponse.parse(readJson("status-summary-incident.json"));
    expect(parsed.status.indicator).toBe("major");
    expect(parsed.incidents.length).toBe(1);
    expect(parsed.incidents[0]?.status).toBe("identified");
  });

  it("parses the maintenance fixture", () => {
    const parsed = StatusSummaryResponse.parse(readJson("status-summary-maintenance.json"));
    expect(parsed.status.indicator).toBe("maintenance");
    expect(parsed.scheduled_maintenances.length).toBe(1);
  });
});

describe("normalizeStatusIndicator", () => {
  it("maps Statuspage indicators to plugin enum", () => {
    expect(normalizeStatusIndicator("none")).toBe("ok");
    expect(normalizeStatusIndicator("minor")).toBe("degraded");
    expect(normalizeStatusIndicator("major")).toBe("outage");
    expect(normalizeStatusIndicator("critical")).toBe("outage");
    expect(normalizeStatusIndicator("maintenance")).toBe("maintenance");
  });
});

describe("normalizeComponentStatus", () => {
  it("maps Statuspage component statuses to plugin enum", () => {
    expect(normalizeComponentStatus("operational")).toBe("ok");
    expect(normalizeComponentStatus("under_maintenance")).toBe("maintenance");
    expect(normalizeComponentStatus("degraded_performance")).toBe("degraded");
    expect(normalizeComponentStatus("partial_outage")).toBe("outage");
    expect(normalizeComponentStatus("major_outage")).toBe("outage");
  });
});
