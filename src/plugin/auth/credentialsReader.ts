import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { credentialsPathFor, type Platform } from "../util/platform.js";

const execFileAsync = promisify(execFile);

export type TokenReadFailureReason =
  | "path_unknown"
  | "file_not_found"
  | "malformed"
  | "token_missing"
  | "unknown";

export type TokenReadResult =
  | { ok: true; token: string; expiresAt: Date | null }
  | { ok: false; reason: TokenReadFailureReason; cause?: string };

export interface ReadOAuthTokenInput {
  platform: Platform;
  /** Credentials file path. Null on macOS — Keychain is used instead. */
  path: string | null;
  /** Read function for file-based platforms. Injected for testability. */
  reader?: (path: string) => Promise<string>;
  /** Read function for macOS Keychain. Injected for testability. */
  keychainReader?: () => Promise<string>;
}

const defaultReader = (path: string) => readFile(path, "utf8");

const defaultKeychainReader = async () => {
  const { stdout } = await execFileAsync("security", [
    "find-generic-password",
    "-s",
    "Claude Code-credentials",
    "-w",
  ]);
  return stdout.trim();
};

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCredentials(raw: string): TokenReadResult {
  let json: unknown;
  try {
    json = JSON.parse(stripBom(raw));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof json !== "object" || json === null) {
    return { ok: false, reason: "malformed" };
  }
  const oauth = (json as { claudeAiOauth?: unknown }).claudeAiOauth;
  if (typeof oauth !== "object" || oauth === null) {
    return { ok: false, reason: "token_missing" };
  }
  const token = (oauth as { accessToken?: unknown }).accessToken;
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "token_missing" };
  }
  const expiresAtRaw = (oauth as { expiresAt?: unknown }).expiresAt;
  let expiresAt: Date | null = null;
  if (typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)) {
    expiresAt = new Date(expiresAtRaw);
  } else if (typeof expiresAtRaw === "string") {
    const parsed = new Date(expiresAtRaw);
    expiresAt = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return { ok: true, token, expiresAt };
}

export async function readOAuthToken(input: ReadOAuthTokenInput): Promise<TokenReadResult> {
  const reader = input.reader ?? defaultReader;
  const keychainReader = input.keychainReader ?? defaultKeychainReader;

  if (input.platform === "mac") {
    try {
      const raw = await keychainReader();
      return parseCredentials(raw);
    } catch (e) {
      return { ok: false, reason: "file_not_found", cause: errorMessage(e) };
    }
  }

  if (input.path === null) {
    return { ok: false, reason: "path_unknown" };
  }

  try {
    const raw = await reader(input.path);
    return parseCredentials(raw);
  } catch (e) {
    if (isEnoent(e)) return { ok: false, reason: "file_not_found", cause: errorMessage(e) };
    return { ok: false, reason: "unknown", cause: errorMessage(e) };
  }
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}
function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Convenience for production code — locates the path for the current platform and reads. */
export async function readOAuthTokenForCurrentPlatform(p: Platform): Promise<TokenReadResult> {
  return readOAuthToken({ platform: p, path: credentialsPathFor(p) });
}
