import { describe, expect, it } from "vitest";
import type { UsageFetchResult } from "../../src/plugin/api/usageClient.js";
import type { StatusFetchResult } from "../../src/plugin/api/statusClient.js";
import {
  MANUAL_USAGE_MIN_SPACING_MS,
  refreshSucceeded,
} from "../../src/plugin/actions/refreshPolicy.js";

const usageOk = { ok: true, data: {}, fetchedAt: new Date() } as UsageFetchResult;
const statusOk = { ok: true, data: {}, fetchedAt: new Date() } as StatusFetchResult;

describe("refresh policy", () => {
  it("uses the same five-minute spacing as scheduled usage polling", () => {
    expect(MANUAL_USAGE_MIN_SPACING_MS).toBe(5 * 60_000);
  });

  it("succeeds only when both polls succeeded", () => {
    expect(refreshSucceeded(usageOk, statusOk)).toBe(true);
    expect(refreshSucceeded(null, statusOk)).toBe(false);
    expect(refreshSucceeded({ ok: false, kind: "schema", cause: "changed" }, statusOk)).toBe(false);
    expect(refreshSucceeded(usageOk, { ok: false, kind: "network", cause: "offline" })).toBe(false);
  });
});
