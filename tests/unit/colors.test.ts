import { describe, it, expect } from "vitest";
import { gradeColor, DEFAULT_BANDS, type ColorBands } from "../../src/plugin/util/colors.js";

describe("gradeColor", () => {
  it("returns ok color for 0%", () => {
    expect(gradeColor(0)).toBe(DEFAULT_BANDS.ok.color);
  });

  it("returns ok color just below ok upper bound (59.9)", () => {
    expect(gradeColor(59.9)).toBe(DEFAULT_BANDS.ok.color);
  });

  it("returns warn color exactly at ok upper bound (60)", () => {
    expect(gradeColor(60)).toBe(DEFAULT_BANDS.warn.color);
  });

  it("returns warn color just below warn upper bound (79.9)", () => {
    expect(gradeColor(79.9)).toBe(DEFAULT_BANDS.warn.color);
  });

  it("returns caution color exactly at warn upper bound (80)", () => {
    expect(gradeColor(80)).toBe(DEFAULT_BANDS.caution.color);
  });

  it("returns caution color just below caution upper bound (94.9)", () => {
    expect(gradeColor(94.9)).toBe(DEFAULT_BANDS.caution.color);
  });

  it("returns danger color exactly at caution upper bound (95)", () => {
    expect(gradeColor(95)).toBe(DEFAULT_BANDS.danger.color);
  });

  it("returns danger color when over 100 (overage)", () => {
    expect(gradeColor(125)).toBe(DEFAULT_BANDS.danger.color);
  });

  it("clamps negative input to ok", () => {
    expect(gradeColor(-5)).toBe(DEFAULT_BANDS.ok.color);
  });

  it("treats NaN as danger (defensive: never claim healthy when uncertain)", () => {
    expect(gradeColor(Number.NaN)).toBe(DEFAULT_BANDS.danger.color);
  });

  it("honors custom bands", () => {
    const bands: ColorBands = {
      ok: { upTo: 50, color: "#00ff00" },
      warn: { upTo: 75, color: "#ffff00" },
      caution: { upTo: 90, color: "#ff8800" },
      danger: { color: "#ff0000" },
    };
    expect(gradeColor(25, bands)).toBe("#00ff00");
    expect(gradeColor(60, bands)).toBe("#ffff00");
    expect(gradeColor(85, bands)).toBe("#ff8800");
    expect(gradeColor(95, bands)).toBe("#ff0000");
  });
});
