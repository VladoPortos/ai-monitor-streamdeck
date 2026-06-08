import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFonts, renderToPng, setFontsForTesting } from "../../src/plugin/render/renderer.js";
import { buildUsageBucketTree, buildStatusTree } from "../../src/plugin/render/keyTrees.js";
import { palette } from "../../src/plugin/render/theme.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(__dirname, "../../com.vladoportos.aimonitor.sdPlugin/fonts");

beforeAll(async () => {
  setFontsForTesting(null);
  await loadFonts(fontDir);
});

describe("renderToPng (integration: satori + sharp)", () => {
  it("renders a usage-bucket tree to a non-empty PNG buffer", async () => {
    const tree = buildUsageBucketTree({
      label: "5h",
      percent: 47,
      color: palette.ok,
      resetText: "2h 14m",
      stale: false,
      unknown: false,
    });
    const png = await renderToPng(tree);
    expect(png.length).toBeGreaterThan(100);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("renders a status tree (outage) to a PNG", async () => {
    const tree = buildStatusTree({
      label: "Claude API",
      description: "Major outage",
      status: "outage",
      pulse: true,
    });
    const png = await renderToPng(tree);
    expect(png.length).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89);
  });

  it("renders the unknown/stale variant", async () => {
    const tree = buildUsageBucketTree({
      label: "weekly",
      percent: null,
      color: palette.textMuted,
      resetText: "—",
      stale: true,
      unknown: true,
    });
    const png = await renderToPng(tree);
    expect(png.length).toBeGreaterThan(100);
  });
});
