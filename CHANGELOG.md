# Changelog

Keep a Changelog + SemVer.

## [Unreleased]
- M2: MCP server (8 tools)
- M3: Plugin (auto-inject context)
- M4: Agent templates (Claude/Codex/OpenCode)

## [0.1.0] - 2026-06-20

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
