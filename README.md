# Handoff OS

**Shared working memory for coding agents — switch tools, keep context.**

Handoff OS is a local-first, CLI-first context layer that lets AI coding agents share and resume work across tools like Claude Code, Codex, OpenCode, Cursor/Windsurf, and any MCP-compatible agent. No more pasting chat logs between tools.

## Why

You're fixing a bug in Claude Code, quota runs out, you switch to Codex — but now you have to paste the entire conversation history to get it up to speed. Or you come back to a repo after 3 days and don't remember where you left off.

Handoff OS solves this by maintaining a **structured memory layer** that captures goals, decisions, blockers, files touched, and next steps — so any agent can pick up where the last one left off.

## Key Features

- **Branch-aware & task-aware memory** — memories scoped to repo/branch/task, not just a global pool
- **Handoff packs** — concise, agent-specific resume summaries (Claude, Codex, OpenCode formats)
- **Memory hygiene** — pin, invalidate, supersede, stale detection built-in
- **Git-native** — reads branch, changed files, recent commits automatically
- **Progressive loading** — from project overview to file-level detail
- **MCP server** — any MCP-compatible agent can query and store context

## Quick Start

```bash
# Install
npm install -g handoff-os

# Initialize in your project
cd your-project
ctx init

# Work with an agent, then commit the session
ctx commit-session -m "Fixed auth refresh token rotation"

# Switch agents and resume
ctx resume                    # Auto-detects context
ctx resume --for codex        # Format for a specific agent
ctx resume "auth-refresh" --for opencode

# Search memories
ctx search "token rotation"

# Create a handoff pack
ctx handoff --task "auth-refresh" --for claude -o handoff.md
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ctx init` | Initialize handoff-os in current workspace |
| `ctx status` | Show workspace context and memory stats |
| `ctx commit-session` | Save current session as structured memory |
| `ctx search <query>` | Search memories with ranking |
| `ctx resume [task]` | Generate a resume pack |
| `ctx handoff` | Create a handoff pack for another agent |
| `ctx pin <id>` | Pin an important memory |
| `ctx invalidate <id>` | Mark a memory as incorrect |
| `ctx supersede <old> --with <new>` | Replace old memory with new |
| `ctx tasks` | List all open tasks |
| `ctx branch-context` | Show memory snapshot for current branch |

## MCP Server

Handoff OS includes an MCP server for agents that support the Model Context Protocol:

```json
{
  "mcpServers": {
    "handoff-os": {
      "command": "npx",
      "args": ["-y", "@handoff-os/mcp-server"]
    }
  }
}
```

### MCP Tools

| Tool | Purpose |
|------|---------|
| `save_memory` | Save a new structured memory |
| `search_memory` | Search memories with scope + query |
| `get_resume_pack` | Generate a handoff pack for context transfer |
| `pin_memory` | Pin an important memory |
| `invalidate_memory` | Mark a memory as incorrect |
| `supersede_memory` | Replace old memory with new |
| `list_open_tasks` | List open tasks |
| `get_branch_context` | Get memory snapshot for current branch |

## How It Works

```
Adapter Layer       CLI / MCP Server
       ↓
Ingestion Layer     Agent output, git metadata, project files
       ↓
Processing Layer    Summarize, extract, score, detect staleness
       ↓
Storage Layer       SQLite + Markdown snapshots
       ↓
Retrieval Layer     Hybrid search → ranked results → handoff pack
```

### Memory Types

| Type | Purpose |
|------|---------|
| `fact` | Stable background information |
| `decision` | Technical decision + rationale |
| `task` | Work status and progress |
| `blocker` | Current blockers |
| `summary` | Session summary |
| `repo_map` | Codebase structure description |
| `assumption` | Active assumptions |

### Memory Lifecycle

```
active → stale → archived
  ↓
superseded / invalidated
```

Memories auto-decay to `stale` after 7 days of inactivity or can be explicitly `invalidated`/`superseded`.

### Ranking Formula

```
final_score =
  scope_match * 0.35 +
  semantic_similarity * 0.25 +
  recency * 0.15 +
  confidence * 0.10 +
  pinned_boost * 0.10 -
  stale_penalty * 0.15
```

## Workspace Structure

```
.shared-context/
  config.json       # Workspace configuration
  memory.db         # SQLite database
  sessions/         # Session archives
  handoffs/         # Generated handoff packs
  decisions/        # Decision records
  tasks/            # Task snapshots
  snapshots/        # Context snapshots
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Generate database migrations
cd packages/core && npx drizzle-kit generate
```

### Project Structure

```
packages/
├── core/           # Core engine: DB, memory CRUD, retrieval, handoff
├── cli/            # CLI interface (ctx command)
├── mcp-server/     # MCP protocol server
├── adapters/       # Agent-specific output formatters
└── shared/         # Shared types, schemas, utilities
```

## Requirements

- Node.js 20+
- pnpm (recommended) or npm
- Git (for branch-aware features)

## MVP Status

- [x] Core memory CRUD
- [x] Scope-based retrieval (repo/branch/task)
- [x] Ranking formula
- [x] CLI scaffold
- [x] Agent-specific formatters (Claude, Codex, OpenCode)
- [x] MCP server tools
- [x] Memory lifecycle (pin, invalidate, supersede, stale detection)
- [x] Git integration (branch, changed files, commits)
- [ ] Local embeddings/vector search
- [ ] Session auto-commit hooks

## License

MIT