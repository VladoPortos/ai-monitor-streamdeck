import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, appendFileSync } from "node:fs";

// CJS bundle target: __dirname is provided by Node. Declared here so the
// TypeScript compiler doesn't complain about the global reference in ESM mode.
declare const __dirname: string;

// Last-resort crash log — written to a known location regardless of SDK state,
// so we can debug startup failures even when Stream Deck's logger is unavailable.
const CRASH_LOG = join(homedir(), ".ai-monitor-streamdeck", "startup.log");

function writeStartupLog(line: string): void {
  try {
    mkdirSync(join(homedir(), ".ai-monitor-streamdeck"), { recursive: true });
    appendFileSync(CRASH_LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* don't crash trying to log a crash */ }
}

process.on("uncaughtException", (e) => {
  writeStartupLog(`uncaughtException: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
});
process.on("unhandledRejection", (r) => {
  writeStartupLog(`unhandledRejection: ${r instanceof Error ? r.stack ?? r.message : String(r)}`);
});

import { detectPlatform, credentialsPathFor, claudeBinaryCandidatesFor, emptyStdinRedirectFor } from "./util/platform.js";
import { AuthResolver } from "./auth/authResolver.js";
import { readOAuthToken } from "./auth/credentialsReader.js";
import { refreshToken } from "./auth/tokenRefresher.js";
import { StateStore } from "./state/store.js";
import { loadSnapshotFromDisk, saveSnapshotToDisk } from "./state/persistence.js";
import { UsagePoller } from "./pollers/usagePoller.js";
import { StatusPoller } from "./pollers/statusPoller.js";
import { fetchUsage } from "./api/usageClient.js";
import { fetchStatusSummary } from "./api/statusClient.js";
import { loadFonts } from "./render/renderer.js";
import { setPluginContext } from "./pluginContext.js";

import { UsageBucketAction } from "./actions/usageBucketAction.js";
import { UsageHeadlineAction } from "./actions/usageHeadlineAction.js";
import { UsageResetAction } from "./actions/usageResetAction.js";
import { ExtraUsageAction } from "./actions/extraUsageAction.js";
import { StatusOverallAction } from "./actions/statusOverallAction.js";
import { StatusComponentAction } from "./actions/statusComponentAction.js";
import { RefreshAction } from "./actions/refreshAction.js";
import { OpenWebAction } from "./actions/openWebAction.js";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const USAGE_BETA_HEADER = "oauth-2025-04-20";
const STATUS_ENDPOINT = "https://status.claude.com/api/v2/summary.json";
const OPEN_WEB_DEFAULT = "https://claude.ai/settings/usage";
const USAGE_POLL_MS = 60_000;
const STATUS_POLL_MS = 30_000;

// Stale thresholds picked generously so a single failed poll (e.g. during a
// token refresh that spawns `claude --init-only`) doesn't visibly mute the
// colors. The colors only go grey if we've had no fresh data for >5 minutes.
const FRESHNESS_BANDS = {
  agingMs: USAGE_POLL_MS,            // > 1 min = aging (internal only)
  staleMs: USAGE_POLL_MS * 5,        // > 5 min = stale (visible mute)
  veryStaleMs: USAGE_POLL_MS * 15,   // > 15 min = very stale (show em-dash)
};

// How long to wait between consecutive `claude --init-only` invocations.
// Short enough that a missed refresh recovers quickly, long enough not to
// hammer the Claude Code binary if refreshes are repeatedly failing.
const AUTH_REFRESH_COOLDOWN_MS = 90_000;

async function main(): Promise<void> {
  writeStartupLog("starting...");
  streamDeck.logger.setLevel(LogLevel.INFO);

  // Find the plugin root (the .sdPlugin folder) relative to this bundled file.
  // tsup outputs to com.vladoportos.aimonitor.sdPlugin/bin/plugin.js, so __dirname is that bin/ folder.
  const pluginRoot = join(__dirname, "..");
  const fontsDir = join(pluginRoot, "fonts");
  const stateFile = join(homedir(), ".ai-monitor-streamdeck", "state.json");
  writeStartupLog(`pluginRoot=${pluginRoot}`);

  try {
    await loadFonts(fontsDir);
    writeStartupLog("fonts loaded");
  } catch (e) {
    writeStartupLog(`font load failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
    throw e;
  }
  streamDeck.logger.info("Fonts loaded.");

  // Auth wiring.
  const platform = detectPlatform();
  const credPath = credentialsPathFor(platform);
  const binaryCandidate = claudeBinaryCandidatesFor(platform)[0] ?? "claude";
  const stdinRedirect = emptyStdinRedirectFor(platform);

  const auth = new AuthResolver({
    read: async () => {
      const r = await readOAuthToken({ platform, path: credPath });
      writeStartupLog(`auth read: ${r.ok ? "ok" : `failed (${r.reason})`}`);
      return r;
    },
    refresh: async () => {
      const start = Date.now();
      writeStartupLog(`auth refresh: spawning '${binaryCandidate} --init-only'`);
      const r = await refreshToken({ binary: binaryCandidate, stdinRedirect });
      writeStartupLog(`auth refresh: ${r.ok ? "ok" : `failed (${r.cause})`} after ${Date.now() - start}ms`);
      return r;
    },
    cooldownMs: AUTH_REFRESH_COOLDOWN_MS,
  });

  // State + persistence.
  const store = new StateStore();
  try {
    await loadSnapshotFromDisk(store, stateFile);
    if (store.getUsage() || store.getStatus()) {
      streamDeck.logger.info("Restored snapshot from disk.");
    }
  } catch (e) {
    streamDeck.logger.warn(`Snapshot restore failed: ${e instanceof Error ? e.message : e}`);
  }
  // Save state on every change (debounced via simple timer).
  let saveTimer: NodeJS.Timeout | null = null;
  store.subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveSnapshotToDisk(store, stateFile).catch((e) =>
        streamDeck.logger.warn(`Snapshot save failed: ${e instanceof Error ? e.message : e}`),
      );
    }, 1000);
  });

  // Pollers.
  const usagePoller = new UsagePoller({
    fetcher: (i) => fetchUsage(i),
    store,
    auth,
    intervalMs: USAGE_POLL_MS,
    endpoint: USAGE_ENDPOINT,
    betaHeader: USAGE_BETA_HEADER,
    log: (msg) => writeStartupLog(msg),
  });
  const statusPoller = new StatusPoller({
    fetcher: (i) => fetchStatusSummary(i),
    store,
    intervalMs: STATUS_POLL_MS,
    endpoint: STATUS_ENDPOINT,
  });

  setPluginContext({
    store,
    auth,
    usagePoller,
    statusPoller,
    freshnessBands: FRESHNESS_BANDS,
    timeZone: undefined,
    openWebDefaultUrl: OPEN_WEB_DEFAULT,
  });

  // Register actions.
  streamDeck.actions.registerAction(new UsageBucketAction());
  streamDeck.actions.registerAction(new UsageHeadlineAction());
  streamDeck.actions.registerAction(new UsageResetAction());
  streamDeck.actions.registerAction(new ExtraUsageAction());
  streamDeck.actions.registerAction(new StatusOverallAction());
  streamDeck.actions.registerAction(new StatusComponentAction());
  streamDeck.actions.registerAction(new RefreshAction());
  streamDeck.actions.registerAction(new OpenWebAction());

  writeStartupLog("about to connect to Stream Deck");
  await streamDeck.connect();
  writeStartupLog("connected to Stream Deck");
  streamDeck.logger.info("Connected to Stream Deck.");

  // Kick off initial polls (fire-and-forget) then start recurring intervals.
  void Promise.all([usagePoller.pollNow(), statusPoller.pollNow()]).catch((e) =>
    streamDeck.logger.warn(`Initial poll failed: ${e instanceof Error ? e.message : e}`),
  );
  usagePoller.start();
  statusPoller.start();

  // Refresh on system wake to avoid showing stale data.
  streamDeck.system.onSystemDidWakeUp(() => {
    streamDeck.logger.info("System woke up; refreshing pollers.");
    void usagePoller.pollNow();
    void statusPoller.pollNow();
  });
}

main().catch((e) => {
  writeStartupLog(`bootstrap failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
  try {
    streamDeck.logger.error(`Plugin bootstrap failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
  } catch { /* logger may not be initialized yet */ }
});
