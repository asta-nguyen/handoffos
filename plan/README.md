# Handoff OS Plugin-First Roadmap

This folder breaks the next product work into four milestones:

- [M1 - CLI Contract](./m1-cli-contract.md)
- [M2 - MCP Contract](./m2-mcp-contract.md)
- [M3 - First Plugin](./m3-first-plugin.md)
- [M4 - Agent Templates](./m4-agent-templates.md)

## Strategy

The product direction is plugin-first, but the implementation should stay core-first:

```text
Agent plugin / template
  -> public CLI or MCP contract
  -> packages/core business logic
  -> .shared-context filesystem contract
```

Plugins should be thin wrappers. They should not import internal TypeScript APIs
or duplicate snapshot/memory logic.

## Execution Order

1. Build the stable CLI contract first.
2. Expose the same capabilities through MCP.
3. Build one real plugin against the public contract.
4. Add agent templates for tools that do not support plugins or MCP well.

## Non-Negotiables

- `.shared-context/latest.md` is the universal handoff entrypoint.
- `.shared-context/latest.diff` is for line-level details, read on demand.
- `.shared-context/latest.json` is for structured tool/plugin parsing.
- No raw chat transcript storage.
- Core logic lives in `packages/core`.
- CLI, MCP, and plugin layers stay thin.
- Any command a plugin parses must support stable JSON output.

## Current Recommended Focus

Start with [M1 - CLI Contract](./m1-cli-contract.md).

Do not start plugin-specific work until these commands are reliable:

```bash
ctx copy
ctx copy --json
ctx status --json
ctx resume
ctx commit-session --json
```
