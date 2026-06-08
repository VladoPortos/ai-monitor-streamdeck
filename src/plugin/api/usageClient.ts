import { UsageResponse, type UsageResponseT } from "./types.js";
import { undiciFetcher, type HttpFetcher } from "./httpFetcher.js";

export type UsageFetchResult =
  | { ok: true; data: UsageResponseT; fetchedAt: Date }
  | { ok: false; kind: "auth"; status: number }
  | { ok: false; kind: "rate_limit"; retryAfterSec: number | null }
  | { ok: false; kind: "network"; cause: string }
  | { ok: false; kind: "schema"; cause: string };

export interface FetchUsageOptions {
  endpoint: string;
  betaHeader: string;
  bearerToken: string;
  fetcher?: HttpFetcher;
  timeoutMs?: number;
}

function parseRetryAfter(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchUsage(opts: FetchUsageOptions): Promise<UsageFetchResult> {
  const fetcher = opts.fetcher ?? undiciFetcher;
  let resp;
  try {
    resp = await fetcher(opts.endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${opts.bearerToken}`,
        "anthropic-beta": opts.betaHeader,
        Accept: "application/json",
        "User-Agent": "ai-monitor-streamdeck/0.1",
      },
      timeoutMs: opts.timeoutMs ?? 10000,
    });
  } catch (e) {
    return { ok: false, kind: "network", cause: e instanceof Error ? e.message : String(e) };
  }

  if (resp.status === 401 || resp.status === 403) {
    return { ok: false, kind: "auth", status: resp.status };
  }
  if (resp.status === 429) {
    return { ok: false, kind: "rate_limit", retryAfterSec: parseRetryAfter(resp.headers?.["retry-after"]) };
  }
  if (resp.status < 200 || resp.status >= 300) {
    return { ok: false, kind: "network", cause: `HTTP ${resp.status}` };
  }

  let body: unknown;
  try {
    body = JSON.parse(resp.body);
  } catch {
    return { ok: false, kind: "schema", cause: "invalid JSON" };
  }

  const parsed = UsageResponse.safeParse(body);
  if (!parsed.success) {
    return { ok: false, kind: "schema", cause: parsed.error.message };
  }
  return { ok: true, data: parsed.data, fetchedAt: new Date() };
}
