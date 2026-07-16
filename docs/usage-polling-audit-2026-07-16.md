# Usage Polling and Display Audit

**Date:** 2026-07-16

**Repository version inspected:** `0.1.1`, commit `daade54`

**Scope:** Read-only investigation of the missing usage limits, polling correctness, API compatibility, diagnostics, tests, and comparable GitHub implementations.

**Code changes made:** None. This report is the only artifact created.

## Executive verdict

The plugin is calling the correct endpoint with the correct authentication and beta header. A live probe on this machine returned HTTP 200 on 2026-07-16. The scheduled polling design is also mostly correct after the recent rate-limit hardening: it performs an immediate startup fetch, then polls every five minutes, preserves the last known good snapshot, honors numeric `Retry-After`, and exponentially backs off after HTTP 429.

However, the end-to-end usage path is currently broken by a response-schema mismatch. The live response returns `null` for several `extra_usage` fields when extra usage is disabled, while the Zod schema requires `monthly_limit`, `used_credits`, and `currency` to be non-null. That rejects the entire otherwise-valid response, so even the valid 5-hour and weekly buckets never reach the state store or display.

This is the direct reason no limits are visible.

There are also secondary polling and observability problems:

- The Refresh action can call the rate-limited endpoint every 10 seconds, bypassing the five-minute spacing policy.
- Refresh shows a success checkmark even when usage polling returns a schema, auth, network, or rate-limit failure.
- Concurrent startup, scheduled, wake, and manual requests are not coalesced into one in-flight request.
- Usage failures are written only to a custom, unbounded startup log instead of the Stream Deck SDK's rotating plugin logs.
- The endpoint has evolved to include a `limits[]` array for scoped weekly limits; current code ignores it.

## Confirmed root cause

### Evidence from this machine

| Observation | Result |
|---|---|
| Live OAuth usage probe | HTTP 200 |
| Credentials read | Successful |
| Automatic token refresh | Successful |
| Plugin connection to Stream Deck | Successful |
| Status polling | Fresh; last observed at 2026-07-16 04:47 UTC |
| Last successful usage snapshot | 2026-07-04 20:08:05 UTC |
| First schema failure | 2026-07-04 20:13:06 UTC, one poll later |
| Current usage polling | Repeats every five minutes and fails schema validation each time |
| Display consequence | The July 4 snapshot is more than 15 minutes old, so usage actions intentionally render an em dash |

The current schema error is:

```text
extra_usage.monthly_limit: expected number, received null
extra_usage.used_credits: expected number, received null
extra_usage.currency: expected string, received null
```

The live response metadata, inspected without recording account values, currently has this shape:

```text
five_hour: object
seven_day: object
seven_day_oauth_apps: null
seven_day_opus: null
seven_day_sonnet: null
seven_day_cowork: null
seven_day_omelette: null
extra_usage: object
  is_enabled: boolean
  monthly_limit: null
  used_credits: null
  utilization: null
  currency: null
limits: array[3]
spend: object
member_dashboard_available: boolean
```

The response also contains newer opaque top-level fields such as `nimbus_quill`, `cinder_cove`, and `amber_ladder`. Zod strips unknown fields, so those are not today's failure. They are evidence that this undocumented beta contract is still evolving.

### Failure path through the code

1. [`credentialsReader.ts`](../src/plugin/auth/credentialsReader.ts) correctly reads `~/.claude/.credentials.json` on Windows.
2. [`usageClient.ts`](../src/plugin/api/usageClient.ts) correctly sends `Authorization: Bearer ...` and `anthropic-beta: oauth-2025-04-20`.
3. [`types.ts`](../src/plugin/api/types.ts) defines `extra_usage.monthly_limit`, `used_credits`, and `currency` as required non-null values.
4. `UsageResponse.safeParse()` therefore rejects the entire HTTP 200 body.
5. [`usagePoller.ts`](../src/plugin/pollers/usagePoller.ts) correctly preserves the old snapshot on failure, but cannot update it.
6. [`index.ts`](../src/plugin/index.ts) classifies usage older than 15 minutes as very stale.
7. [`usageBucketAction.ts`](../src/plugin/actions/usageBucketAction.ts) and the renderer intentionally display `—` for very-stale data.

The stale display is therefore behaving as designed. The contract parser before it is the failing component.

## Is the polling approach correct?

### Scheduled usage polling

