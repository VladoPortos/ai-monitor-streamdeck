import { describe, it, expect, vi } from "vitest";
import { StateStore } from "../../src/plugin/state/store.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { UsageResponse, StatusSummaryResponse } from "../../src/plugin/api/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
};

const sampleUsage = () => UsageResponse.parse(readFixture("usage-max20x-warning.json"));
const sampleStatus = () => StatusSummaryResponse.parse(readFixture("status-summary-operational.json"));

describe("StateStore", () => {
  it("starts empty", () => {
    const s = new StateStore();
    expect(s.getUsage()).toBeNull();
    expect(s.getStatus()).toBeNull();
  });

  it("stores and returns the usage snapshot", () => {
    const s = new StateStore();
    const data = sampleUsage();
    const fetchedAt = new Date("2026-05-17T12:00:00Z");
    s.setUsage({ data, fetchedAt });
    expect(s.getUsage()?.data).toBe(data);
    expect(s.getUsage()?.fetchedAt).toBe(fetchedAt);
  });

  it("stores and returns the status snapshot", () => {
    const s = new StateStore();
    const data = sampleStatus();
    const fetchedAt = new Date("2026-05-17T12:00:00Z");
    s.setStatus({ data, fetchedAt });
    expect(s.getStatus()?.data).toBe(data);
  });

  it("notifies subscribers on setUsage", () => {
    const s = new StateStore();
    const cb = vi.fn();
    s.subscribe(cb);
    s.setUsage({ data: sampleUsage(), fetchedAt: new Date() });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on setStatus", () => {
    const s = new StateStore();
    const cb = vi.fn();
    s.subscribe(cb);
    s.setStatus({ data: sampleStatus(), fetchedAt: new Date() });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("subscribe returns an unsubscribe function", () => {
    const s = new StateStore();
    const cb = vi.fn();
    const unsub = s.subscribe(cb);
    unsub();
    s.setUsage({ data: sampleUsage(), fetchedAt: new Date() });
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers", () => {
    const s = new StateStore();
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe(a);
    s.subscribe(b);
    s.setUsage({ data: sampleUsage(), fetchedAt: new Date() });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  describe("usageFreshness", () => {
    const bands = { agingMs: 60_000, staleMs: 180_000, veryStaleMs: 600_000 };

    it("returns null when no snapshot", () => {
      expect(new StateStore().usageFreshness(new Date(), bands)).toBeNull();
    });

    it("returns fresh under agingMs", () => {
      const s = new StateStore();
      const t = new Date("2026-05-17T12:00:00Z");
      s.setUsage({ data: sampleUsage(), fetchedAt: t });
      expect(s.usageFreshness(new Date("2026-05-17T12:00:30Z"), bands)).toBe("fresh");
    });

    it("returns aging between agingMs and staleMs", () => {
      const s = new StateStore();
      const t = new Date("2026-05-17T12:00:00Z");
      s.setUsage({ data: sampleUsage(), fetchedAt: t });
      expect(s.usageFreshness(new Date("2026-05-17T12:02:00Z"), bands)).toBe("aging");
    });

    it("returns stale between staleMs and veryStaleMs", () => {
      const s = new StateStore();
      const t = new Date("2026-05-17T12:00:00Z");
      s.setUsage({ data: sampleUsage(), fetchedAt: t });
      expect(s.usageFreshness(new Date("2026-05-17T12:05:00Z"), bands)).toBe("stale");
    });

    it("returns very_stale beyond veryStaleMs", () => {
      const s = new StateStore();
      const t = new Date("2026-05-17T12:00:00Z");
      s.setUsage({ data: sampleUsage(), fetchedAt: t });
      expect(s.usageFreshness(new Date("2026-05-17T12:20:00Z"), bands)).toBe("very_stale");
    });
  });

  it("setAuthState records and notifies", () => {
    const s = new StateStore();
    const cb = vi.fn();
    s.subscribe(cb);
    s.setAuthState("expired");
    expect(s.getAuthState()).toBe("expired");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
