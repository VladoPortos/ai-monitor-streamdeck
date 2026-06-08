import { StatusSummaryResponse, type StatusSummaryResponseT } from "./types.js";
import { undiciFetcher, type HttpFetcher } from "./httpFetcher.js";

export type StatusFetchResult =
  | { ok: true; data: StatusSummaryResponseT; fetchedAt: Date }
  | { ok: false; kind: "network"; cause: string }
  | { ok: false; kind: "schema"; cause: string };

export interface FetchStatusOptions {
  endpoint: string;
  fetcher?: HttpFetcher;
  timeoutMs?: number;
}

export async function fetchStatusSummary(opts: FetchStatusOptions): Promise<StatusFetchResult> {
  const fetcher = opts.fetcher ?? undiciFetcher;
  let resp;
  try {
    resp = await fetcher(opts.endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "ai-monitor-streamdeck/0.1",
      },
      timeoutMs: opts.timeoutMs ?? 10000,
    });
  } catch (e) {
    return { ok: false, kind: "network", cause: e instanceof Error ? e.message : String(e) };
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

  const parsed = StatusSummaryResponse.safeParse(body);
  if (!parsed.success) {
    return { ok: false, kind: "schema", cause: parsed.error.message };
  }
  return { ok: true, data: parsed.data, fetchedAt: new Date() };
}
