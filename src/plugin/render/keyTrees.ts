import { palette, font, statusColor, KEY_SIZE } from "./theme.js";

/** A satori-compatible element tree. */
export interface RenderNode {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: unknown;
  };
}

const h = (
  type: string,
  style: Record<string, unknown>,
  ...children: unknown[]
): RenderNode => ({
  type,
  props: { style, children: children.flat() },
});

const text = (value: string, style: Record<string, unknown> = {}): RenderNode =>
  h("div", { display: "flex", ...style }, value);

const PADDING = 8;

// =============================================================================
// USAGE BUCKET
// =============================================================================

export type DisplayStyle = "ring" | "bar";

export interface UsageBucketProps {
  label: string;
  /** 0–100 (or higher for overage). null means we have no data. */
  percent: number | null;
  color: string;
  resetText: string;
  stale: boolean;
  unknown: boolean;
  style?: DisplayStyle;
}

export function buildUsageBucketTree(props: UsageBucketProps): RenderNode {
  return (props.style ?? "ring") === "ring"
    ? buildUsageBucketRingTree(props)
    : buildUsageBucketBarTree(props);
}

/**
 * Build an SVG arc-ring with the given utilization percentage as a base64-encoded data URI.
 * Returns the data URL satori's <img> can consume.
 */
