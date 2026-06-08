import type { TokenReadResult } from "./credentialsReader.js";
import type { RefreshResult } from "./tokenRefresher.js";

export type AuthState = "unknown" | "ok" | "refreshing" | "expired";

export interface AuthResolverOptions {
  read: () => Promise<TokenReadResult>;
  refresh: () => Promise<RefreshResult>;
  /** Min wall-clock between refresh attempts. Default 5 minutes. */
  cooldownMs?: number;
  /** Clock for testability. */
  now?: () => number;
}

export class AuthResolver {
  private readonly read: () => Promise<TokenReadResult>;
  private readonly refresh: () => Promise<RefreshResult>;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  private cached: TokenReadResult | null = null;
  private lastRefreshAt = 0;
  private currentState: AuthState = "unknown";
  private inFlight: Promise<TokenReadResult> | null = null;

  constructor(opts: AuthResolverOptions) {
    this.read = opts.read;
    this.refresh = opts.refresh;
    this.cooldownMs = opts.cooldownMs ?? 5 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  state(): AuthState {
    return this.currentState;
  }

  async getToken(): Promise<string | null> {
    if (this.cached === null) {
      this.cached = await this.read();
      this.currentState = this.cached.ok ? "ok" : "expired";
    }
    return this.cached.ok ? this.cached.token : null;
  }

  /** Called by pollers when an authenticated request returned 401. */
  async onAuthFailure(): Promise<TokenReadResult> {
    const now = this.now();
    if (this.inFlight) return this.inFlight;
    if (now - this.lastRefreshAt < this.cooldownMs && this.lastRefreshAt !== 0) {
      // Still in cooldown — return current cache without spawning refresh.
      return this.cached ?? { ok: false, reason: "unknown" };
    }
    return this.doRefresh();
  }

  /** Manual refresh trigger; bypasses cooldown. */
  async forceRefresh(): Promise<TokenReadResult> {
    if (this.inFlight) return this.inFlight;
    return this.doRefresh();
  }

  private async doRefresh(): Promise<TokenReadResult> {
    this.currentState = "refreshing";
    this.lastRefreshAt = this.now();
    const run = (async (): Promise<TokenReadResult> => {
      const refreshResult = await this.refresh();
      if (!refreshResult.ok) {
        this.currentState = "expired";
        return this.cached ?? { ok: false, reason: "unknown", cause: refreshResult.cause };
      }
      const reread = await this.read();
      this.cached = reread;
      this.currentState = reread.ok ? "ok" : "expired";
      return reread;
    })();
    this.inFlight = run;
    try {
      return await run;
    } finally {
      this.inFlight = null;
    }
  }
}
