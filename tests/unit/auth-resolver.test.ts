import { describe, it, expect, vi } from "vitest";
import { AuthResolver } from "../../src/plugin/auth/authResolver.js";
import type { TokenReadResult } from "../../src/plugin/auth/credentialsReader.js";
import type { RefreshResult } from "../../src/plugin/auth/tokenRefresher.js";

const ok = (token = "tok-1"): TokenReadResult => ({ ok: true, token, expiresAt: null });
const missing: TokenReadResult = { ok: false, reason: "token_missing" };
const fileMissing: TokenReadResult = { ok: false, reason: "file_not_found" };
const refreshOk: RefreshResult = { ok: true };
const refreshBad: RefreshResult = { ok: false, cause: "exit 1" };

describe("AuthResolver", () => {
  it("returns the token on first getToken and caches it", async () => {
    const read = vi.fn().mockResolvedValue(ok("tok-A"));
    const refresh = vi.fn();
    const r = new AuthResolver({ read, refresh });

    expect(await r.getToken()).toBe("tok-A");
    expect(await r.getToken()).toBe("tok-A");
    expect(read).toHaveBeenCalledTimes(1);
    expect(r.state()).toBe("ok");
  });

  it("returns null and state 'expired' when read fails initially", async () => {
    const read = vi.fn().mockResolvedValue(fileMissing);
    const r = new AuthResolver({ read, refresh: vi.fn() });
    expect(await r.getToken()).toBeNull();
    expect(r.state()).toBe("expired");
  });

  it("onAuthFailure triggers refresh+read and updates cached token", async () => {
    const read = vi.fn().mockResolvedValueOnce(ok("old")).mockResolvedValueOnce(ok("new"));
    const refresh = vi.fn().mockResolvedValue(refreshOk);
    const now = vi.fn().mockReturnValue(1_000_000);
    const r = new AuthResolver({ read, refresh, now });

    expect(await r.getToken()).toBe("old");
    await r.onAuthFailure();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await r.getToken()).toBe("new");
  });

  it("rate-limits refresh: second call within cooldown is a no-op", async () => {
    const read = vi.fn().mockResolvedValue(ok("t"));
    const refresh = vi.fn().mockResolvedValue(refreshOk);
    const now = vi.fn().mockReturnValue(1_000_000);
    const r = new AuthResolver({ read, refresh, now, cooldownMs: 5 * 60_000 });

    await r.getToken();
    await r.onAuthFailure();
    expect(refresh).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 60_000); // 1 minute later, still in cooldown
    await r.onAuthFailure();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rate-limit allows refresh again after cooldown elapses", async () => {
    const read = vi.fn().mockResolvedValue(ok("t"));
    const refresh = vi.fn().mockResolvedValue(refreshOk);
    const now = vi.fn().mockReturnValue(1_000_000);
    const r = new AuthResolver({ read, refresh, now, cooldownMs: 5 * 60_000 });

    await r.getToken();
    await r.onAuthFailure();
    now.mockReturnValue(1_000_000 + 6 * 60_000); // past cooldown
    await r.onAuthFailure();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("sets state 'expired' when refresh fails", async () => {
    const read = vi.fn().mockResolvedValue(ok("t"));
    const refresh = vi.fn().mockResolvedValue(refreshBad);
    const r = new AuthResolver({ read, refresh });

    await r.getToken();
    await r.onAuthFailure();
    expect(r.state()).toBe("expired");
  });

  it("sets state 'expired' when post-refresh read still has no token", async () => {
    const read = vi.fn().mockResolvedValueOnce(ok("t")).mockResolvedValueOnce(missing);
    const refresh = vi.fn().mockResolvedValue(refreshOk);
    const r = new AuthResolver({ read, refresh });

    await r.getToken();
    await r.onAuthFailure();
    expect(r.state()).toBe("expired");
  });

  it("forceRefresh ignores cooldown", async () => {
    const read = vi.fn().mockResolvedValue(ok("t"));
    const refresh = vi.fn().mockResolvedValue(refreshOk);
    const now = vi.fn().mockReturnValue(1_000_000);
    const r = new AuthResolver({ read, refresh, now, cooldownMs: 5 * 60_000 });

    await r.getToken();
    await r.onAuthFailure();
    await r.forceRefresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("during refresh, state is 'refreshing'", async () => {
    const read = vi.fn().mockResolvedValue(ok("t"));
    let resolveRefresh!: (v: RefreshResult) => void;
    const refresh = vi.fn().mockImplementation(
      () => new Promise<RefreshResult>((res) => { resolveRefresh = res; }),
    );
    const r = new AuthResolver({ read, refresh });

    await r.getToken();
    const refreshPromise = r.onAuthFailure();
    expect(r.state()).toBe("refreshing");
    resolveRefresh(refreshOk);
    await refreshPromise;
    expect(r.state()).toBe("ok");
  });
});
