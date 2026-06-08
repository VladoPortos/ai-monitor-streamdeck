import { describe, it, expect } from "vitest";
import { formatCountdown, formatResetClock } from "../../src/plugin/util/intervals.js";

describe("formatCountdown", () => {
  const now = new Date("2026-05-17T12:00:00Z");

  it("formats 4h 33m correctly", () => {
    const reset = new Date("2026-05-17T16:33:00Z");
    expect(formatCountdown(reset, now)).toBe("4h 33m");
  });

  it("formats 45m only", () => {
    const reset = new Date("2026-05-17T12:45:00Z");
    expect(formatCountdown(reset, now)).toBe("45m");
  });

  it("formats 1m only", () => {
    const reset = new Date("2026-05-17T12:01:00Z");
    expect(formatCountdown(reset, now)).toBe("1m");
  });

  it("returns <1m for less than a minute remaining", () => {
    const reset = new Date("2026-05-17T12:00:30Z");
    expect(formatCountdown(reset, now)).toBe("<1m");
  });

  it("returns em-dash for past reset", () => {
    const reset = new Date("2026-05-17T11:00:00Z");
    expect(formatCountdown(reset, now)).toBe("—");
  });

  it("returns em-dash for null", () => {
    expect(formatCountdown(null, now)).toBe("—");
  });

  it("formats days and hours: 3d 2h", () => {
    const reset = new Date("2026-05-20T14:00:00Z");
    expect(formatCountdown(reset, now)).toBe("3d 2h");
  });

  it("formats whole days: 7d", () => {
    const reset = new Date("2026-05-24T12:00:00Z");
    expect(formatCountdown(reset, now)).toBe("7d");
  });

  it("formats hours only when minutes round to 0", () => {
    const reset = new Date("2026-05-17T15:00:00Z");
    expect(formatCountdown(reset, now)).toBe("3h");
  });

  it("accepts ISO string input", () => {
    expect(formatCountdown("2026-05-17T16:33:00Z", now)).toBe("4h 33m");
  });
});

describe("formatResetClock", () => {
  const now = new Date("2026-05-17T12:00:00Z"); // 2026-05-17 is a Sunday

  it("returns weekday + HH:MM for reset within a week", () => {
    const reset = new Date("2026-05-18T08:00:00Z"); // Monday
    expect(formatResetClock(reset, now, { timeZone: "UTC" })).toBe("Mon 08:00");
  });

  it("returns em-dash for null", () => {
    expect(formatResetClock(null, now, { timeZone: "UTC" })).toBe("—");
  });

  it("returns Mon DD for reset more than a week away", () => {
    const reset = new Date("2026-06-15T08:00:00Z");
    expect(formatResetClock(reset, now, { timeZone: "UTC" })).toBe("Jun 15");
  });

  it("returns em-dash for past", () => {
    const reset = new Date("2026-05-17T11:00:00Z");
    expect(formatResetClock(reset, now, { timeZone: "UTC" })).toBe("—");
  });
});
