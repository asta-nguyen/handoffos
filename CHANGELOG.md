# Changelog

## 0.4.0 — M4: Agent Templates

- 7 agent templates: Claude, Codex, Cursor, Windsurf, Cline, Kilo, Generic
- `ctx install-template <agent> [--force]` command to install templates
- `docs/AGENT_SETUP.md` with install guide and troubleshooting

## 0.3.0 — M3: First Plugin

- OpenCode plugin with 5 slash commands: init, status, save, resume, compact
- `ctx copy [--json]` command for structured output
- `--json` flags on `status` and `commit-session` commands
- Smoke test script for plugin end-to-end validation

## 0.2.0 — M2: MCP Contract

- `handoff-os-mcp` binary with `bin` entrypoint
- `read_context` tool for reading `.shared-context/latest.*`
- Structured JSON outputs on `copy_context`, `commit_session`, `run_hygiene`
- 7 integration tests via MCP InMemoryTransport

## 0.1.0 — M1: CLI Contract

- `ctx init`, `status`, `copy`, `commit-session`, `resume` commands
- `.shared-context/` filesystem contract (latest.md, latest.diff, latest.json)
- Memory lifecycle (pin, invalidate, supersede, stale detection)
- Branch/task scoping with ranking formula
