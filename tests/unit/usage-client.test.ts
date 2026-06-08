import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fetchUsage } from "../../src/plugin/api/usageClient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

describe("fetchUsage", () => {
  it("returns parsed data on 200 from the OAuth endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: readFixture("usage-max20x-warning.json"),
    });
    const result = await fetchUsage({
      endpoint: "https://api.anthropic.com/api/oauth/usage",
      betaHeader: "oauth-2025-04-20",
      bearerToken: "tok-1",
      fetcher,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.five_hour.utilization).toBe(68);
      expect(result.data.extra_usage.currency).toBe("USD");
    }
  });

  it("sends Authorization Bearer + beta header", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: readFixture("usage-max20x-idle.json"),
    });
    await fetchUsage({
      endpoint: "https://api.anthropic.com/api/oauth/usage",
      betaHeader: "oauth-2025-04-20",
      bearerToken: "tok-A",
      fetcher,
    });
    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers["Authorization"]).toBe("Bearer tok-A");
    expect(init.headers["anthropic-beta"]).toBe("oauth-2025-04-20");
    expect(init.headers["Accept"]).toBe("application/json");
  });

  it("returns auth failure on 401", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 401, body: '{"error":"auth"}' });
    const result = await fetchUsage({
      endpoint: "x",
      betaHeader: "y",
      bearerToken: "z",
      fetcher,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("auth");
  });

  it("returns network failure on 5xx", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 503, body: "" });
    const result = await fetchUsage({ endpoint: "x", betaHeader: "y", bearerToken: "z", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("returns network failure when fetcher rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
    const result = await fetchUsage({ endpoint: "x", betaHeader: "y", bearerToken: "z", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
      expect(result.cause).toContain("ETIMEDOUT");
    }
  });

  it("returns schema failure on malformed response body", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 200, body: '{"unrelated":"data"}' });
    const result = await fetchUsage({ endpoint: "x", betaHeader: "y", bearerToken: "z", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("schema");
  });

  it("respects Retry-After header on 429", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 429,
      body: "",
      headers: { "retry-after": "120" },
    });
    const result = await fetchUsage({ endpoint: "x", betaHeader: "y", bearerToken: "z", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("rate_limit");
      expect(result.retryAfterSec).toBe(120);
    }
  });
});
