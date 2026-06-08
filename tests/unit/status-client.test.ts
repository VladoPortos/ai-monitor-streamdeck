import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fetchStatusSummary } from "../../src/plugin/api/statusClient.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
};

describe("fetchStatusSummary", () => {
  it("returns parsed data on 200 operational", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: readFixture("status-summary-operational.json"),
    });
    const result = await fetchStatusSummary({
      endpoint: "https://status.claude.com/api/v2/summary.json",
      fetcher,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status.indicator).toBe("none");
  });

  it("parses incident fixture", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: readFixture("status-summary-incident.json"),
    });
    const result = await fetchStatusSummary({ endpoint: "x", fetcher });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status.indicator).toBe("major");
      expect(result.data.incidents.length).toBe(1);
    }
  });

  it("does not send any auth headers", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      body: readFixture("status-summary-operational.json"),
    });
    await fetchStatusSummary({ endpoint: "x", fetcher });
    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("returns network failure on 5xx", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 502, body: "" });
    const result = await fetchStatusSummary({ endpoint: "x", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("returns schema failure on malformed body", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 200, body: '{"page":{}}' });
    const result = await fetchStatusSummary({ endpoint: "x", fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("schema");
  });
});
