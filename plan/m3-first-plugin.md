# M3 - First Plugin

## Goal

Ship the first real agent plugin or plugin-like integration that uses the public
CLI/MCP contracts instead of internal code.

The first plugin proves the product UX:

```text
/copy
-> writes .shared-context/latest.md

/resume
-> reads .shared-context/latest.md
-> agent continues from Next Steps
```

## Plugin Strategy

Start with the simplest agent environment that supports custom commands cleanly.
If OpenCode plugin support is straightforward, use OpenCode first. If not, build
a generic command-template plugin first and keep the same command contract.

## Deliverables

### 1. Plugin Directory

Create:

```text
plugins/
  opencode/
    plugin.json
    commands/
      init.md
      status.md
      copy.md
      resume.md
      commit.md
    README.md
```

If OpenCode format needs a different shape, keep the same conceptual commands
and document the actual format.

### 2. Plugin Configuration

The plugin must call public commands only.

Default command:

```bash
ctx
```

Local development override:

```json
{
  "ctxCommand": "node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js"
}
```

Rules:

- No imports from `packages/core`.
- No direct DB writes.
- No custom snapshot generation.
- Prefer `--json` when parsing command output.
- Human-facing command responses should be short.

### 3. `/init`

Purpose:

```text
Initialize Handoff OS in the current repository.
```

Behavior:

1. Run:

```bash
ctx init
```

2. Confirm `.shared-context/` exists.
3. Tell the user to run `/status`.

Acceptance:

- Safe to run multiple times.
- Does not overwrite existing snapshots unnecessarily.
- Reports failure clearly.

### 4. `/status`

Purpose:

```text
Show current handoff state.
```

Behavior:

1. Run:

```bash
ctx status --json
```

2. Summarize:

- initialized or not
- repo
- branch
- changed file count
- memory counts
- whether `latest.md` exists

Example agent response:

```text
Handoff OS is initialized.
Repo: app
Branch: feat/auth-refresh
Changed files: 3
Memories: 12 total, 10 active, 2 stale
Latest snapshot: .shared-context/latest.md
```

Acceptance:

- Uses JSON output only.
- If not initialized, tells user to run `/init`.

### 5. `/copy`

Purpose:

```text
Write the current handoff snapshot.
```

Behavior:

1. Run:

```bash
ctx copy --json
```

2. Report files written.
3. Optionally remind next agent to read `.shared-context/latest.md`.

Acceptance:

- Creates or updates `latest.md`, `latest.diff`, and `latest.json`.
- Does not paste the full snapshot into chat unless the user asks.
- Fails clearly if not initialized.

### 6. `/resume`

Purpose:

```text
Read context and continue work.
```

Behavior:

1. Prefer:

```bash
ctx resume
```

2. If direct file reading is easier, read:

```text
.shared-context/latest.md
```

3. Continue from the `Next` or `Next Steps` section.
4. Read `latest.diff` only if line-level details are needed.

Acceptance:

- Does not scan the whole repo before reading handoff context.
- Does not treat stale branch context as current.
- Calls out blockers if the snapshot has any.

### 7. `/commit`

Purpose:

```text
Save session summary and optionally refresh snapshot.
```

Behavior:

1. Agent summarizes current work in one sentence.
2. Run:

```bash
ctx commit-session -m "<summary>" --json
```

3. Run:

```bash
ctx copy --json
```

4. Report session saved and snapshot updated.

Acceptance:

- Summary is concise and action-oriented.
- Does not create a git commit unless a separate explicit command is added.
- Snapshot is refreshed after session commit.

## Plugin README

Include:

- What the plugin does.
- Requirements.
- Local installation.
- How to configure `ctxCommand`.
- Command list.
- Expected workflow.
- Troubleshooting.

Minimum workflow doc:

```text
Start:
  /resume

During work:
  /status

Before switching agents or ending:
  /copy
  /commit
```

## Smoke Script

Add:

```text
scripts/smoke-plugin-flow.sh
```

It should simulate the public contract:

```bash
ctx init
ctx status --json
ctx copy --json
ctx resume
ctx commit-session -m "Smoke plugin flow" --json
```

If `ctx` is not globally installed, allow:

```bash
CTX_COMMAND="node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js" scripts/smoke-plugin-flow.sh
```

## Tests

If plugin commands are static markdown templates, test the public contract instead:

- CLI command used by plugin exists.
- JSON outputs parse.
- Smoke script passes.

If plugin runtime code exists, add tests for:

- command construction
- JSON parsing
- error handling

## Definition Of Done

- First plugin directory exists.
- Plugin has `/init`, `/status`, `/copy`, `/resume`, and `/commit`.
- Plugin uses only public CLI/MCP contracts.
- README explains local setup.
- Smoke script demonstrates the plugin flow.
- No duplicated snapshot or memory logic in plugin files.

## Out Of Scope

- Supporting every agent.
- Auto-detecting token pressure.
- Publishing to any marketplace.
- Building a dashboard.
