import type { StateStore, FreshnessBands } from "./state/store.js";
import type { AuthResolver } from "./auth/authResolver.js";
import type { UsagePoller } from "./pollers/usagePoller.js";
import type { StatusPoller } from "./pollers/statusPoller.js";

export interface PluginContext {
  store: StateStore;
  auth: AuthResolver;
  usagePoller: UsagePoller;
  statusPoller: StatusPoller;
  freshnessBands: FreshnessBands;
  timeZone: string | undefined;
  openWebDefaultUrl: string;
}

let ctx: PluginContext | null = null;

export function setPluginContext(c: PluginContext): void {
  ctx = c;
}

export function getPluginContext(): PluginContext {
  if (!ctx) throw new Error("plugin context not initialized");
  return ctx;
}