| Area | Assessment | Notes |
|---|---|---|
| Endpoint | Correct | `GET https://api.anthropic.com/api/oauth/usage` works live. |
| Authentication | Correct | Local Claude Code OAuth token is accepted after refresh. |
| Beta header | Correct | `oauth-2025-04-20` matches working GitHub implementations. |
| Initial fetch | Correct | An immediate poll runs after Stream Deck connects. |
| Base cadence | Good | Five minutes is conservative and the local log has had no 429 since 2026-07-01. |
| 429 handling | Good | Numeric `Retry-After` is honored; otherwise exponential backoff is used up to one hour. |
| Wake handling | Good | Wake-triggered usage refresh uses the five-minute spacing guard. |
| Cache behavior | Good | Failed requests do not overwrite the last known good snapshot. |
| HTTP-date `Retry-After` | Incomplete | The parser accepts only numeric seconds, although HTTP permits a date value. |
| In-flight deduplication | Missing | Multiple triggers can overlap and issue duplicate requests. |
| Jitter | Missing | Fixed cadence can synchronize clients; small random jitter is safer for a beta endpoint. |

The scheduled cadence is not the cause of today's blank display. The schema parser is.

### Manual Refresh action

The Refresh action is not currently aligned with the poller's rate-limit design.

- [`refreshAction.ts`](../src/plugin/actions/refreshAction.ts) allows another request after only 10 seconds.
- It calls `usagePoller.pollNow()` directly instead of the spacing-aware path.
- `pollNow()` returns a structured failure result rather than throwing for normal API failures.
- The action ignores that result and always calls `showOk()` unless JavaScript itself throws.
- A manual 429 does not reschedule the existing recurring timer from the manual request's completion time.

This means a user trying to recover missing values can unintentionally create more requests and still receive false success feedback.

### Status polling

Status polling is independent and working. It fetches the public Statuspage summary every 30 seconds with a 10-second timeout. Its `setInterval` could theoretically overlap if the fetch implementation exceeds the timeout, but under the current timeout that risk is low. The fresh status snapshot confirms that the plugin runtime, network stack, shared store, and Stream Deck connection are operating.

## GitHub comparison

GitHub was searched for the exact endpoint, beta header, response fields, polling code, and error handling. The most useful implementations are below. Links are pinned to the inspected commits where practical.

### 1. CCMeter

