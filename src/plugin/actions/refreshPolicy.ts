import type { UsageFetchResult } from "../api/usageClient.js";
import type { StatusFetchResult } from "../api/statusClient.js";

export const MANUAL_USAGE_MIN_SPACING_MS = 5 * 60_000;

export function refreshSucceeded(
  usage: UsageFetchResult | null,
  status: StatusFetchResult,
): boolean {
  return usage?.ok === true && status.ok;
}
