import type { StateStore } from "../state/store.js";
import type { AuthResolver } from "../auth/authResolver.js";
import type { UsageFetchResult } from "../api/usageClient.js";

export type UsageFetcher = (input: {
  endpoint: string;
  betaHeader: string;
  bearerToken: string;
}) => Promise<UsageFetchResult>;

export type PollLogger = (msg: string) => void;

export interface UsagePollerOptions {
  fetcher: UsageFetcher;
  store: StateStore;
  auth: AuthResolver;
  intervalMs: number;
  /** Upper bound for backoff between polls when the endpoint is rate-limiting. Default 1h. */
  maxBackoffMs?: number;
  endpoint: string;
  betaHeader: string;
  log?: PollLogger;
}

const DEFAULT_MAX_BACKOFF_MS = 60 * 60_000;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Decide how long to wait before the next usage poll, given the result we just got.
 *
 * The OAuth `/usage` endpoint rate-limits aggressively (HTTP 429). On a 429 we honor
 * the server's `Retry-After` when present, otherwise back off exponentially from the
 * base interval — both clamped to `[baseMs, maxMs]`. Any non-429 result (success or a
 * transient error) returns to the base cadence. `consecutiveRateLimits` is the length
 * of the current 429 streak, counting the result just received.
 */
export function nextPollDelayMs(
  result: UsageFetchResult,
  consecutiveRateLimits: number,
  params: { baseMs: number; maxMs: number },
): number {
  if (!result.ok && result.kind === "rate_limit") {
    if (result.retryAfterSec !== null && result.retryAfterSec > 0) {
      return clamp(result.retryAfterSec * 1000, params.baseMs, params.maxMs);
    }
    const exponential = params.baseMs * 2 ** Math.max(1, consecutiveRateLimits);
    return Math.min(exponential, params.maxMs);
  }
  return params.baseMs;
}

export class UsagePoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private consecutiveRateLimits = 0;
  constructor(private readonly opts: UsagePollerOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(this.opts.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    const result = await this.pollNow();
    const delayMs = nextPollDelayMs(result, this.consecutiveRateLimits, {
      baseMs: this.opts.intervalMs,
      maxMs: this.opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
    });
    this.scheduleNext(delayMs);
  }

  async pollNow(): Promise<UsageFetchResult> {
    const result = await this.fetchOnce();
    if (result.ok) {
      this.consecutiveRateLimits = 0;
      this.opts.store.setUsage({ data: result.data, fetchedAt: result.fetchedAt });
      this.opts.store.setAuthState("ok");
      this.opts.log?.("usage poll: ok");
    } else {
      this.consecutiveRateLimits = result.kind === "rate_limit" ? this.consecutiveRateLimits + 1 : 0;
      this.opts.log?.(
        `usage poll: ${result.kind}${"status" in result ? ` (${result.status})` : ""}${"cause" in result ? ` ${result.cause}` : ""}`,
      );
    }
    // On failure: cached snapshot is preserved (we never call setUsage).
    return result;
  }

  private async fetchOnce(): Promise<UsageFetchResult> {
    const token = await this.opts.auth.getToken();
    if (token === null) {
      this.opts.store.setAuthState("expired");
      return { ok: false, kind: "auth", status: 401 };
    }
    const first = await this.opts.fetcher({
      endpoint: this.opts.endpoint,
      betaHeader: this.opts.betaHeader,
      bearerToken: token,
    });
    if (first.ok) return first;
    if (first.kind === "auth") {
      await this.opts.auth.onAuthFailure();
      const newToken = await this.opts.auth.getToken();
      if (newToken === null) {
        this.opts.store.setAuthState("expired");
        return first;
      }
      this.opts.store.setAuthState(this.opts.auth.state());
      return this.opts.fetcher({
        endpoint: this.opts.endpoint,
        betaHeader: this.opts.betaHeader,
        bearerToken: newToken,
      });
    }
    return first;
  }
}
