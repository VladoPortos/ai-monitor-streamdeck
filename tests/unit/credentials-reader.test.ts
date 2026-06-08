import { describe, it, expect, vi } from "vitest";
import { readOAuthToken } from "../../src/plugin/auth/credentialsReader.js";

const VALID_CREDS = JSON.stringify({
  claudeAiOauth: { accessToken: "sk-ant-oauth-test-token", refreshToken: "rt-1", expiresAt: 9999999999000 },
});

describe("readOAuthToken — file path (win/linux)", () => {
  it("reads accessToken from a valid credentials file", async () => {
    const reader = vi.fn().mockResolvedValue(VALID_CREDS);
    const result = await readOAuthToken({ platform: "win", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toBe("sk-ant-oauth-test-token");
    }
    expect(reader).toHaveBeenCalledWith("/fake/.credentials.json");
  });

  it("returns failure when file is missing", async () => {
    const reader = vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const result = await readOAuthToken({ platform: "win", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("file_not_found");
    }
  });

  it("returns failure when JSON is malformed", async () => {
    const reader = vi.fn().mockResolvedValue("{not valid");
    const result = await readOAuthToken({ platform: "win", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed");
    }
  });

  it("returns failure when accessToken field is missing", async () => {
    const reader = vi.fn().mockResolvedValue(JSON.stringify({ other: "data" }));
    const result = await readOAuthToken({ platform: "win", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("token_missing");
    }
  });

  it("returns failure when path is null on POSIX platforms", async () => {
    const reader = vi.fn();
    const result = await readOAuthToken({ platform: "win", path: null, reader });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("path_unknown");
    }
    expect(reader).not.toHaveBeenCalled();
  });

  it("strips a UTF-8 BOM from the file contents", async () => {
    const reader = vi.fn().mockResolvedValue("﻿" + VALID_CREDS);
    const result = await readOAuthToken({ platform: "linux", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token).toBe("sk-ant-oauth-test-token");
  });

  it("propagates expiresAt when present", async () => {
    const reader = vi.fn().mockResolvedValue(VALID_CREDS);
    const result = await readOAuthToken({ platform: "win", path: "/fake/.credentials.json", reader });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expiresAt).toBeInstanceOf(Date);
  });
});

describe("readOAuthToken — macOS Keychain path", () => {
  it("uses keychainReader on mac and parses returned JSON", async () => {
    const reader = vi.fn();
    const keychainReader = vi.fn().mockResolvedValue(VALID_CREDS);
    const result = await readOAuthToken({ platform: "mac", path: null, reader, keychainReader });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.token).toBe("sk-ant-oauth-test-token");
    expect(keychainReader).toHaveBeenCalled();
    expect(reader).not.toHaveBeenCalled();
  });

  it("returns failure when Keychain entry is missing", async () => {
    const keychainReader = vi.fn().mockRejectedValue(new Error("could not find generic password"));
    const result = await readOAuthToken({ platform: "mac", path: null, reader: vi.fn(), keychainReader });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("file_not_found");
  });
});
