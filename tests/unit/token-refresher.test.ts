import { describe, it, expect, vi } from "vitest";
import { refreshToken } from "../../src/plugin/auth/tokenRefresher.js";

describe("refreshToken", () => {
  it("invokes the runner with the binary + --init-only + stdin redirect", async () => {
    const runner = vi.fn().mockResolvedValue({ exitCode: 0, stderr: "" });
    await refreshToken({
      binary: "C:/Users/x/.local/bin/claude.exe",
      stdinRedirect: "NUL",
      runner,
    });
    expect(runner).toHaveBeenCalledTimes(1);
    const [command, timeoutMs] = runner.mock.calls[0]!;
    expect(command).toContain("claude.exe");
    expect(command).toContain("--init-only");
    expect(command).toContain("< NUL");
    expect(timeoutMs).toBe(15000);
  });

  it("resolves ok on exit code 0", async () => {
    const runner = vi.fn().mockResolvedValue({ exitCode: 0, stderr: "" });
    const result = await refreshToken({ binary: "claude", stdinRedirect: "/dev/null", runner });
    expect(result.ok).toBe(true);
  });

  it("resolves not-ok on non-zero exit", async () => {
    const runner = vi.fn().mockResolvedValue({ exitCode: 1, stderr: "boom" });
    const result = await refreshToken({ binary: "claude", stdinRedirect: "/dev/null", runner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toContain("exit 1");
  });

  it("resolves not-ok when runner rejects", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("ENOENT spawn claude"));
    const result = await refreshToken({ binary: "claude", stdinRedirect: "/dev/null", runner });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toContain("ENOENT");
  });

  it("respects a custom timeout", async () => {
    const runner = vi.fn().mockResolvedValue({ exitCode: 0, stderr: "" });
    await refreshToken({
      binary: "claude",
      stdinRedirect: "/dev/null",
      timeoutMs: 5000,
      runner,
    });
    expect(runner.mock.calls[0]![1]).toBe(5000);
  });

  it("quotes the binary path when it contains spaces", async () => {
    const runner = vi.fn().mockResolvedValue({ exitCode: 0, stderr: "" });
    await refreshToken({
      binary: "C:/Program Files/Anthropic/claude.exe",
      stdinRedirect: "NUL",
      runner,
    });
    const command = runner.mock.calls[0]![0] as string;
    expect(command).toMatch(/"C:\/Program Files\/Anthropic\/claude\.exe"/);
  });
});
