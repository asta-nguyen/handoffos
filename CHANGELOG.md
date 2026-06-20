# Changelog

Keep a Changelog + SemVer.

## [Unreleased]

## [0.3.0] — 2026-06-20

**M3: First Plugin** — Refactored OpenCode plugin using only public CLI commands.

### Added
- `plugins/opencode/handoff.ts` — 5 commands (`/init`, `/status`, `/copy`, `/resume`, `/commit`)
- No direct core imports or DB writes — plugin uses `ctx --json` outputs exclusively
- Auto-saves snapshot on token pressure
- `plugins/opencode/README.md` — install, config, workflow guide
- `scripts/smoke-plugin-flow.sh` — end-to-end CLI flow verification

## [0.2.0] — 2026-06-20

**M2: MCP Contract** — `handoff-os-mcp` binary exposing 12 Handoff OS tools via MCP.

### Added
- `handoff-os-mcp` binary — MCP server entrypoint, resolves `.shared-context/memory.db`
- `read_context` tool — reads snapshot files from `.shared-context/`
- 3 tools now return structured JSON: `copy_context`, `commit_session`, `run_hygiene`
- 7 integration tests (49 total across all packages)

## [0.1.0] — 2026-06-20

**M1: CLI Contract** — `.shared-context/latest.{md,diff,json}` is the universal handoff entrypoint.

### Added
- `ctx copy [--task X] [--json]` — writes 3 snapshot files
- `ctx resume [--for <agent>] [--json]` — reads latest.md, falls back to memory pack
- `ctx status --json` — initialized/repo/branch/changed_files/memories/latest_snapshot
- `ctx commit-session --json` — ok/summary/repo/branch/memories_created/handoff_pack
- `task?` field in `latest.json` (additive)
- 42 tests (87% stmts, 74% branches, 92% funcs, 90% lines)

### Changed
- root `package.json`: added `@handoff-os/cli` workspace dep so `node_modules/.bin/ctx` exists

### Install
- Direct: `node /home/giogio/Project/handoffos/packages/cli/dist/index.js <cmd>`
- Wrapper: `~/.local/bin/ctx` (calls absolute path; pnpm bin shim breaks under symlink)
