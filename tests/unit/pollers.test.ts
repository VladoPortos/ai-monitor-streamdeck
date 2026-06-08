import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UsagePoller } from "../../src/plugin/pollers/usagePoller.js";
import { StatusPoller } from "../../src/plugin/pollers/statusPoller.js";
import { StateStore } from "../../src/plugin/state/store.js";
import { AuthResolver } from "../../src/plugin/auth/authResolver.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { UsageResponse, StatusSummaryResponse } from "../../src/plugin/api/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
};

const usageData = () => UsageResponse.parse(readFixture("usage-max20x-warning.json"));
const statusData = () => StatusSummaryResponse.parse(readFixture("status-summary-operational.json"));

const mkAuth = (token = "tok-A") =>
  new AuthResolver({
    read: vi.fn().mockResolvedValue({ ok: true, token, expiresAt: null }),
    refresh: vi.fn().mockResolvedValue({ ok: true }),
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("UsagePoller", () => {
  it("pollNow writes a snapshot to the state store on 200", async () => {
    const data = usageData();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 60_000,
      endpoint: "x",
      betaHeader: "y",
    });
    await poller.pollNow();
    expect(store.getUsage()?.data).toBe(data);
  });

  it("on auth failure, triggers refresh and retries the fetch once", async () => {
    const data = usageData();
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, kind: "auth", status: 401 })
      .mockResolvedValueOnce({ ok: true, data, fetchedAt: new Date() });
    const refresh = vi.fn().mockResolvedValue({ ok: true });
    const auth = new AuthResolver({
      read: vi.fn().mockResolvedValue({ ok: true, token: "t", expiresAt: null }),
      refresh,
    });
    const store = new StateStore();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 60_000,
      endpoint: "x",
      betaHeader: "y",
    });
    await poller.pollNow();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.getUsage()).not.toBeNull();
  });

  it("does not overwrite cached snapshot on transient network failure", async () => {
    const data = usageData();
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, data, fetchedAt: new Date() })
      .mockResolvedValueOnce({ ok: false, kind: "network", cause: "ETIMEDOUT" });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 60_000,
      endpoint: "x",
      betaHeader: "y",
    });
    await poller.pollNow();
    await poller.pollNow();
    expect(store.getUsage()?.data).toBe(data); // cached value retained
  });

  it("start() fires on each interval tick", async () => {
    const data = usageData();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 30_000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    expect(fetcher).toHaveBeenCalledTimes(0); // does not fire immediately on start
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("stop() cancels pending interval", async () => {
    const data = usageData();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 30_000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    poller.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetcher).toHaveBeenCalledTimes(0);
  });
});

describe("StatusPoller", () => {
  it("pollNow writes status snapshot on 200", async () => {
    const data = statusData();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const poller = new StatusPoller({ fetcher, store, intervalMs: 30_000, endpoint: "x" });
    await poller.pollNow();
    expect(store.getStatus()?.data).toBe(data);
  });

  it("retains cache on schema failure", async () => {
    const data = statusData();
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, data, fetchedAt: new Date() })
      .mockResolvedValueOnce({ ok: false, kind: "schema", cause: "bad" });
    const store = new StateStore();
    const poller = new StatusPoller({ fetcher, store, intervalMs: 30_000, endpoint: "x" });
    await poller.pollNow();
    await poller.pollNow();
    expect(store.getStatus()?.data).toBe(data);
  });
});
