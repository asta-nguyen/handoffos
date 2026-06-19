# M4 - Agent Templates

## Goal

Provide setup templates for agents that do not have first-class plugin support
or where a simple instruction file is enough.

The fallback should work everywhere:

```text
At session start: read .shared-context/latest.md
Before ending: run ctx copy
```

## Why Templates Matter

Not every agent supports plugins or MCP. A filesystem contract plus clear
instructions lets any coding agent participate in handoff without knowing
Handoff OS internals.

## Deliverables

### 1. Claude Code Template

Create:

```text
templates/claude/CLAUDE.md
```

Required behavior:

```markdown
At session start:
1. If `.shared-context/latest.md` exists, read it first.
2. Continue from the current goal and next steps.
3. Read `.shared-context/latest.diff` only if line-level detail is needed.

During work:
1. Record important decisions and blockers.
2. Keep context branch-scoped.
3. Do not store raw chat transcripts.

Before ending:
1. Run `ctx copy`.
2. If meaningful work happened, run `ctx commit-session -m "<summary>"`.
3. Tell the next agent to read `.shared-context/latest.md`.
```

### 2. Codex Template

Create:

```text
templates/codex/AGENTS.md
```

Required behavior:

```markdown
When starting:
- Read `.shared-context/latest.md` before exploring the repo.
- If no latest snapshot exists, run `ctx resume`.
- Respect repo/branch/task scope.

Before final response:
- If work changed context, run `ctx copy`.
- If the session should be persisted, run `ctx commit-session -m "<summary>"`.
- Do not save raw conversation transcripts.
```

### 3. Cursor Template

Create:

```text
templates/cursor/.cursorrules
```

Required behavior:

```markdown
When a new session starts, check `.shared-context/latest.md`.
Use it as the initial working context.
Use `.shared-context/latest.diff` only when exact line changes are needed.
Before ending a handoff-worthy session, run `ctx copy`.
```

### 4. Windsurf Template

Create:

```text
templates/windsurf/.windsurfrules
```

Use the same contract as Cursor, adjusted to Windsurf naming if needed.

### 5. Cline Template

Create:

```text
templates/cline/.clinerules
```

Required behavior:

```markdown
Always read `.shared-context/latest.md` first when it exists.
Do not scan unrelated memories from other branches.
Before stopping, write a fresh handoff snapshot with `ctx copy`.
```

### 6. Kilo Template

Create:

```text
templates/kilo/AGENTS.md
```

Required behavior:

```markdown
Use Handoff OS context if present.
Start with `.shared-context/latest.md`.
Use `ctx status --json` for current state.
Use `ctx copy` for handoff.
```

### 7. Generic Template

Create:

```text
templates/generic/AGENT_CONTEXT.md
```

Universal fallback:

```markdown
# Agent Context Rules

At session start:
1. If `.shared-context/latest.md` exists, read it first.
2. If `.shared-context/latest.json` exists and structured fields are needed, read it.
3. If `.shared-context/latest.diff` exists, read it only for exact line-level details.
4. Continue from the `Next` or `Next Steps` section.

Before ending:
1. Run `ctx copy` if available.
2. If `ctx copy` is unavailable, manually update `.shared-context/latest.md`.
3. Do not store raw chat transcripts.
```

## Optional: `ctx install-template`

Command:

```bash
ctx install-template claude
ctx install-template codex
ctx install-template cursor
ctx install-template windsurf
ctx install-template cline
ctx install-template kilo
ctx install-template generic
```

Behavior:

- Copy the matching template into the current repo.
- Do not overwrite existing files unless `--force` is passed.
- Print the installed path.

Examples:

```bash
ctx install-template claude
# writes ./CLAUDE.md

ctx install-template codex
# writes ./AGENTS.md

ctx install-template cursor
# writes ./.cursorrules
```

Expected files touched:

```text
packages/cli/src/commands/install-template.ts
packages/cli/src/commands/index.ts
templates/
```

## Documentation

Add:

```text
docs/AGENT_SETUP.md
```

Include:

- Which template to use for each agent.
- Manual copy instructions.
- `ctx install-template` instructions if implemented.
- How templates relate to MCP and plugins.
- Troubleshooting when the agent ignores instructions.

## Template Quality Rules

- Keep instructions short and direct.
- Mention exact files:
  - `.shared-context/latest.md`
  - `.shared-context/latest.diff`
  - `.shared-context/latest.json`
- Mention exact commands:
  - `ctx status --json`
  - `ctx resume`
  - `ctx copy`
  - `ctx commit-session -m "..."`
- Do not mention features not implemented yet unless clearly marked optional.
- Do not instruct agents to store raw transcripts.
- Do not instruct agents to read unrelated branches by default.

## Tests

If `ctx install-template` is implemented, test:

- installs each template to the correct filename
- refuses to overwrite existing files without `--force`
- overwrites with `--force`
- returns clear paths

Suggested test file:

```text
packages/cli/tests/install-template.test.ts
```

## Definition Of Done

- Templates exist for Claude, Codex, Cursor, Windsurf, Cline, Kilo, and generic agents.
- `docs/AGENT_SETUP.md` explains how to use them.
- Optional installer command works if implemented.
- Templates match current CLI behavior.
- No template encourages raw transcript storage.

## Out Of Scope

- Marketplace publishing.
- Agent-specific binary plugins.
- Automatic token pressure detection.
- Cloud sync.
