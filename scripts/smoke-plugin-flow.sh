#!/usr/bin/env bash
set -euo pipefail

# Smoke test: Plugin flow via public CLI
# Simulates what the OpenCode plugin does for each command.
#
# Override CTX_COMMAND for a custom binary path:
#   CTX_COMMAND="node /path/to/packages/cli/dist/index.js" ./scripts/smoke-plugin-flow.sh

CTX="${CTX_COMMAND:-ctx}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "=== Plugin smoke flow ==="
echo "WORKDIR: $WORKDIR"
echo "CTX: $CTX"
echo ""

cd "$WORKDIR"
git init -q && git add . && git commit -q --allow-empty -m "init"

# 1. /init
echo "--- /init ---"
$CTX init
test -d .shared-context || { echo "FAIL: .shared-context not created"; exit 1; }
echo ""

# 2. /status (--json)
echo "--- /status ---"
STATUS=$($CTX status --json)
echo "$STATUS"
echo "$STATUS" | jq -e '.initialized == true' > /dev/null || { echo "FAIL: not initialized"; exit 1; }
echo "$STATUS" | jq -e '.repo' > /dev/null || { echo "FAIL: missing repo"; exit 1; }
echo "$STATUS" | jq -e '.branch' > /dev/null || { echo "FAIL: missing branch"; exit 1; }
echo ""

# 3. /copy (--json)
echo "--- /copy ---"
SNAP=$($CTX copy --json)
echo "$SNAP"
echo "$SNAP" | jq -e '.ok == true' > /dev/null || { echo "FAIL: copy not ok"; exit 1; }
test -f .shared-context/latest.md || { echo "FAIL: latest.md missing"; exit 1; }
test -f .shared-context/latest.diff || { echo "FAIL: latest.diff missing"; exit 1; }
test -f .shared-context/latest.json || { echo "FAIL: latest.json missing"; exit 1; }
echo ""

# 4. /resume
echo "--- /resume ---"
$CTX resume || { echo "FAIL: resume failed"; exit 1; }
test -f .shared-context/latest.md || { echo "FAIL: no latest.md for resume"; exit 1; }
echo ""

# 5. /commit (--json)
echo "--- /commit ---"
CS=$($CTX commit-session -m "Smoke plugin flow" --json)
echo "$CS"
echo "$CS" | jq -e '.ok == true' > /dev/null || { echo "FAIL: commit-session not ok"; exit 1; }
echo ""

echo "=== All plugin commands passed ==="
