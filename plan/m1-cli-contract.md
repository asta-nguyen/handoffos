# M1 - CLI Contract

## Goal

Make Handoff OS usable from a stable public CLI contract that scripts, MCP tools,
and future plugins can call without importing internal code.

The core user flow should work from any target git repo:

```text
ctx init
-> agent works
-> ctx copy
-> next agent reads .shared-context/latest.md
-> ctx commit-session
```

## Why This Comes First

Plugins need stable commands. If plugin work starts before CLI outputs and file
contracts are stable, each plugin will invent its own behavior and drift from the
core product.

## Deliverables

### 1. Add `ctx copy`

Command:

```bash
ctx copy
ctx copy --json
ctx copy --task "auth-refresh"
```

Behavior:

- Ensure `.shared-context/` exists or fail with a clear message telling the user
  to run `ctx init`.
- Generate a context snapshot from current git state and stored memories.
- Write these files:

```text
.shared-context/latest.md
.shared-context/latest.diff
.shared-context/latest.json
```

Human output:

```text
Context snapshot written:
- .shared-context/latest.md
- .shared-context/latest.diff
- .shared-context/latest.json
```

JSON output:

```json
{
  "ok": true,
  "files": {
    "markdown": ".shared-context/latest.md",
    "diff": ".shared-context/latest.diff",
    "json": ".shared-context/latest.json"
  },
  "generated_at": "2026-06-19T00:00:00.000Z"
}
```

Implementation notes:

- Put snapshot business logic in `packages/core/src/handoff/snapshot.ts`.
- CLI command should only parse options, call core, and format output.
- Avoid raw chat transcripts.
- Keep `latest.md` concise and suitable as first-read context.
- Put exact line-level code changes in `latest.diff`, not in `latest.md`.

Expected files touched:

```text
packages/core/src/handoff/snapshot.ts
packages/core/src/index.ts
packages/cli/src/commands/copy.ts
packages/cli/src/commands/index.ts
```

### 2. Define `latest.json` Schema

Minimum fields:

```json
{
  "goal": "string",
  "branch": "string",
  "repo": "string",
  "agent": "handoff-os",
  "done": ["string"],
  "in_progress": ["string"],
  "will_do": ["string"],
  "changes": ["string"],
  "removed": ["string"],
  "decisions": [
    {
      "title": "string",
      "content": "string"
    }
  ],
  "blockers": [
    {
      "title": "string",
      "content": "string"
    }
  ],
  "next_steps": ["string"],
  "generated_at": "ISO timestamp"
}
```

Rules:

- Keep the schema stable.
- Add optional fields instead of renaming fields.
- Keep field names snake_case to match existing shared types.
- If no data is available, use empty arrays and clear fallback strings.

### 3. Define `latest.md` Format

Recommended structure:

```markdown
# Handoff: <goal>

Branch: <branch> | Repo: <repo>

**Current:** <current in-progress item>

### Files changed
- <file>

### Removed
- `<old-file>` -> `<new-file>` - renamed

### Decisions
- <decision title>: <decision content>

### Blockers
- <blocker title>: <blocker content>

### Next
1. <next step>
```

Rules:

- New agent reads `latest.md` first.
- Keep it short enough to fit into prompt context without noise.
- Mention files and functions, not full file contents.
- Do not include raw diff hunks.
- Document deleted or renamed files so future agents do not chase stale imports.

### 4. Improve `ctx resume`

Current desired behavior:

```text
if .shared-context/latest.md exists:
  print latest.md
else:
  generate resume pack from memory.db
```

Commands:

```bash
ctx resume
ctx resume --for codex
ctx resume --for claude
ctx resume --for opencode
ctx resume --json
```

Acceptance:

- Works after `ctx copy`.
- Does not require the user to know where `latest.md` lives.
- Falls back to existing memory-based resume pack if no latest snapshot exists.
- `--json` returns structured metadata and content.

Expected files touched:

```text
packages/cli/src/commands/resume.ts
packages/core/src/handoff/pack.ts
```

### 5. Add `ctx status --json`

Command:

```bash
ctx status --json
```

Output:

```json
{
  "initialized": true,
  "repo": "handoff-os",
  "branch": "main",
  "changed_files": 3,
  "memories": {
    "total": 12,
    "active": 10,
    "stale": 2
  },
  "latest_snapshot": {
    "exists": true,
    "path": ".shared-context/latest.md",
    "generated_at": "2026-06-19T00:00:00.000Z"
  }
}
```

Acceptance:

- Valid JSON.
- No extra human text when `--json` is used.
- Clear `initialized: false` if `.shared-context/memory.db` is missing.
- Plugin-friendly and stable.

Expected files touched:

```text
packages/cli/src/commands/status.ts
```

### 6. Add `ctx commit-session --json`

Command:

```bash
ctx commit-session -m "Implemented auth refresh token rotation" --json
```

Output:

```json
{
  "ok": true,
  "summary": "Implemented auth refresh token rotation",
  "repo": "app",
  "branch": "feat/auth-refresh",
  "changed_files": ["src/auth.ts"],
  "memories_created": ["mem_xxx", "mem_yyy"],
  "handoff_pack": ".shared-context/handoffs/session-123.json"
}
```

Acceptance:

- Valid JSON.
- Returns IDs or paths needed by plugins.
- Human output remains readable without `--json`.

Expected files touched:

```text
packages/cli/src/commands/commit-session.ts
packages/core/src/memory/engine.ts
```

## Tests

Add focused tests for:

- `writeContextSnapshot()` creates all three files.
- `latest.md` includes goal, branch, repo, changed files, and next steps.
- `latest.diff` contains git diff or a clear fallback message.
- `latest.json` parses and contains required fields.
- Deleted and renamed files appear in `removed`.
- `ctx copy --json` emits valid JSON.
- `ctx status --json` emits valid JSON.
- `ctx resume` reads `latest.md` when present.
- Missing `.shared-context/` produces a clear error.
- Running outside a git repo fails clearly or uses a documented fallback.

Suggested test files:

```text
packages/core/tests/snapshot.test.ts
packages/cli/tests/copy.test.ts
packages/cli/tests/status.test.ts
packages/cli/tests/resume.test.ts
```

## Manual Smoke Test

From the Handoff OS repo:

```bash
pnpm build
```

In a temporary target repo:

```bash
mkdir /tmp/handoff-demo
cd /tmp/handoff-demo
git init
echo "hello" > demo.txt
git add demo.txt
git commit -m "initial demo"

node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
echo "change" >> demo.txt
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js copy
cat .shared-context/latest.md
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js status --json
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume
```

## Definition Of Done

- `pnpm build` passes.
- `pnpm test` passes.
- `ctx copy` writes all snapshot files.
- `ctx copy --json` is parseable.
- `ctx status --json` is parseable.
- `ctx resume` can read `latest.md`.
- Documentation is updated to show commands that actually work.

## Out Of Scope

- Agent plugin packaging.
- MCP packaging.
- Embeddings/vector search.
- UI/dashboard.
- Cloud sync.
