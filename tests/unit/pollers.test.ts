import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UsagePoller, nextPollDelayMs } from "../../src/plugin/pollers/usagePoller.js";
import { StatusPoller } from "../../src/plugin/pollers/statusPoller.js";
import { StateStore } from "../../src/plugin/state/store.js";
import { AuthResolver } from "../../src/plugin/auth/authResolver.js";
import type { UsageFetchResult } from "../../src/plugin/api/usageClient.js";
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
const statusData = () =>
  StatusSummaryResponse.parse(readFixture("status-summary-operational.json"));

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
    const fetcher = vi
      .fn()
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
    const fetcher = vi
      .fn()
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

  it("backs off (2x base) after a rate_limit with no Retry-After", async () => {
    const data = usageData();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: "rate_limit", retryAfterSec: null })
      .mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 1000,
      maxBackoffMs: 100_000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(1000); // first poll → rate_limit
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); // base elapsed, but backoff is 2000 → still held
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); // 2000 after first poll → second poll fires
    expect(fetcher).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("honors the Retry-After header on a rate_limit", async () => {
    const data = usageData();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: "rate_limit", retryAfterSec: 5 })
      .mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 1000,
      maxBackoffMs: 100_000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(1000); // first poll → rate_limit, Retry-After 5s
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000); // <5s since first poll → still held
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); // 5s after first poll → second poll fires
    expect(fetcher).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("pollIfDue polls only after the spacing window has elapsed", async () => {
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
    await poller.pollNow(); // establishes lastPollAt
    expect(fetcher).toHaveBeenCalledTimes(1);
    await poller.pollIfDue(60_000); // 0ms since last → skipped
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    await poller.pollIfDue(60_000); // 30s < 60s → skipped
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    await poller.pollIfDue(60_000); // 60s elapsed → polls
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns null when pollIfDue is throttled and a result when due", async () => {
    const data = usageData();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const poller = new UsagePoller({
      fetcher,
      store: new StateStore(),
      auth: mkAuth(),
      intervalMs: 60_000,
      endpoint: "x",
      betaHeader: "y",
    });

    await poller.pollNow();
    await expect(poller.pollIfDue(60_000)).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    const dueResult = await poller.pollIfDue(60_000);
    expect(dueResult?.ok).toBe(true);
  });

  it("coalesces concurrent pollNow calls into one request", async () => {
    const data = usageData();
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const result: UsageFetchResult = { ok: true, data, fetchedAt: new Date() };
    const fetcher = vi.fn(async () => {
      await gate;
      return result;
    });
    const poller = new UsagePoller({
      fetcher,
      store: new StateStore(),
      auth: mkAuth(),
      intervalMs: 60_000,
      endpoint: "x",
      betaHeader: "y",
    });

    const first = poller.pollNow();
    const second = poller.pollNow();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toBe(result);
    await expect(second).resolves.toBe(result);
  });

  it("keeps the recurring loop alive when a poll attempt throws", async () => {
    const data = usageData();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom")) // first tick: pollNow rejects
      .mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 1000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(1000); // tick #1 → fetcher throws
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); // loop survived → tick #2 fires at base cadence
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.getUsage()?.data).toBe(data);
    poller.stop();
  });

  it("resets to the base interval after a successful poll", async () => {
    const data = usageData();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: "rate_limit", retryAfterSec: null })
      .mockResolvedValue({ ok: true, data, fetchedAt: new Date() });
    const store = new StateStore();
    const auth = mkAuth();
    const poller = new UsagePoller({
      fetcher,
      store,
      auth,
      intervalMs: 1000,
      maxBackoffMs: 100_000,
      endpoint: "x",
      betaHeader: "y",
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(1000); // #1 rate_limit → backoff to 2000
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000); // #2 ok at t=3000 → counter resets to base
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000); // #3 at t=4000 → base interval restored
    expect(fetcher).toHaveBeenCalledTimes(3);
    poller.stop();
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
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data, fetchedAt: new Date() })
      .mockResolvedValueOnce({ ok: false, kind: "schema", cause: "bad" });
    const store = new StateStore();
    const poller = new StatusPoller({ fetcher, store, intervalMs: 30_000, endpoint: "x" });
    await poller.pollNow();
    await poller.pollNow();
    expect(store.getStatus()?.data).toBe(data);
  });

  it("returns the structured fetch result", async () => {
    const failure = { ok: false, kind: "network", cause: "offline" } as const;
    const poller = new StatusPoller({
      fetcher: vi.fn().mockResolvedValue(failure),
      store: new StateStore(),
      intervalMs: 30_000,
      endpoint: "x",
    });
    await expect(poller.pollNow()).resolves.toBe(failure);
  });
});

describe("nextPollDelayMs", () => {
  const params = { baseMs: 1000, maxMs: 60_000 };
  const okResult: UsageFetchResult = { ok: true, data: usageData(), fetchedAt: new Date() };
  const netResult: UsageFetchResult = { ok: false, kind: "network", cause: "ETIMEDOUT" };
  const rateLimit = (retryAfterSec: number | null): UsageFetchResult => ({
    ok: false,
    kind: "rate_limit",
    retryAfterSec,
  });

  it("returns the base interval on a successful poll", () => {
    expect(nextPollDelayMs(okResult, 0, params)).toBe(1000);
  });

  it("returns the base interval on a non-rate-limit failure", () => {
    expect(nextPollDelayMs(netResult, 0, params)).toBe(1000);
  });

  it("backs off exponentially on consecutive rate-limits without Retry-After", () => {
    expect(nextPollDelayMs(rateLimit(null), 1, params)).toBe(2000);
    expect(nextPollDelayMs(rateLimit(null), 2, params)).toBe(4000);
    expect(nextPollDelayMs(rateLimit(null), 3, params)).toBe(8000);
  });

  it("caps the exponential backoff at maxMs", () => {
    expect(nextPollDelayMs(rateLimit(null), 20, params)).toBe(60_000);
  });

  it("honors Retry-After, clamped to [base, max]", () => {
    expect(nextPollDelayMs(rateLimit(5), 1, params)).toBe(5000);
    expect(nextPollDelayMs(rateLimit(0.1), 1, params)).toBe(1000); // floored to base
    expect(nextPollDelayMs(rateLimit(99999), 1, params)).toBe(60_000); // capped to max
  });
});
