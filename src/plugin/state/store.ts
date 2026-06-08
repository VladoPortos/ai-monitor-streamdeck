import type { UsageResponseT, StatusSummaryResponseT } from "../api/types.js";
import type { AuthState } from "../auth/authResolver.js";

export interface UsageSnapshot {
  data: UsageResponseT;
  fetchedAt: Date;
}
export interface StatusSnapshot {
  data: StatusSummaryResponseT;
  fetchedAt: Date;
}

export type Freshness = "fresh" | "aging" | "stale" | "very_stale";

export interface FreshnessBands {
  agingMs: number;
  staleMs: number;
  veryStaleMs: number;
}

export type StateChangeListener = () => void;

export class StateStore {
  private usage: UsageSnapshot | null = null;
  private status: StatusSnapshot | null = null;
  private auth: AuthState = "unknown";
  private listeners = new Set<StateChangeListener>();

  getUsage(): UsageSnapshot | null { return this.usage; }
  getStatus(): StatusSnapshot | null { return this.status; }
  getAuthState(): AuthState { return this.auth; }

  setUsage(snapshot: UsageSnapshot): void {
    this.usage = snapshot;
    this.emit();
  }
  setStatus(snapshot: StatusSnapshot): void {
    this.status = snapshot;
    this.emit();
  }
  setAuthState(state: AuthState): void {
    if (this.auth !== state) {
      this.auth = state;
      this.emit();
    }
  }

  subscribe(fn: StateChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  usageFreshness(now: Date, bands: FreshnessBands): Freshness | null {
    return this.usage ? freshnessOf(this.usage.fetchedAt, now, bands) : null;
  }
  statusFreshness(now: Date, bands: FreshnessBands): Freshness | null {
    return this.status ? freshnessOf(this.status.fetchedAt, now, bands) : null;
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* listener errors don't break store */ }
    }
  }
}

function freshnessOf(fetchedAt: Date, now: Date, bands: FreshnessBands): Freshness {
  const age = now.getTime() - fetchedAt.getTime();
  if (age > bands.veryStaleMs) return "very_stale";
  if (age > bands.staleMs) return "stale";
  if (age > bands.agingMs) return "aging";
  return "fresh";
}
