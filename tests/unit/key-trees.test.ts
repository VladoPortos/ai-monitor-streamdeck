import { describe, it, expect } from "vitest";
import {
  buildUsageBucketTree,
  buildExtraUsageTree,
  buildStatusTree,
  buildSimpleIconTree,
  buildResetCountdownTree,
} from "../../src/plugin/render/keyTrees.js";
import { palette } from "../../src/plugin/render/theme.js";

function findText(node: unknown, predicate: (text: string) => boolean): boolean {
  if (typeof node === "string") return predicate(node);
  if (node === null || typeof node !== "object") return false;
  const obj = node as { props?: { children?: unknown } };
  if (!obj.props) return false;
  const children = obj.props.children;
  if (Array.isArray(children)) return children.some((c) => findText(c, predicate));
  return findText(children, predicate);
}

function collectStyleColors(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (n === null || typeof n !== "object") return;
    const obj = n as { props?: { style?: Record<string, unknown>; children?: unknown } };
    if (obj.props?.style) {
      for (const v of Object.values(obj.props.style)) {
        if (typeof v === "string" && v.startsWith("#")) out.push(v);
      }
    }
    const children = obj.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };
  walk(node);
  return out;
}

describe("buildUsageBucketTree (ring style, default)", () => {
  it("renders the percent text and uses live color even when stale", () => {
    const tree = buildUsageBucketTree({
      label: "5h",
      percent: 47,
      color: palette.ok,
      resetText: "2h 14m",
      stale: false,
      unknown: false,
    });
    expect(findText(tree, (t) => t.includes("47"))).toBe(true);
    expect(collectStyleColors(tree)).toContain(palette.ok);
  });

  it("renders em-dash when unknown is true", () => {
    const tree = buildUsageBucketTree({
      label: "5h",
      percent: null,
      color: palette.textMuted,
      resetText: "—",
      stale: true,
      unknown: true,
    });
    expect(findText(tree, (t) => t === "—")).toBe(true);
  });

  it("uses the supplied color for the percent text", () => {
    const tree = buildUsageBucketTree({
      label: "weekly",
      percent: 80,
      color: palette.caution,
      resetText: "Mon 10:00",
      stale: false,
      unknown: false,
    });
    expect(collectStyleColors(tree)).toContain(palette.caution);
  });

  it("includes a stale indicator when stale=true (color stays live)", () => {
    const tree = buildUsageBucketTree({
      label: "5h",
      percent: 47,
      color: palette.ok,
      resetText: "2h 14m",
      stale: true,
      unknown: false,
    });
    expect(findText(tree, (t) => t === "↻")).toBe(true);
    // Color is still the live one, not muted
    expect(collectStyleColors(tree)).toContain(palette.ok);
  });

  it("does NOT render bucket label or reset text inside the ring (they're unreadable at deck size)", () => {
    const tree = buildUsageBucketTree({
      label: "5h",
      percent: 47,
      color: palette.ok,
      resetText: "2h 14m",
      stale: false,
      unknown: false,
      style: "ring",
    });
    expect(findText(tree, (t) => t === "5H" || t === "5h")).toBe(false);
    expect(findText(tree, (t) => t === "2h 14m")).toBe(false);
  });
});

describe("buildExtraUsageTree", () => {
  it("formats currency amount", () => {
    const tree = buildExtraUsageTree({
      currency: "USD",
      usedMinor: 1250,    // $12.50
      limitMinor: 10000,  // $100.00
      utilization: 12.5,
      color: palette.ok,
      stale: false,
      disabled: false,
    });
    expect(findText(tree, (t) => t.includes("12.50"))).toBe(true);
    expect(findText(tree, (t) => t.includes("100"))).toBe(true);
  });

  it("shows 'Disabled' when disabled=true", () => {
    const tree = buildExtraUsageTree({
      currency: "USD",
      usedMinor: 0,
      limitMinor: 0,
      utilization: null,
      color: palette.textMuted,
      stale: false,
      disabled: true,
    });
    expect(findText(tree, (t) => t === "Disabled")).toBe(true);
  });
});

describe("buildStatusTree", () => {
  it("renders an OK dot in green for ok status", () => {
    const tree = buildStatusTree({
      label: "All Systems",
      description: "Operational",
      status: "ok",
      pulse: false,
    });
    expect(collectStyleColors(tree)).toContain(palette.ok);
    expect(findText(tree, (t) => t === "Operational")).toBe(true);
  });

  it("uses danger color for outage", () => {
    const tree = buildStatusTree({
      label: "Claude API",
      description: "Major outage",
      status: "outage",
      pulse: true,
    });
    expect(collectStyleColors(tree)).toContain(palette.danger);
  });

  it("uses maintenance blue", () => {
    const tree = buildStatusTree({
      label: "Claude API",
      description: "Scheduled maintenance",
      status: "maintenance",
      pulse: false,
    });
    expect(collectStyleColors(tree)).toContain(palette.maintenance);
  });
});

describe("buildResetCountdownTree", () => {
  it("renders countdown text big and shows label + 'RESETS IN'", () => {
    const tree = buildResetCountdownTree({
      label: "5h",
      countdownText: "2h 14m",
      utilization: 42,
      color: palette.ok,
      unknown: false,
    });
    expect(findText(tree, (t) => t === "2h 14m")).toBe(true);
    expect(findText(tree, (t) => t === "5H")).toBe(true);
    expect(findText(tree, (t) => t === "RESETS IN")).toBe(true);
  });

  it("uses the bucket color for the bar fill", () => {
    const tree = buildResetCountdownTree({
      label: "weekly",
      countdownText: "3d 4h",
      utilization: 78,
      color: palette.warn,
      unknown: false,
    });
    expect(collectStyleColors(tree)).toContain(palette.warn);
  });

  it("renders em-dash when unknown", () => {
    const tree = buildResetCountdownTree({
      label: "5h",
      countdownText: "—",
      utilization: null,
      color: palette.textMuted,
      unknown: true,
    });
    expect(findText(tree, (t) => t === "—")).toBe(true);
  });
});

describe("buildSimpleIconTree", () => {
  it("renders a glyph and an optional sublabel", () => {
    const tree = buildSimpleIconTree({ glyph: "↻", sublabel: "Refresh" });
    expect(findText(tree, (t) => t === "↻")).toBe(true);
    expect(findText(tree, (t) => t === "Refresh")).toBe(true);
  });
});
