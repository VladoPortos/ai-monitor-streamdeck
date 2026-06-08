# Security Policy

## Supported versions

The latest release on the `main` branch is the only version that receives
security updates. Older tags are unmaintained.

## Reporting a vulnerability

**Please do not file public GitHub issues for security-sensitive reports.**

Use GitHub's **"Report a security vulnerability"** feature on the
[Security tab](https://github.com/VladoPortos/ai-monitor-streamdeck/security/advisories/new)
to open a private advisory. This sends the report only to the maintainers.

When reporting, please include:
- A clear description of the issue
- Steps to reproduce, or a proof of concept
- The version (commit SHA) you tested against
- Your assessment of impact and severity

## What this plugin handles that's worth knowing about

The plugin reads your Claude Code OAuth access token from
`~/.claude/.credentials.json` (Windows / Linux) or the macOS Keychain entry
`Claude Code-credentials`. It uses that token to call:

- `https://api.anthropic.com/api/oauth/usage` (primary usage data)
- `https://claude.ai/api/organizations/{orgId}/usage` (fallback)
- `https://status.claude.com/api/v2/summary.json` (service status, no auth)

The token never leaves your machine except in the `Authorization: Bearer`
header sent to those Anthropic endpoints. There is no telemetry, no
third-party analytics, no remote logging.

Vulnerabilities of particular interest:
- Anything that causes the token to be written to disk in cleartext outside
  the locations Claude Code already uses
- Anything that sends the token to a host other than the three listed above
- Anything that could read the token from outside the plugin's process
- Path-traversal in the `Open in Browser` action's user-provided URL
- Anything that lets a Property Inspector page (HTML) escape its sandbox

## Response expectations

We aim to:
- Acknowledge new reports within **7 days**
- Provide a fix, mitigation, or a clear timeline within **30 days**
- Coordinate disclosure timing with the reporter
