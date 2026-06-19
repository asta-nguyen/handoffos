# Handoff OS Usage Guide

This guide explains how to use the project from a local checkout today, what the main workflows are, and which parts are still product direction rather than fully wired CLI behavior.

## Current Status

Handoff OS is currently a TypeScript monorepo with these usable surfaces:

- CLI package: `@handoff-os/cli`, exposed as the `ctx` binary after build.
- Core package: SQLite-backed memory CRUD, search, branch-aware context, handoff pack generation, and lifecycle helpers.
- MCP server package: tool definitions for MCP-compatible agents, but the current checkout does not expose a published `npx @handoff-os/mcp-server` binary.
- Adapter package: formatter wrappers for Claude, Codex, OpenCode, and generic handoff text.

The project is local-first. It stores data inside the target repository under `.shared-context/`.

Important distinction:

- The current local CLI workflow works through `ctx init`, `ctx commit-session`, `ctx resume`, `ctx handoff`, `ctx search`, and memory lifecycle commands.
- The filesystem snapshot workflow described in product docs, with `.shared-context/latest.md`, `.shared-context/latest.diff`, and `.shared-context/latest.json`, belongs to the context-snapshot feature direction. Use it after that feature branch is merged or wired into CLI/MCP.

## Requirements

- Node.js 20 or newer.
- pnpm 10.x, matching the repo `packageManager`.
- Git, because branch-aware features read the current repository branch and changed files.
- A target project that is a git repository.

Check versions:

```bash
node --version
pnpm --version
git --version
```

Install dependencies from the Handoff OS repo root:

```bash
cd /Users/nus/projects/Asta/handoff-os
pnpm install
```

Build all packages:

```bash
pnpm build
```

After build, the CLI entrypoint is:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js
```

For shorter local testing, create a shell alias:

```bash
alias ctx-local='node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js'
```

When this guide shows the full `node .../dist/index.js` command, you can replace
that prefix with `ctx-local` if you created the alias.

## Mental Model

Handoff OS stores structured memories, not raw chat logs.

Each memory has:

- `type`: `fact`, `decision`, `task`, `blocker`, `summary`, `repo_map`, or `assumption`.
- `scope`: workspace, repo, branch, and optionally task.
- `source`: where the memory came from, such as a session commit or manual MCP save.
- lifecycle state: `active`, `stale`, `superseded`, `invalidated`, or `archived`.
- confidence and pinning metadata for ranking.

The normal flow is:

```text
initialize target repo
  -> work with an agent
  -> save a structured session summary
  -> resume later or hand off to another agent
  -> search or manage memories when needed
```

The database lives in the target repo:

```text
.shared-context/
  memory.db
  config.json
  sessions/
  handoffs/
  decisions/
  tasks/
  snapshots/
```

## First Run In A Target Project

Build Handoff OS first:

```bash
cd /Users/nus/projects/Asta/handoff-os
pnpm install
pnpm build
```

Move to the project where you want shared agent context:

```bash
cd /path/to/your-project
git status
```

Initialize Handoff OS storage:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
```

Expected result:

- `.shared-context/` is created.
- `.shared-context/config.json` is written.
- `.shared-context/memory.db` is created and initialized.
- The command prints current repo and branch when run inside a git repo.

Check status:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js status
```

You should see:

- current branch
- repo name
- number of changed files
- total, active, and stale memory counts

## Basic CLI Commands

Show help:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js --help
```

Initialize context storage:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
```

Show current workspace status:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js status
```

Save current session as structured memory:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js commit-session -m "Implemented auth refresh token rotation"
```

Generate resume context for the next agent:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume
```

Generate resume context for a specific agent:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume --for codex
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume --for claude
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume --for opencode
```

Generate a handoff pack and write it to `.shared-context/handoffs/`:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js handoff --for claude -o handoff.md
```

Search memories:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "auth refresh"
```

Filter search by type:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "token" --type decision
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "blocked" --type blocker
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "todo" --type task
```

Filter search by status:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "auth" --status active
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "old approach" --status stale
```

List open tasks:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js tasks
```

Show branch-scoped context:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js branch-context
```

Pin an important memory:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js pin mem_xxxxx
```

Invalidate a wrong memory:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js invalidate mem_xxxxx
```

Supersede an outdated memory:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js supersede mem_old --with mem_new
```

## End-To-End CLI Workflow

Example: you are working on an auth bug in a target repo.

Initialize once:

```bash
cd /path/to/app
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
```

Do the coding work as usual.

At the end of the session, save a summary:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js commit-session -m "Investigated auth refresh failures and updated token rotation logic"
```

This creates memories:

- a `summary` memory for the session
- a `fact` memory listing changed files when git has changed files
- a generic handoff pack JSON under `.shared-context/handoffs/`

Later, resume:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume --for codex
```

Paste or feed the output into the next agent.

If the next agent needs a file:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js handoff --for claude -o handoff.md
```

Then read:

```bash
cat .shared-context/handoffs/handoff.md
```

## Recommended Agent Instructions

Until automatic hooks are wired, put this in your agent instructions for the target repo:

```markdown
When starting work:
1. Run `ctx status` or ask the user for Handoff OS context.
2. If available, run `ctx resume --for <agent>` and read the output.
3. Use branch-scoped context only; do not import memories from unrelated branches unless asked.

During work:
1. Save important decisions as structured memories through MCP if available.
2. Mention blockers explicitly so they can be saved.
3. Keep summaries concise and action-oriented.

