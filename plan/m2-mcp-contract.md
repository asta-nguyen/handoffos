# M2 - MCP Contract

## Goal

Expose the M1 CLI/core capabilities through a stable MCP server so MCP-capable
agents can save, read, and hand off context without manual shell commands.

## Why This Comes After M1

MCP tools should call the same core logic as CLI commands. If the CLI contract is
not stable first, the MCP layer will either duplicate behavior or expose an
unstable interface to agents.

## Deliverables

### 1. Add MCP Executable Binary

Add:

```text
packages/mcp-server/src/cli.ts
```

It should:

- Resolve the target database path from the current working directory:

```text
<cwd>/.shared-context/memory.db
```

- Start the stdio MCP server.
- Print errors to stderr only.
- Exit non-zero when startup fails.

Update `packages/mcp-server/package.json`:

```json
{
  "bin": {
    "handoff-os-mcp": "./dist/cli.js"
  }
}
```

Local command after build:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/mcp-server/dist/cli.js
```

Acceptance:

- MCP server starts from a target repo.
- Missing `.shared-context/memory.db` produces a helpful error telling the user
  to run `ctx init`.
- No unrelated stdout noise, because MCP stdio needs clean protocol output.

### 2. Add `copy_context`

Tool name:

```text
copy_context
```

Description:

```text
Generate context snapshot files for agent handoff.
```

Input:

```json
{
  "task": "optional task name"
}
```

Output:

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

Acceptance:

- Calls the same core snapshot function used by `ctx copy`.
- Writes the same three files.
- Returns structured JSON text suitable for agents to parse.
- Does not include raw markdown unless requested by a separate read tool.

### 3. Add `read_context`

Tool name:

```text
read_context
```

Description:

```text
Read the latest handoff context snapshot.
```

Input:

```json
{
  "format": "markdown"
}
```

Supported formats for M2:

- `markdown`
- `json`

Behavior:

- `markdown` returns `.shared-context/latest.md`.
- `json` returns `.shared-context/latest.json`.
- If no latest snapshot exists, return a helpful error telling the agent to call
  `copy_context` or `get_resume_pack`.

Acceptance:

- Reads only from `.shared-context/`.
- Does not regenerate context.
- Does not read `latest.diff` by default.

### 4. Add `commit_session`

Tool name:

```text
commit_session
```

Description:

```text
Save a session summary to the memory database.
```

Input:

```json
{
  "summary": "Implemented auth refresh token rotation",
  "task": "auth-refresh",
  "files_touched": ["src/auth.ts"]
}
```

Output:

```json
{
  "ok": true,
  "session_id": "ses_xxx",
  "repo": "app",
  "branch": "feat/auth-refresh",
  "files_touched": ["src/auth.ts"]
}
```

Acceptance:

- Saves a session record or summary memory through core.
- Defaults `files_touched` from git changed files when omitted.
- Fails clearly outside a git repo.

### 5. Keep Existing Memory Tools Stable

MCP tools to keep:

```text
save_memory
search_memory
get_resume_pack
pin_memory
invalidate_memory
supersede_memory
list_open_tasks
get_branch_context
```

Adjust where needed:

- Search defaults to current repo/branch when git context is available.
- Returned results are concise by default.
- Errors are readable by an agent.
- Stale detection can run before retrieval where appropriate.

### 6. Add `run_hygiene`

Tool name:

```text
run_hygiene
```

Description:

```text
Detect and mark stale memories for the current repo and branch.
```

Output:

```json
{
  "ok": true,
  "stale_count": 2,
  "stale_memories": [
    {
      "id": "mem_xxx",
      "title": "Old auth assumption",
      "type": "assumption"
    }
  ]
}
```

Acceptance:

- Uses lifecycle logic in core.
- Does not delete memories.
- Returns enough metadata for the agent to summarize.

## Agent Config Example

Local development config:

```json
{
  "mcpServers": {
    "handoff-os": {
      "command": "node",
      "args": [
        "/Users/nus/projects/Asta/handoff-os/packages/mcp-server/dist/cli.js"
      ]
    }
  }
}
```

Future packaged config:

```json
{
  "mcpServers": {
    "handoff-os": {
      "command": "handoff-os-mcp",
      "args": []
    }
  }
}
```

## Tests

Suggested test file:

```text
packages/mcp-server/tests/tools.test.ts
```

Test cases:

- Server creation initializes with a valid DB path.
- `copy_context` writes all three snapshot files.
- `read_context` reads markdown and json formats.
- `read_context` fails clearly when no snapshot exists.
- `commit_session` saves a session.
- `search_memory` scopes to repo/branch.
- `run_hygiene` marks stale memories without deleting records.

## Manual Smoke Test

```bash
pnpm build
cd /tmp/handoff-demo
node /Users/nus/projects/Asta/handoff-os/packages/mcp-server/dist/cli.js
```

Then from an MCP-capable agent:

```text
call copy_context
call read_context with format=markdown
call commit_session with summary="..."
```

## Definition Of Done

- MCP binary exists and starts.
- MCP stdio output is clean.
- `copy_context` uses the same snapshot contract as `ctx copy`.
- `read_context` returns latest context.
- `commit_session` saves structured session context.
- MCP docs include local config.
- `pnpm build` and `pnpm test` pass.

## Out Of Scope

- Publishing package to npm.
- Agent-specific plugin packaging.
- Dashboard or UI.
- Team/cloud MCP server.
