# Test Fixtures

Synthetic JSON payloads matching the shapes documented in
[`../../docs/superpowers/specs/2026-05-17-ai-monitor-design.md`](../../docs/superpowers/specs/2026-05-17-ai-monitor-design.md) §5.

## Usage endpoint fixtures

| File | Scenario |
|---|---|
| `usage-max20x-idle.json` | Max 20x plan, low utilization (< 10% on all bars) |
| `usage-max20x-warning.json` | Max 20x plan, 78% weekly — amber band |
| `usage-max20x-critical.json` | Max 20x plan, 96% weekly — red band, with extra-usage in play |
| `usage-pro.json` | Pro plan — `seven_day_opus` separate bucket |
| `usage-empty.json` | Brand-new account, all zeros |

Schema matches `GET https://api.anthropic.com/api/oauth/usage` per spec §5.1.

All values are **synthetic** — no real account data committed. Replace `<REDACTED>` placeholders if a fixture ever needs to be regenerated from a real capture, after stripping account UUIDs, emails, and exact spend amounts.

## Status endpoint fixtures

| File | Scenario |
|---|---|
| `status-summary-operational.json` | All components green |
| `status-summary-degraded.json` | Claude API degraded, others green |
| `status-summary-incident.json` | Major outage with active incident text |
| `status-summary-maintenance.json` | Scheduled maintenance in progress |

Schema matches `GET https://status.claude.com/api/v2/summary.json`. Status data is public — no PII concerns.
