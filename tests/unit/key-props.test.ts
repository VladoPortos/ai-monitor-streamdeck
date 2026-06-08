import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { UsageResponse } from "../../src/plugin/api/types.js";
import {
  bucketDisplayLabel,
  buildUsageBucketProps,
  pickHeadlineBucket,
  buildExtraUsageProps,
  type BucketName,
} from "../../src/plugin/render/keyProps.js";
import { DEFAULT_BANDS } from "../../src/plugin/util/colors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return UsageResponse.parse(JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw));
};

describe("bucketDisplayLabel", () => {
  it("maps known bucket names to short labels", () => {
    expect(bucketDisplayLabel("five_hour")).toBe("5h");
    expect(bucketDisplayLabel("seven_day")).toBe("Weekly");
    expect(bucketDisplayLabel("seven_day_sonnet")).toBe("Sonnet");
    expect(bucketDisplayLabel("seven_day_opus")).toBe("Opus");
    expect(bucketDisplayLabel("seven_day_omelette")).toBe("Design");
  });
});

describe("buildUsageBucketProps", () => {
  const now = new Date("2026-05-17T12:00:00Z");

  it("produces unknown=true when snapshot is null", () => {
    const props = buildUsageBucketProps({
      snapshot: null,
      bucket: "five_hour",
      now,
      stale: false,
    });
    expect(props.unknown).toBe(true);
    expect(props.percent).toBeNull();
    expect(props.resetText).toBe("—");
  });

  it("produces unknown=true when the chosen bucket is null in the data", () => {
    const data = readFixture("usage-empty.json");
    const props = buildUsageBucketProps({
      snapshot: { data, fetchedAt: now },
      bucket: "seven_day_sonnet",
      now,
      stale: false,
    });
    expect(props.unknown).toBe(true);
  });

  it("produces percent + reset for an active bucket", () => {
    const data = readFixture("usage-max20x-warning.json");
    const props = buildUsageBucketProps({
      snapshot: { data, fetchedAt: now },
      bucket: "seven_day",
      now,
      stale: false,
    });
    expect(props.percent).toBe(78.5);
    expect(props.unknown).toBe(false);
    expect(props.resetText).not.toBe("—");
  });

  it("uses warn color in the warn band", () => {
    const data = readFixture("usage-max20x-warning.json");
    const props = buildUsageBucketProps({
      snapshot: { data, fetchedAt: now },
      bucket: "seven_day",
      now,
      stale: false,
    });
    expect(props.color).toBe(DEFAULT_BANDS.warn.color); // 78.5 is in the warn band
  });

  it("propagates stale flag through", () => {
    const data = readFixture("usage-max20x-warning.json");
    const props = buildUsageBucketProps({
      snapshot: { data, fetchedAt: now },
      bucket: "seven_day",
      now,
      stale: true,
    });
    expect(props.stale).toBe(true);
  });
});

describe("buildExtraUsageProps", () => {
  const now = new Date();

  it("disabled when is_enabled=false", () => {
    const data = readFixture("usage-pro.json");
    const props = buildExtraUsageProps({ snapshot: { data, fetchedAt: now }, now, stale: false });
    expect(props.disabled).toBe(true);
  });

  it("renders amounts and color from utilization", () => {
    const data = readFixture("usage-max20x-warning.json");
    const props = buildExtraUsageProps({ snapshot: { data, fetchedAt: now }, now, stale: false });
    expect(props.disabled).toBe(false);
    expect(props.usedMinor).toBe(833);
    expect(props.limitMinor).toBe(10000);
    expect(props.currency).toBe("USD");
    expect(props.color).toBe(DEFAULT_BANDS.ok.color); // 8.33% is in ok band
  });
});

describe("pickHeadlineBucket", () => {
  const now = new Date();

  it("picks the highest-utilization bucket from the set", () => {
    const data = readFixture("usage-max20x-warning.json");
    const choice = pickHeadlineBucket({
      snapshot: { data, fetchedAt: now },
      candidates: ["five_hour", "seven_day", "seven_day_sonnet", "seven_day_omelette"],
    });
    expect(choice).toBe("seven_day"); // 78.5 > 68 > 22 > 5
  });

  it("skips excluded buckets", () => {
    const data = readFixture("usage-max20x-warning.json");
    const choice = pickHeadlineBucket({
      snapshot: { data, fetchedAt: now },
      candidates: ["five_hour", "seven_day_sonnet"],
    });
    expect(choice).toBe("five_hour"); // 68 > 22
  });

  it("returns null when no candidate has data", () => {
    const data = readFixture("usage-empty.json");
    const choice = pickHeadlineBucket({
      snapshot: { data, fetchedAt: now },
      candidates: ["seven_day_sonnet", "seven_day_opus"] as BucketName[],
    });
    expect(choice).toBeNull();
  });

  it("returns null on null snapshot", () => {
    const choice = pickHeadlineBucket({
      snapshot: null,
      candidates: ["five_hour"],
    });
    expect(choice).toBeNull();
  });
});