[`hmenzagh/CCMeter`](https://github.com/hmenzagh/CCMeter) is a recent Rust usage monitor. Its [OAuth usage implementation](https://github.com/hmenzagh/CCMeter/blob/e7328542c00ae8605d8111fdf1fa39a2bed23ec4/src/data/oauth.rs) provides several patterns worth adopting:

- `monthly_limit`, `used_credits`, and utilization are optional.
- Usage buckets and `extra_usage` are independently optional.
- It uses a randomized 5–10 minute poll interval.
- It tracks attempts, successes, 429s, last successful fetch, and the last error.
- It has an explicit `in_flight` guard to prevent overlapping calls.

Its history is directly relevant: commit `9edd0f25964c` fixed full-response deserialization failure caused by a nullable `resets_at`. This is the same failure class as the current plugin bug: an optional field invalidated otherwise-useful quota data.

### 2. Claude Usage Tracker

[`hamed-elfayome/Claude-Usage-Tracker`](https://github.com/hamed-elfayome/Claude-Usage-Tracker) is a mature macOS tracker. Its current [response parser](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/574eb3720c9b793ed9d1477861187f7c9c23b6e2/Claude%20Usage/Shared/Services/ClaudeAPIService.swift) extracts 5-hour and weekly sections independently instead of decoding one rigid all-or-nothing object.

Most importantly, its [2026-07-09 compatibility commit](https://github.com/hamed-elfayome/Claude-Usage-Tracker/commit/b5780ee2bc4a) says that legacy per-model `seven_day_*` fields had become null and per-model usage moved to `limits[]`. The parser now treats `limits[]` entries with `kind=weekly_scoped` as the source of truth and overlays them onto legacy fields.

That matches today's live response on this machine: the scoped Fable limit is present in `limits[]` while legacy per-model fields are null.

### 3. Claude Code Usage Monitor

[`CodeZeno/Claude-Code-Usage-Monitor`](https://github.com/CodeZeno/Claude-Code-Usage-Monitor) has a deliberately narrow [usage response model](https://github.com/CodeZeno/Claude-Code-Usage-Monitor/blob/9b299725c62f51aff82577a7ec634a5fd14a3bd9/src/poller.rs): only optional `five_hour` and `seven_day` buckets are decoded. Unrelated overage contract changes therefore cannot blank its core display.

This sacrifices extra fields but demonstrates useful fault containment: parse only what a consumer needs, or parse optional domains independently.

### 4. c-c-statusline

[`babarot/c-c-statusline`](https://github.com/babarot/c-c-statusline) uses an [optional TypeScript response shape](https://github.com/babarot/c-c-statusline/blob/e76ed06a0fbd7cae4abe0219f6afcc45cf218757/src/usage.ts), a 120-second file cache, a request timeout, and stale-cache fallback. Its individual `extra_usage` properties are optional.

The cache duration is more aggressive than this Stream Deck plugin should copy unchanged, but the tolerant model and stale fallback are good patterns.

### 5. ZeroLimit

[`0xtbug/zero-limit`](https://github.com/0xtbug/zero-limit) [parses each quota independently](https://github.com/0xtbug/zero-limit/blob/2f7f2e96903f1576af56620946ce7a67df5b9300/src/services/api/parsers/claude.parser.ts). It adds extra usage only when `extra.is_enabled` is true and the relevant utilization is numeric. A malformed or disabled overage section does not discard valid session and weekly limits.

### 6. allthingsclaude/bar

[`allthingsclaude/bar`](https://github.com/allthingsclaude/bar) has a small [usage client](https://github.com/allthingsclaude/bar/blob/c3386834628da397d50f95584bbc35b3472bc350/src/usage.js) that parses only 5-hour and seven-day buckets, caches them, and retries once after refreshing OAuth credentials on 401. Again, unrelated response additions cannot break core quota display.

### Caution: similar projects can share the same weakness

The inspected [`mhelbich/VS-Code-Claude-Usage` response types](https://github.com/mhelbich/VS-Code-Claude-Usage/blob/dd16f843315316647cbadd78738b54f717b08541/src/types.d.ts) also require non-null overage numbers. It may be vulnerable to the same disabled-extra-usage response. Similarity alone is not proof of correctness; live contract fixtures and fault isolation matter more.

### GitHub response example matching the live failure

This [Claude Code statusline guide](https://gist.github.com/thomaslty/72a86a5d539e8bca101ecc1528dc0948) documents the same endpoint and header and includes a response where disabled `extra_usage.monthly_limit` and `used_credits` are null. That public example independently matches the response observed locally.

## Test and fixture findings

All repository checks pass:

```text
npm test              152 tests passed across 15 files
npm run typecheck     passed
npm run lint          passed
npm run format:check  passed
```

Passing tests do not represent the live contract because the fixtures normalize disabled overage values:

| Fixture | `is_enabled` | `monthly_limit` | `used_credits` | `currency` |
|---|---:|---:|---:|---|
| `usage-empty.json` | false | `0` | `0` | `"USD"` |
| `usage-pro.json` | false | `0` | `0` | `"USD"` |
| Live response | false | `null` | `null` | `null` |

Missing regression coverage includes:

- Disabled `extra_usage` with null monetary and currency fields.
- A valid core response with malformed or changed optional sections.
- The newer `limits[]` structure and precedence over legacy scoped fields.
- A manual Refresh action that receives a normal structured poll failure.
- Concurrent manual/scheduled/wake triggers.
- HTTP-date form of `Retry-After`.

The fixture README currently says its schema matches the endpoint, but it no longer matches the disabled-extra-usage variant observed live.

## Recommended improvements for the next implementation session

No changes below were implemented as part of this audit.

### P0 — restore core usage safely

1. **Add a synthetic regression fixture based on the current response.** Preserve nullability and `limits[]`, but remove exact account values and identifiers.
2. **Model disabled extra usage correctly.** Prefer either nullable monetary/currency fields or a discriminated union keyed by `is_enabled`.
3. **Fault-isolate optional sections.** A change to overage or a scoped model must not discard valid `five_hour` and `seven_day` data.
4. **Keep strict validation for the core fields actually displayed.** Tolerant does not have to mean unvalidated.

Suggested acceptance criterion: a payload with valid 5-hour/weekly buckets and disabled/null extra usage updates the core keys and renders Extra as “Disabled”.

### P1 — support the current scoped-limit contract

1. Add an optional schema for `limits[]` entries: `kind`, `percent`, `resets_at`, `scope.model.id`, `scope.model.display_name`, and `is_active`.
2. Prefer `limits[]` for scoped weekly limits when a matching active entry exists; use legacy `seven_day_*` fields only as fallback.
3. Keep unknown model IDs/names non-fatal and observable in debug logs without logging the full response.
4. Decide separately which newly observed scoped models belong on v1 keys; parsing them safely does not require exposing every model as an action.

### P1 — make every trigger share one polling policy

1. Coalesce all usage requests behind one in-flight promise.
2. Make startup, scheduled, wake, and manual refresh use the same spacing and backoff state.
3. Replace the manual 10-second endpoint gate with a policy consistent with the endpoint cadence, while still allowing the status request to refresh immediately.
4. Return an explicit result to the Refresh action and call `showOk()` only if the intended refresh succeeded; call `showAlert()` on auth, schema, network, or 429 failure.
5. Consider rescheduling the next poll relative to the most recent completed attempt so manual success and scheduled backoff cannot drift apart.

### P1 — improve diagnosability on the device and in standard logs

1. Put `lastAttemptAt`, `lastSuccessAt`, `lastErrorKind`, `retryAt`, and auth state in observable diagnostics state.
2. Distinguish “no data yet”, “auth expired”, “rate limited”, “response changed”, and “network unavailable” instead of rendering every failure as only `—`.
3. Use the Stream Deck SDK logger for operational errors. Elgato's [official logging guide](https://docs.elgato.com/streamdeck/sdk/v1/guides/logging/) provides rotating files in the plugin's `logs` directory and recommends `streamDeck.logger` over `console`.
4. Keep the last-resort startup log only for pre-logger crashes, or add rotation. The current file is approximately 3.96 MB and 133,403 lines and grows without a bound.
5. Continue redacting tokens and avoid logging full live payloads or exact spend.

### P2 — harden the beta endpoint integration

1. Parse both numeric-seconds and HTTP-date forms of `Retry-After`.
2. Add small randomized jitter to recurring polls, following CCMeter's general approach.
3. Add a synthetic contract test that confirms unknown top-level fields do not fail parsing.
4. Add a partial-success result so core usage can update even if optional domains fail validation.
5. Consider a user-visible “last updated” or failure detail in the Property Inspector.

## Documentation drift found during the audit

- The README says “7 actions”, but the manifest currently defines 8, including Reset Countdown.
- The README says 135 tests; the current suite has 152.
- The README says endpoint override settings can change the URL and beta header, but [`index.ts`](../src/plugin/index.ts) currently hardcodes both and no inspected Property Inspector exposes those settings.
- The README correctly describes cookie fallback as planned for v1.1; no cookie fallback is implemented in the current code.
- `AGENTS.md` calls `docs/superpowers/specs/2026-05-17-ai-monitor-design.md` authoritative, but that file is absent from the checkout.

These inconsistencies did not cause the blank display, but they make future audits and releases less reliable.

## Final answer to the audit question

**Are we polling the correct information in the correct way?**

- **Correct information source:** Yes. The endpoint, bearer token source, and beta header are correct and verified live.
- **Scheduled polling policy:** Mostly yes. Five minutes plus 429 backoff is reasonable and is not causing the present failure.
- **Manual polling policy:** No. It bypasses the intended spacing/backoff behavior and reports false success.
- **Response handling:** No. The all-or-nothing schema is too rigid for an undocumented beta endpoint and currently rejects every valid usage response on this account.
- **Why nothing is shown:** The valid 5-hour and weekly data is discarded because disabled extra-usage fields are null. The old cache then becomes very stale and is intentionally rendered as `—`.

The highest-value next step is a small, test-first compatibility change that accepts the live disabled-extra-usage shape while preserving strict core validation, followed by `limits[]` support and unified request gating. That work should be done in a separate implementation session because this audit was explicitly report-only.

## Source list

- [Anthropic Help Center: Claude Code with Pro or Max plans](https://support.anthropic.com/en/articles/11145838-using-claude-code-with-your-max-plan) — confirms account usage is shared across Claude and Claude Code.
- [Elgato Stream Deck SDK logging guide](https://docs.elgato.com/streamdeck/sdk/v1/guides/logging/)
- [CCMeter OAuth usage code](https://github.com/hmenzagh/CCMeter/blob/e7328542c00ae8605d8111fdf1fa39a2bed23ec4/src/data/oauth.rs)
- [Claude Usage Tracker current parser](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/574eb3720c9b793ed9d1477861187f7c9c23b6e2/Claude%20Usage/Shared/Services/ClaudeAPIService.swift)
- [Claude Usage Tracker `limits[]` compatibility commit](https://github.com/hamed-elfayome/Claude-Usage-Tracker/commit/b5780ee2bc4a)
- [Claude Code Usage Monitor poller](https://github.com/CodeZeno/Claude-Code-Usage-Monitor/blob/9b299725c62f51aff82577a7ec634a5fd14a3bd9/src/poller.rs)
- [c-c-statusline usage client](https://github.com/babarot/c-c-statusline/blob/e76ed06a0fbd7cae4abe0219f6afcc45cf218757/src/usage.ts)
- [ZeroLimit Claude response parser](https://github.com/0xtbug/zero-limit/blob/2f7f2e96903f1576af56620946ce7a67df5b9300/src/services/api/parsers/claude.parser.ts)
- [allthingsclaude/bar usage client](https://github.com/allthingsclaude/bar/blob/c3386834628da397d50f95584bbc35b3472bc350/src/usage.js)
- [Public response example with disabled/null extra usage](https://gist.github.com/thomaslty/72a86a5d539e8bca101ecc1528dc0948)
