import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveSnapshotToDisk,
  loadSnapshotFromDisk,
} from "../../src/plugin/state/persistence.js";
import { StateStore } from "../../src/plugin/state/store.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { UsageResponse, StatusSummaryResponse } from "../../src/plugin/api/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
};

describe("snapshot persistence", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "aim-test-"));
    file = join(dir, "state.json");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saveSnapshotToDisk writes a readable JSON file", async () => {
    const store = new StateStore();
    store.setUsage({
      data: UsageResponse.parse(readFixture("usage-max20x-warning.json")),
      fetchedAt: new Date("2026-05-17T12:00:00Z"),
    });
    store.setStatus({
      data: StatusSummaryResponse.parse(readFixture("status-summary-operational.json")),
      fetchedAt: new Date("2026-05-17T12:01:00Z"),
    });
    await saveSnapshotToDisk(store, file);
    expect(existsSync(file)).toBe(true);
  });

  it("loadSnapshotFromDisk restores both snapshots", async () => {
    const original = new StateStore();
    original.setUsage({
      data: UsageResponse.parse(readFixture("usage-max20x-warning.json")),
      fetchedAt: new Date("2026-05-17T12:00:00Z"),
    });
    original.setStatus({
      data: StatusSummaryResponse.parse(readFixture("status-summary-operational.json")),
      fetchedAt: new Date("2026-05-17T12:01:00Z"),
    });
    await saveSnapshotToDisk(original, file);

    const restored = new StateStore();
    await loadSnapshotFromDisk(restored, file);
    expect(restored.getUsage()?.data.five_hour.utilization).toBe(68);
    expect(restored.getStatus()?.data.status.indicator).toBe("none");
  });

  it("loadSnapshotFromDisk is a no-op when file does not exist", async () => {
    const store = new StateStore();
    await loadSnapshotFromDisk(store, join(dir, "missing.json"));
    expect(store.getUsage()).toBeNull();
    expect(store.getStatus()).toBeNull();
  });

  it("loadSnapshotFromDisk ignores malformed JSON without throwing", async () => {
    writeFileSync(file, "{not valid", "utf8");
    const store = new StateStore();
    await loadSnapshotFromDisk(store, file);
    expect(store.getUsage()).toBeNull();
  });

  it("loadSnapshotFromDisk ignores payloads that fail schema validation", async () => {
    writeFileSync(file, JSON.stringify({ usage: { fetchedAt: "2026", data: { bogus: true } } }), "utf8");
    const store = new StateStore();
    await loadSnapshotFromDisk(store, file);
    expect(store.getUsage()).toBeNull();
  });
});
