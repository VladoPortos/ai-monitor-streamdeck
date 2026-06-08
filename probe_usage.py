"""
Probe Anthropic's OAuth usage endpoint with the local Claude Code token.

Reads:  ~/.claude/.credentials.json
Calls:  GET https://api.anthropic.com/api/oauth/usage
Prints: response JSON (token is never printed in full)
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

CREDS_PATH = Path.home() / ".claude" / ".credentials.json"
ENDPOINT = "https://api.anthropic.com/api/oauth/usage"
BETA_HEADER = "oauth-2025-04-20"


def redact(token: str) -> str:
    return f"{token[:8]}...{token[-4:]} (len={len(token)})" if token else "<empty>"


def main() -> int:
    if not CREDS_PATH.exists():
        print(f"credentials file not found at {CREDS_PATH}", file=sys.stderr)
        return 2

    with CREDS_PATH.open("r", encoding="utf-8") as f:
        creds = json.load(f)

    try:
        token = creds["claudeAiOauth"]["accessToken"]
    except (KeyError, TypeError):
        print(f"claudeAiOauth.accessToken not found. Top-level keys: {list(creds.keys())}", file=sys.stderr)
        return 2

    print(f"token: {redact(token)}")
    print(f"GET {ENDPOINT}")

    req = urllib.request.Request(
        ENDPOINT,
        headers={
            "Authorization": f"Bearer {token}",
            "anthropic-beta": BETA_HEADER,
            "User-Agent": "ai-monitor-streamdeck-probe/0.1",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}")
        print(body)
        return 1
    except Exception as e:
        print(f"request failed: {e}", file=sys.stderr)
        return 1

    print(f"HTTP {status}")
    try:
        parsed = json.loads(body)
        print(json.dumps(parsed, indent=2))
    except json.JSONDecodeError:
        print(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
