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
  endpoint: string;
  betaHeader: string;
  log?: PollLogger;
}

export class UsagePoller {
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly opts: UsagePollerOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.pollNow(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollNow(): Promise<void> {
    const result = await this.fetchOnce();
    if (result.ok) {
      this.opts.store.setUsage({ data: result.data, fetchedAt: result.fetchedAt });
      this.opts.store.setAuthState("ok");
      this.opts.log?.("usage poll: ok");
    } else {
      this.opts.log?.(
        `usage poll: ${result.kind}${"status" in result ? ` (${result.status})` : ""}${"cause" in result ? ` ${result.cause}` : ""}`,
      );
    }
    // On failure: do nothing (caller logic preserves cached snapshot).
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
