# AI Monitor for Stream Deck

[![CI](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/ci.yml/badge.svg)](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/codeql.yml/badge.svg)](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/codeql.yml)
[![Trivy](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/trivy.yml/badge.svg)](https://github.com/VladoPortos/ai-monitor-streamdeck/actions/workflows/trivy.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/VladoPortos/ai-monitor-streamdeck/badge)](https://securityscorecards.dev/viewer/?uri=github.com/VladoPortos/ai-monitor-streamdeck)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Anthropic plan usage and service status on your Stream Deck — account-wide, with zero per-machine setup. Same data you see at `claude.ai/settings/usage`, glanceable on physical keys.

## Why

If you run Claude Code heavily across many environments (Windows host, multiple WSL distros, remote servers), you want to know:

- How much of the **5-hour session** is consumed and when it resets.
- How much of the **weekly limits** are consumed (all models / Sonnet / Claude Design) and when they reset.
- Whether you're incurring **overage spend** against your monthly cap.
- Whether Anthropic services are **healthy**.

This plugin shows all of that without leaving your desk.

## How it works

The plugin reuses the OAuth token Claude Code already keeps locally (`~/.claude/.credentials.json` on Windows/Linux, macOS Keychain on Mac) and polls Anthropic's account-wide usage endpoint:

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <token>
anthropic-beta: oauth-2025-04-20
```

Because the data is account-wide, **a single Stream Deck host sees usage from every machine using your account** — no agents, no per-machine instrumentation, no log scraping. When the token expires (401), the plugin runs `claude --init-only` to refresh it silently.

Service status comes from the public Statuspage feed at `https://status.claude.com/api/v2/summary.json`.

## What you get (7 actions)

| Action | Purpose |
|---|---|
| **Usage — Bucket** | One specific bar: 5h / Weekly / Sonnet / Opus / Claude Design |
| **Usage — Headline** | Auto-tracks the highest-utilization bucket; great as a "what should I care about?" key |
| **Usage — Extra (€/$)** | Monthly overage spend vs limit |
| **Status — Overall** | Single colored dot for overall Anthropic platform status |
| **Status — Component** | Same, scoped to one component (Claude Code, API, claude.ai, …) |
| **Refresh Now** | Manual force-poll (rate-limited to 1 / 10s) |
| **Open in Browser** | One-tap launch of `claude.ai/settings/usage` (URL configurable) |

Colors: green < 60% < amber < 80% < orange < 95% < red. Stale values get a `↻` overlay; unknown values show `—` (never fake numbers).

![Sample keys](docs/preview-grid.png)

## Trust posture

- **100% local.** The plugin never phones home. The only outbound requests are to `api.anthropic.com`, `claude.ai`, and `status.claude.com`.
- **Source open under Apache 2.0.** Audit anytime.
- **Endpoint transparency:** every network call is listed below.

| URL | Purpose | Auth |
|---|---|---|
| `https://api.anthropic.com/api/oauth/usage` | Primary usage data | OAuth bearer from local Claude Code creds |
| `https://claude.ai/api/organizations/{id}/usage` | Fallback if primary fails | Browser session cookie (planned for v1.1) |
| `https://status.claude.com/api/v2/summary.json` | Service status | None |

## Install

**Prerequisites:** Stream Deck 6.5+, Claude Code already installed and authenticated (`claude --version` works and you've logged in).

### From release

1. Download `com.vladoportos.aimonitor.streamDeckPlugin` from the latest [Release](https://github.com/VladoPortos/ai-monitor-streamdeck/releases).
2. Double-click the file — Stream Deck will install it.
3. Drag any action onto a key. The first poll happens within ~10s.

### Build from source

```bash
git clone https://github.com/VladoPortos/ai-monitor-streamdeck.git
cd ai-monitor-streamdeck
npm install
npm run build       # bundle plugin.js
node scripts/pack.mjs   # produce the .streamDeckPlugin file
```

## Configuration

Each action has a small Property Inspector form (gear icon in the Stream Deck app):

- **Usage Bucket** — pick which bar (5h / weekly / Sonnet / Opus / Claude Design)
- **Headline** — check buckets to exclude from auto-selection
- **Status Component** — pick which service
- **Open in Browser** — set custom URL + label

No API keys, no cookies — everything pulled from your local Claude Code install.

## Endpoint resilience (beta-API caveat)

The OAuth usage endpoint is currently a beta surface (`anthropic-beta: oauth-2025-04-20`). It may change without notice. Defenses:

1. **Stale-badge protocol** — when the endpoint stops returning expected data, keys show last-known-good values with a `↻` overlay (never fake new numbers).
2. **Endpoint override** — settings let you change the URL and beta header without code edits.
3. **Cookie fallback** (v1.1) — falls back to the equivalent endpoint on `claude.ai`.

## Development

```bash
npm test               # 135 unit tests across 15 files
npm run typecheck      # strict TS, no any
npm run build          # tsup bundle
npm run pack           # full .streamDeckPlugin package
npx tsx scripts/render-samples.ts   # regenerate preview/ PNGs for visual QA
python probe_usage.py  # one-shot probe to confirm the endpoint works on your machine
```

Architecture summary: data flows from a 60-second poller (`src/plugin/pollers/usagePoller.ts`) into an observable in-memory store (`src/plugin/state/store.ts`); each registered action re-renders on store change via the shared base class (`src/plugin/actions/baseRendering.ts`). The renderer (`src/plugin/render/`) builds satori element trees, which `sharp` rasterizes to base64 PNG for `streamDeck.action.setImage()`. Auth refresh and HTTP layers are independently mockable for tests.

## Status

**v0.1.0 — pre-release.** Full code path implemented, 135 unit tests green, rendering verified, plugin packages cleanly. Pending: install on real hardware and visual verification across actions. PRs and bug reports welcome.

## License

Apache 2.0. See `LICENSE`.