Before ending:
1. Run `ctx commit-session -m "<short session summary>"`.
2. If handing off to another tool, run `ctx handoff --for <agent> -o handoff.md`.
3. Tell the next agent to read `.shared-context/handoffs/handoff.md`.
```

If you use the local binary directly instead of `ctx`, replace `ctx` with:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js
```

## MCP Usage

The MCP server code defines tools for agents that support MCP:

- `save_memory`
- `search_memory`
- `get_resume_pack`
- `pin_memory`
- `invalidate_memory`
- `supersede_memory`
- `list_open_tasks`
- `get_branch_context`

Current caveat:

- The package currently does not expose a `bin` entrypoint in `packages/mcp-server/package.json`.
- The README's published `npx -y @handoff-os/mcp-server` flow is the intended packaging direction, not a guaranteed local command in this checkout.

To make MCP easy to run locally, the project should add a small executable entrypoint that calls `startMcpServer(dbPath)` and wire it through `bin`. Until then, use the CLI for the reliable local workflow.

## Filesystem Snapshot Workflow

The product direction is to make the filesystem the universal handoff contract:

```text
.shared-context/
  latest.md
  latest.diff
  latest.json
```

How that workflow should work:

1. At the exit moment, the current agent writes `latest.md`, `latest.diff`, and `latest.json`.
2. The next agent reads `latest.md` first.
3. The next agent reads `latest.diff` only if it needs line-level details.
4. Scripts or MCP tools read `latest.json` when structured fields are needed.

In the current `main` checkout, this is not fully exposed as a CLI command. After the context snapshot feature is merged, expected usage should look like:

```bash
ctx copy
cat .shared-context/latest.md
```

or through MCP:

```text
copy_context
```

Until that is available, use:

```bash
ctx commit-session -m "..."
ctx handoff --for codex -o handoff.md
```

## Memory Types

Use these memory types consistently:

| Type | Use for |
|------|---------|
| `fact` | Stable facts about the repo, implementation, APIs, or files. |
| `decision` | Technical decisions plus rationale. |
| `task` | Work items, active tasks, and next steps. |
| `blocker` | Anything preventing progress. |
| `summary` | Session-level summaries. |
| `repo_map` | Notes about codebase structure. |
| `assumption` | Temporary beliefs that may later be validated or invalidated. |

Good examples:

```text
decision: Use better-sqlite3 for local storage
content: Chosen because v1 is local-first and needs a synchronous embedded DB with no daemon.
```

```text
blocker: MCP package lacks executable bin
content: The MCP server exports startMcpServer(), but package.json does not expose a runnable binary yet.
```

```text
task: [todo] Add ctx copy command
content: Wire writeContextSnapshot() into CLI and document latest.md/latest.diff/latest.json output.
```

## Scope Rules

Handoff OS ranks memories based partly on scope. Prefer narrow scope:

- workspace: normally `main`
- repo: current repository name
- branch: current git branch
- task: optional task name

Good:

```text
repo=handoff-os
branch=feature/context-snapshot-filesystem-contract
task=context-snapshot
```

Risky:

```text
repo omitted
branch omitted
task omitted
```

Broad memories can leak irrelevant context into later work. Use broad scope only for stable repo-level facts.

## Troubleshooting

### `Database not initialized. Call createConnection() first.`

Run `init` in the target repo first:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
```

Also make sure you run later commands from the same target repo root, or at least from a directory where `.shared-context/memory.db` is discoverable by the current CLI behavior.

### `Cannot find module ... dist/index.js`

Build the repo:

```bash
cd /Users/nus/projects/Asta/handoff-os
pnpm build
```

### Git branch information is missing

Run commands inside a git repository:

```bash
git rev-parse --show-toplevel
git branch --show-current
```

### `ctx` command not found

This repo is not globally installed. Use the direct Node path:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js status
```

Or create a local alias:

```bash
alias ctx-local='node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js'
```

### Search returns no memories

Check that you have committed a session first:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js commit-session -m "Initial context"
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "Initial"
```

Also check branch scope. Memories saved on one branch may not appear in branch-specific context for another branch.

### Handoff output is too thin

The current CLI `commit-session` mostly saves a summary and changed files. For richer output, save more structured memories during work through MCP or extend the CLI with explicit `save-memory` commands.

Recommended future improvements:

- Add `ctx save-memory`.
- Add `ctx copy`.
- Add MCP binary entrypoint.
- Add tests for snapshot generation and CLI command behavior.

## Development Commands

From the Handoff OS repo root:

```bash
pnpm install
pnpm build
pnpm test
pnpm test:watch
pnpm lint
```

Run one package build:

```bash
cd packages/core
pnpm build
```

Run the built CLI from any target repo:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js status
```

## Practical Demo

Use this demo in a temporary git repo:

```bash
mkdir /tmp/handoff-demo
cd /tmp/handoff-demo
git init
echo "hello" > app.txt
git add app.txt
git commit -m "initial demo"
```

Initialize Handoff OS:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js init
```

Make a change:

```bash
echo "next change" >> app.txt
```

Save session:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js commit-session -m "Updated demo app text"
```

Resume:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js resume --for codex
```

Search:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js search "demo"
```

Create handoff file:

```bash
node /Users/nus/projects/Asta/handoff-os/packages/cli/dist/index.js handoff --for claude -o handoff.md
cat .shared-context/handoffs/handoff.md
```

## What To Document Next

The next documentation pass should be done after implementation catches up with the product direction:

- `ctx copy` usage and exact output format.
- MCP local configuration with a real executable package bin.
- Agent-specific setup files for Claude Code, Codex, OpenCode, Cursor, Cline, and Windsurf.
- Examples of automatic memory capture during agent work.
- Exact schema for `latest.json`.
- Migration notes for `.shared-context/` format changes.
