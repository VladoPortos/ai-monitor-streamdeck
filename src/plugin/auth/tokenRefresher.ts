import { exec } from "node:child_process";

export interface RunnerResult {
  exitCode: number | null;
  stderr: string;
}
export type Runner = (command: string, timeoutMs: number) => Promise<RunnerResult>;

export interface RefreshOptions {
  /** Absolute path (or PATH-resolvable name) to the `claude` binary. */
  binary: string;
  /** Platform-appropriate empty-stdin redirect literal ("NUL" or "/dev/null"). */
  stdinRedirect: string;
  /** Hard cap on subprocess execution time. Default 15s. */
  timeoutMs?: number;
  /** Injectable for testing. */
  runner?: Runner;
}

export type RefreshResult = { ok: true } | { ok: false; cause: string };

const defaultRunner: Runner = (command, timeoutMs) =>
  new Promise((resolve) => {
    const child = exec(command, { timeout: timeoutMs }, (_err, _stdout, stderr) => {
      resolve({ exitCode: child.exitCode, stderr: stderr.toString() });
    });
  });

function quoteIfNeeded(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

export async function refreshToken(opts: RefreshOptions): Promise<RefreshResult> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const runner = opts.runner ?? defaultRunner;
  const command = `${quoteIfNeeded(opts.binary)} --init-only < ${opts.stdinRedirect}`;
  try {
    const result = await runner(command, timeoutMs);
    if (result.exitCode === 0) return { ok: true };
    return { ok: false, cause: `exit ${result.exitCode}: ${result.stderr.trim().slice(0, 200)}` };
  } catch (e) {
    return { ok: false, cause: e instanceof Error ? e.message : String(e) };
  }
}
