import type { StateStore } from "../state/store.js";
import type { StatusFetchResult } from "../api/statusClient.js";

export type StatusFetcher = (input: { endpoint: string }) => Promise<StatusFetchResult>;

export interface StatusPollerOptions {
  fetcher: StatusFetcher;
  store: StateStore;
  intervalMs: number;
  endpoint: string;
}

export class StatusPoller {
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly opts: StatusPollerOptions) {}

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
    const result = await this.opts.fetcher({ endpoint: this.opts.endpoint });
    if (result.ok) {
      this.opts.store.setStatus({ data: result.data, fetchedAt: result.fetchedAt });
    }
  }
}
