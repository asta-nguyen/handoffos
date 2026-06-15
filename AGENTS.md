# AGENTS.md

Repository instructions for AI coding agents working on Handoff OS.

## Project Overview

Handoff OS is a local-first, CLI-first shared context layer for AI coding agents. It stores structured memory, scoped to repo/branch/task, and generates agent-specific handoff packs so agents can resume work across tools without losing context.

This is a TypeScript monorepo using pnpm workspaces.

## Core Principles

1. Local-first always. Nothing leaves the user's machine in v1.
2. Structured over raw. Synthesize session transcripts into typed memory; never dump raw chat.
3. Memory hygiene matters. Every feature must consider staleness and confidence.
4. Tool-agnostic by design. Avoid vendor lock-in; support Claude, Codex, OpenCode, and generic adapters.
5. Progressive disclosure. Show summaries first, expand on demand.

## Repository Structure

```text
handoff-os/
├── packages/
│   ├── core/           # SQLite DB, memory CRUD, retrieval, handoff
│   ├── cli/            # CLI (ctx command) using cac
│   ├── mcp-server/     # MCP protocol server with 8 tools
│   ├── adapters/       # Agent-specific output formatters
│   └── shared/         # Zod schemas, types, ranking formula
├── drizzle.config.ts   # Drizzle ORM config
├── pnpm-workspace.yaml # Workspace definition
└── vitest.config.ts    # Vitest config (80% coverage threshold)
```

## Architecture

### Layer Flow

```text
Adapter Layer (CLI / MCP / File-based)
       ↓
Core Layer (engine.ts, lifecycle.ts, pack.ts)
       ↓
Storage Layer (better-sqlite3 → Drizzle ORM → SQLite)
       ↓
.shared-context/ (local workspace folder)
```

### Key Modules in `@handoff-os/core`

- `src/db/connection.ts` — SQLite connection factory, exports `createConnection(dbPath)`
- `src/db/schema.ts` — Drizzle schema: `memories`, `sessions`, `handoffLogs`
- `src/memory/engine.ts` — CRUD operations: create, get, search, listOpenTasks, getBranchContext
- `src/memory/lifecycle.ts` — pin, invalidate, supersede, detectStaleMemories
- `src/handoff/pack.ts` — `generateResumePack` + `formatForAgent`
- `src/git/context.ts` — reads branch, repo name, changed files, recent commits via git CLI
- `src/scope/resolve.ts` — scope context resolver

### Memory Lifecycle

```text
active → stale (7+ days) → archived
active → superseded → superseded_by linked
active → invalidated (user action)
```

### Ranking Formula

```text
final_score = scope_match*0.35 + semantic*0.25 + recency*0.15
            + confidence*0.10 + pinned*0.10 - stale*0.15
```

## Technical Conventions

- TypeScript strict mode: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`
- ES modules everywhere; use `.js` extensions in imports
- No classes; prefer plain functions and typed objects
- Validate external input with Zod at boundaries
- Prefer immutability
- Keep files under 400 lines when practical
- Throw early, handle at boundaries

## When Writing Code

- Use `packages/shared` for all Zod schemas and types shared across packages
- Use `packages/core` for all business logic; CLI and MCP are thin wrappers
- All DB access goes through `engine.ts` or `lifecycle.ts` in core
- Git context always goes through `git/context.ts`; do not call `execSync` directly elsewhere
- Tests live in `tests/` directories of each package, mirroring `src/`
- Before committing, `pnpm build && pnpm test` must pass

## When Making Changes

1. Determine which package(s) are affected.
2. If adding shared types, update `packages/shared/src/index.ts`.
3. If adding DB logic, update `packages/core/src/db/schema.ts` then `packages/core/src/memory/engine.ts`.
4. If adding a CLI command, update `packages/cli/src/commands/` and register it in `packages/cli/src/index.ts`.
5. If adding an MCP tool, update `packages/mcp-server/src/index.ts`.
6. If adding agent formatting, update `packages/core/src/handoff/pack.ts`.

## Package Dependencies

```text
cli ──→ core ──→ shared
mcp-server ──→ core ──→ shared
adapters ──→ core ──→ shared
```

Build order: `shared` → `core` → `cli`, `mcp-server`, `adapters`.

## Common Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm test:watch
pnpm test packages/core/tests/engine.test.ts
pnpm lint
cd packages/core && npx drizzle-kit generate
node packages/cli/dist/index.js init
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | All types, Zod schemas, ranking formula |
| `packages/core/src/db/schema.ts` | Drizzle ORM table definitions |
| `packages/core/src/memory/engine.ts` | Memory CRUD + search + ranking |
| `packages/core/src/memory/lifecycle.ts` | Pin, invalidate, supersede, stale detection |
| `packages/core/src/handoff/pack.ts` | Resume pack generation + formatting |
| `packages/core/src/git/context.ts` | Git metadata extraction |
| `packages/cli/src/commands/` | All CLI commands |
| `packages/mcp-server/src/index.ts` | MCP server with 8 tools |

## Testing

- Write tests alongside source in `tests/` directories
- Follow TDD: red → green → refactor
- Vitest coverage threshold is 80%+
- Favor unit tests for functions and integration tests for DB operations

## What Not To Do

- Do not add cloud sync or team features; v1 is local-only
- Do not add a UI/dashboard; CLI-first until proven
- Do not store full agent transcripts; synthesize structured memory instead
- Do not support non-coding use cases; focus on agent handoff
- Do not skip stale/memory-hygiene logic; it is the core differentiator

