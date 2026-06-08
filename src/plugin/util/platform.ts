import { homedir, platform as osPlatform } from "node:os";
import { join } from "node:path";

export type Platform = "win" | "mac" | "linux" | "unknown";

export function detectPlatform(raw: NodeJS.Platform | string = osPlatform()): Platform {
  switch (raw) {
    case "win32":
      return "win";
    case "darwin":
      return "mac";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

/** Path to the Claude Code credentials JSON, or null when credentials live elsewhere (macOS Keychain). */
export function credentialsPathFor(p: Platform, home: string = homedir()): string | null {
  if (p === "mac") return null;
  if (p === "win" || p === "linux") {
    return join(home, ".claude", ".credentials.json").replaceAll("\\", "/");
  }
  return null;
}

/** Ordered list of likely `claude` binary locations to probe before falling back to PATH lookup. */
export function claudeBinaryCandidatesFor(p: Platform, home: string = homedir()): string[] {
  const norm = (s: string) => s.replaceAll("\\", "/");
  switch (p) {
    case "win":
      return [
        norm(join(home, ".local", "bin", "claude.exe")),
        norm(join(home, "AppData", "Local", "AnthropicClaude", "claude.exe")),
      ];
    case "mac":
      return ["/usr/local/bin/claude", "/opt/homebrew/bin/claude", norm(join(home, ".local", "bin", "claude"))];
    case "linux":
      return ["/usr/local/bin/claude", "/usr/bin/claude", norm(join(home, ".local", "bin", "claude"))];
    default:
      return [];
  }
}

/** Stdin redirect literal we splice into shell invocations so `claude --init-only` skips its 3s wait. */
export function emptyStdinRedirectFor(p: Platform): string {
  return p === "win" ? "NUL" : "/dev/null";
}