function ringSvgDataUri(pct: number, color: string, size: number, stroke: number): string {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  const dash = `${filled} ${circumference - filled}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${r}" stroke="${palette.surface}" stroke-width="${stroke}" fill="none"/><circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-dasharray="${dash}" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Ring style — circular gauge via inline SVG. Closest match to "AI Token Tracker" reference. */
export function buildUsageBucketRingTree(props: UsageBucketProps): RenderNode {
  const pct = props.unknown ? 0 : Math.min(100, Math.max(0, props.percent ?? 0));
  const percentText = props.unknown ? "—" : `${Math.round(props.percent ?? 0)}%`;
  // Colors always reflect the actual data. Staleness is communicated only via
  // a small corner glyph (props.stale), never by muting the live color.
  const ringColor = props.unknown ? palette.textMuted : props.color;
  const valueColor = props.unknown ? palette.textMuted : props.color;

  const RING_SIZE = 124;
  const RING_STROKE = 14;
  const ringUri = ringSvgDataUri(pct, ringColor, RING_SIZE, RING_STROKE);

  return h(
    "div",
    {
      display: "flex",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color: palette.text,
      fontFamily: font.family,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    // stale glyph in top-right corner
    props.stale
      ? h(
          "div",
          {
            display: "flex",
            position: "absolute",
            top: 4,
            right: 6,
            fontSize: 12,
            color: palette.textMuted,
          },
          "↻",
        )
      : "",
    // Ring as a base64-encoded SVG image
    {
      type: "img",
      props: {
        src: ringUri,
        width: RING_SIZE,
        height: RING_SIZE,
        style: { position: "absolute" },
      },
    },
    // Inner content overlay: just the big percent. Labels and reset time are
    // unreadable at this size on the deck — keep the center clean.
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        width: KEY_SIZE,
        height: KEY_SIZE,
      },
      text(percentText, {
        fontSize: 42,
        fontWeight: 700,
        color: valueColor,
        lineHeight: 1,
      }),
    ),
  );
}

/** Bar style — bold label, huge %, thick rounded bar, prominent reset text. */
export function buildUsageBucketBarTree(props: UsageBucketProps): RenderNode {
  const pct = props.unknown ? 0 : Math.min(100, Math.max(0, props.percent ?? 0));
  const percentText = props.unknown ? "—" : `${Math.round(props.percent ?? 0)}%`;
  // See ring tree: live color always, staleness shown only as a corner glyph.
  const valueColor = props.unknown ? palette.textMuted : props.color;
  const fillColor = props.unknown ? palette.textMuted : props.color;

  const BAR_THICK = 14;
  const BAR_R = BAR_THICK / 2;

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color: palette.text,
      fontFamily: font.family,
      padding: PADDING,
      justifyContent: "space-between",
    },
    // top row: bold label + optional stale icon
    h(
      "div",
      { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
      text(props.label.toUpperCase(), {
        fontSize: 11,
        fontWeight: 700,
        color: palette.textMuted,
        letterSpacing: "0.06em",
      }),
      props.stale ? text("↻", { fontSize: 12, color: palette.textMuted }) : "",
    ),
    // big percent — fills the visual center
    h(
      "div",
      { display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1 },
      text(percentText, {
        fontSize: 44,
        fontWeight: 700,
        color: valueColor,
        lineHeight: 1,
      }),
    ),
    // thick bar
    h(
      "div",
      {
        display: "flex",
        width: "100%",
        height: BAR_THICK,
        backgroundColor: palette.surface,
        borderRadius: BAR_R,
      },
      h("div", {
        display: "flex",
        width: `${pct}%`,
        height: BAR_THICK,
        backgroundColor: fillColor,
        borderRadius: BAR_R,
      }),
    ),
    // reset text
    text(props.resetText, {
      fontSize: 11,
      color: palette.textMuted,
      marginTop: 4,
    }),
  );
}

// =============================================================================
// EXTRA USAGE
// =============================================================================

export interface ExtraUsageProps {
  currency: string;
  usedMinor: number;
  limitMinor: number;
  utilization: number | null;
  color: string;
  stale: boolean;
  disabled: boolean;
}

const formatMoney = (minor: number, currency: string): string => {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
  const major = (minor / 100).toFixed(2);
  return `${symbol}${major}`;
};

export function buildExtraUsageTree(props: ExtraUsageProps): RenderNode {
  if (props.disabled) {
    return h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        width: KEY_SIZE,
        height: KEY_SIZE,
        backgroundColor: palette.bg,
        color: palette.text,
        fontFamily: font.family,
        padding: PADDING,
        justifyContent: "center",
        alignItems: "center",
      },
      text("EXTRA", { fontSize: 11, fontWeight: 700, color: palette.textMuted, letterSpacing: "0.06em" }),
      text("Disabled", { fontSize: 18, color: palette.textMuted, marginTop: 8 }),
    );
  }

  const usedText = formatMoney(props.usedMinor, props.currency);
  const limitText = formatMoney(props.limitMinor, props.currency);
  const pct = props.utilization !== null
    ? Math.round(props.utilization)
    : props.limitMinor > 0
      ? Math.round((props.usedMinor / props.limitMinor) * 100)
      : 0;

  const BAR_THICK = 14;
  const valueColor = props.color;

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color: palette.text,
      fontFamily: font.family,
      padding: PADDING,
      justifyContent: "space-between",
    },
    h(
      "div",
      { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
      text("EXTRA", { fontSize: 11, fontWeight: 700, color: palette.textMuted, letterSpacing: "0.06em" }),
      text(`${pct}%`, { fontSize: 11, fontWeight: 700, color: valueColor }),
    ),
    h(
      "div",
      { display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center" },
      text(usedText, {
        fontSize: 30,
        fontWeight: 700,
        color: valueColor,
        lineHeight: 1,
      }),
      text(`of ${limitText}`, { fontSize: 11, color: palette.textMuted, marginTop: 4 }),
    ),
    h(
      "div",
      {
        display: "flex",
        width: "100%",
        height: BAR_THICK,
        backgroundColor: palette.surface,
        borderRadius: BAR_THICK / 2,
      },
      h("div", {
        display: "flex",
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: BAR_THICK,
        backgroundColor: valueColor,
        borderRadius: BAR_THICK / 2,
      }),
    ),
  );
}

// =============================================================================
// RESET COUNTDOWN
// =============================================================================

export interface ResetCountdownProps {
  /** Short bucket label (e.g. "5H", "WEEKLY"). */
  label: string;
  /** Pre-formatted countdown like "2h 14m", "42m", or "—". */
  countdownText: string;
  /** Bucket utilization 0-100, or null when unknown. Used for color grading the bar. */
  utilization: number | null;
  /** Color matching the bucket's current threshold (computed by caller). */
  color: string;
  unknown: boolean;
}

export function buildResetCountdownTree(props: ResetCountdownProps): RenderNode {
  const pct = props.unknown || props.utilization === null
    ? 0
    : Math.min(100, Math.max(0, props.utilization));
  const valueColor = props.unknown ? palette.textMuted : props.color;
  const fillColor = props.unknown ? palette.textMuted : props.color;

  const BAR_THICK = 10;

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color: palette.text,
      fontFamily: font.family,
      padding: PADDING,
      justifyContent: "space-between",
    },
    h(
      "div",
      { display: "flex", flexDirection: "column", alignItems: "flex-start" },
      text(props.label.toUpperCase(), {
        fontSize: 11,
        fontWeight: 700,
        color: palette.textMuted,
        letterSpacing: "0.06em",
      }),
      text("RESETS IN", {
        fontSize: 9,
        color: palette.textMuted,
        letterSpacing: "0.06em",
        marginTop: 1,
      }),
    ),
    h(
      "div",
      { display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1 },
      text(props.countdownText, {
        fontSize: props.countdownText.length > 5 ? 32 : 40,
        fontWeight: 700,
        color: valueColor,
        lineHeight: 1,
      }),
    ),
    h(
      "div",
      {
        display: "flex",
        width: "100%",
        height: BAR_THICK,
        backgroundColor: palette.surface,
        borderRadius: BAR_THICK / 2,
      },
      h("div", {
        display: "flex",
        width: `${pct}%`,
        height: BAR_THICK,
        backgroundColor: fillColor,
        borderRadius: BAR_THICK / 2,
      }),
    ),
  );
}

// =============================================================================
// SERVICE STATUS
// =============================================================================

export type NormalizedStatusKey = "ok" | "degraded" | "outage" | "maintenance";

export interface StatusTreeProps {
  label: string;
  description: string;
  status: NormalizedStatusKey;
  pulse: boolean;
}

const STATUS_INNER_TEXT: Record<NormalizedStatusKey, string> = {
  ok: "UP",
  degraded: "SLOW",
  outage: "DOWN",
  maintenance: "MTN",
};

export function buildStatusTree(props: StatusTreeProps): RenderNode {
  const color = statusColor(props.status);
  const innerText = STATUS_INNER_TEXT[props.status];
  const DOT = 78;
  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color: palette.text,
      fontFamily: font.family,
      padding: PADDING,
      justifyContent: "space-between",
      alignItems: "center",
    },
    text(props.label.toUpperCase(), {
      fontSize: 11,
      fontWeight: 700,
      color: palette.textMuted,
      letterSpacing: "0.06em",
    }),
    h(
      "div",
      {
        display: "flex",
        flexGrow: 1,
        position: "relative",
        width: DOT + 24,
        height: DOT + 24,
        alignItems: "center",
        justifyContent: "center",
      },
      // Halo: absolutely positioned, opacity does NOT cascade to dot/text
      h("div", {
        display: "flex",
        position: "absolute",
        width: DOT + 24,
        height: DOT + 24,
        borderRadius: (DOT + 24) / 2,
        backgroundColor: color,
        opacity: props.pulse ? 0.35 : 0.22,
      }),
      // Solid dot — full color, no opacity cascade
      h(
        "div",
        {
          display: "flex",
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        },
        text(innerText, {
          fontSize: innerText.length <= 2 ? 30 : 22,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1,
          letterSpacing: "0.02em",
        }),
      ),
    ),
    // Only show description when there's something interesting to say.
    props.status !== "ok"
      ? text(props.description, {
          fontSize: 10,
          fontWeight: 600,
          color: palette.text,
          textAlign: "center",
          maxWidth: KEY_SIZE - 2 * PADDING,
          lineHeight: 1.2,
        })
      : text(props.description, {
          fontSize: 10,
          color: palette.textMuted,
          textAlign: "center",
          maxWidth: KEY_SIZE - 2 * PADDING,
          lineHeight: 1.2,
        }),
  );
}

// =============================================================================
// SIMPLE ICON (refresh, open-web)
// =============================================================================

export interface SimpleIconProps {
  glyph: string;
  sublabel?: string;
  color?: string;
}

export function buildSimpleIconTree(props: SimpleIconProps): RenderNode {
  const color = props.color ?? palette.text;
  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: KEY_SIZE,
      height: KEY_SIZE,
      backgroundColor: palette.bg,
      color,
      fontFamily: font.family,
      padding: PADDING,
      alignItems: "center",
      justifyContent: "center",
    },
    text(props.glyph, { fontSize: 48, color }),
    props.sublabel
      ? text(props.sublabel, { fontSize: font.label.size, color: palette.textMuted, marginTop: 6 })
      : "",
  );
}
