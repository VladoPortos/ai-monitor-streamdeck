import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  credentialsPathFor,
  claudeBinaryCandidatesFor,
  emptyStdinRedirectFor,
} from "../../src/plugin/util/platform.js";

describe("detectPlatform", () => {
  it("returns 'win' for win32", () => {
    expect(detectPlatform("win32")).toBe("win");
  });
  it("returns 'mac' for darwin", () => {
    expect(detectPlatform("darwin")).toBe("mac");
  });
  it("returns 'linux' for linux (treated like POSIX file-based credentials)", () => {
    expect(detectPlatform("linux")).toBe("linux");
  });
  it("returns 'unknown' for unsupported", () => {
    expect(detectPlatform("freebsd")).toBe("unknown");
  });
});

describe("credentialsPathFor", () => {
  it("returns the user-profile relative path on Windows", () => {
    expect(credentialsPathFor("win", "C:/Users/alice")).toBe(
      "C:/Users/alice/.claude/.credentials.json",
    );
  });
  it("returns the home-relative path on Linux", () => {
    expect(credentialsPathFor("linux", "/home/alice")).toBe(
      "/home/alice/.claude/.credentials.json",
    );
  });
  it("returns null on mac (uses Keychain, not file)", () => {
    expect(credentialsPathFor("mac", "/Users/alice")).toBeNull();
  });
});

describe("claudeBinaryCandidatesFor", () => {
  it("includes ~/.local/bin/claude.exe on Windows", () => {
    const out = claudeBinaryCandidatesFor("win", "C:/Users/alice");
    expect(out).toContain("C:/Users/alice/.local/bin/claude.exe");
  });
  it("includes /usr/local/bin/claude on mac", () => {
    const out = claudeBinaryCandidatesFor("mac", "/Users/alice");
    expect(out).toContain("/usr/local/bin/claude");
  });
});

describe("emptyStdinRedirectFor", () => {
  it("returns NUL on Windows", () => {
    expect(emptyStdinRedirectFor("win")).toBe("NUL");
  });
  it("returns /dev/null on POSIX", () => {
    expect(emptyStdinRedirectFor("mac")).toBe("/dev/null");
    expect(emptyStdinRedirectFor("linux")).toBe("/dev/null");
  });
});
