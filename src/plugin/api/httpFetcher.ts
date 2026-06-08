import { request } from "undici";

export interface FetcherInit {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface FetcherResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export type HttpFetcher = (url: string, init?: FetcherInit) => Promise<FetcherResponse>;

/** Default fetcher using undici. Plain function so it's trivially mockable. */
export const undiciFetcher: HttpFetcher = async (url, init = {}) => {
  const { statusCode, headers, body } = await request(url, {
    method: init.method ?? "GET",
    ...(init.headers ? { headers: init.headers } : {}),
    headersTimeout: init.timeoutMs ?? 10000,
    bodyTimeout: init.timeoutMs ?? 10000,
  });
  const text = await body.text();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(",");
  }
  return { status: statusCode, body: text, headers: out };
};
