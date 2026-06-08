import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import {
  UsageResponse,
  StatusSummaryResponse,
  type UsageResponseT,
  type StatusSummaryResponseT,
} from "../api/types.js";
import type { StateStore } from "./store.js";

const PersistedShape = z.object({
  version: z.literal(1),
  usage: z
    .object({
      fetchedAt: z.string(),
      data: z.unknown(),
    })
    .nullable()
    .optional(),
  status: z
    .object({
      fetchedAt: z.string(),
      data: z.unknown(),
    })
    .nullable()
    .optional(),
});

export async function saveSnapshotToDisk(store: StateStore, path: string): Promise<void> {
  const usage = store.getUsage();
  const status = store.getStatus();
  const payload = {
    version: 1,
    usage: usage ? { fetchedAt: usage.fetchedAt.toISOString(), data: usage.data } : null,
    status: status ? { fetchedAt: status.fetchedAt.toISOString(), data: status.data } : null,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
}

export async function loadSnapshotFromDisk(store: StateStore, path: string): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return; // missing file or unreadable — start cold
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }

  const outer = PersistedShape.safeParse(json);
  if (!outer.success) return;

  if (outer.data.usage) {
    const inner = UsageResponse.safeParse(outer.data.usage.data);
    if (inner.success) {
      store.setUsage({
        data: inner.data as UsageResponseT,
        fetchedAt: new Date(outer.data.usage.fetchedAt),
      });
    }
  }
  if (outer.data.status) {
    const inner = StatusSummaryResponse.safeParse(outer.data.status.data);
    if (inner.success) {
      store.setStatus({
        data: inner.data as StatusSummaryResponseT,
        fetchedAt: new Date(outer.data.status.fetchedAt),
      });
    }
  }
}
