# Handoff OS

**Shared working memory for coding agents — switch tools, keep context.**

Handoff OS is a local-first context layer that lets AI coding agents share and resume work across tools like Claude Code, Codex, OpenCode, Cursor/Windsurf, and any MCP-compatible agent. No more pasting chat logs between tools.

## Why

You're deep in a session — hitting token limit, quota runs out, or you just need to switch tools. You copy whatever context you can and hope the next agent understands.

Handoff OS solves this with one thing: when you're about to lose context, the agent writes a **compact context snapshot** to a file. The next agent reads that file and picks up where you left off. No commands, no plugins needed on the receiving end — just a file on disk.

## How It Works

```
[Agent A] working on task
        ↓
→ token limit / quota / tool switch
        ↓
Agent writes .shared-context/latest.md  ← universal filesystem contract
                  ↓
[Agent B] "read .shared-context/latest.md"
        ↓
Agent B picks up: goal → files → decisions → blockers → next steps
```

The filesystem is the bridge. No cloud, no daemon, no shared database needed. Any agent — even one that never heard of Handoff OS — can read `.shared-context/latest.md` with a simple `cat`.

## Usage Documentation

For a detailed local setup and operating guide, including current CLI usage,
MCP caveats, workflow examples, troubleshooting, and the difference between
current implementation and product direction, see [docs/USAGE.md](docs/USAGE.md).

## The Only Scenario That Matters

**The exit moment.** You're about to lose context. You need a single compact thing to hand off. That's it. Everything else is automatic.

| Moment | What happens |
|--------|-------------|
| During work | Agent auto-saves decisions, blockers, completions to memory |
| **Exit moment** | Agent writes `.shared-context/latest.md` + `.shared-context/latest.diff` + `.shared-context/latest.json` |
| New session | "Read `.shared-context/latest.md` and pick up" — works with any agent |

## Agent Plugins (OpenCode / Claude Code / Codex)

Handoff OS provides slash commands for agents that support plugins. The core is the same — the plugin is just a nicer way to invoke the snapshot.

| Command | What it does | When |
|---------|-------------|------|
| **`/init`** | Setup `.shared-context/` in this project | Once |
| **`/status`** | Show current context: goal, tasks, branch, files, last action | Any time |
| **`/commit`** | Save session to memory + generate git commit with full context | Task done |
| **`/resume`** | Pull full context from memory into this session | New session, switching agents |
| **`/copy`** | Write context snapshot to `.shared-context/latest.md` + `.shared-context/latest.diff` + `.shared-context/latest.json` | **Exit moment** |

No `/save`, no `/search`, no `/pin`, no `/invalidate` — the agent saves and manages memory automatically during work. The only commands are the ones where the human needs to say "where am I" or "done with this" or "handing off."

### Filesystem Contract (The Universal Bridge)

```
.shared-context/
  latest.md         # ← Human-readable context snapshot (cat-able by any agent)
  latest.diff       # ← Full git diff (line-level changes, read on demand)
  latest.json       # ← Machine-readable snapshot (for structured parsing)
  memory.db         # SQLite store
  config.json       # Workspace config
  sessions/         # Archived session data
  snapshots/        # Recent context snapshots
```

The `.shared-context/` directory sits in the repo root. Any tool, any agent, any script can read it. That's the design — you don't need Handoff OS installed to resume work. You just need the file.

The three files serve different read patterns:

| File | When to read | Purpose |
|------|-------------|---------|
| `latest.md` | **Always first** | Briefing: goal, done/in-progress/will-do, what happened, decisions, blockers, next steps. Fast read — agent understands context in one pass. |
| `latest.diff` | **On demand** | Full git diff — line-level changes since last handoff. Agent reads this only if it needs exact change details not covered in the briefing. |
| `latest.json` | **Tool use** | Structured data for tool-based parsing. Used by MCP tools and scripts that need to query fields programmatically. |

### On-Ramp: No Handoff OS Required

The `.shared-context/` directory works without Handoff OS installed. Any agent can participate in the handoff loop:

1. **Read**: `cat .shared-context/latest.md` — the agent gets full context in one page
2. **Write**: Generate `latest.md` + `latest.diff` + `latest.json` from your current session
3. **Resume**: Read `latest.md`, check `latest.diff` for line-level changes, continue work

This is the universal fallback. Handoff OS plugins and MCP server add convenience, but the filesystem contract works with any tool — no installation needed.

### Agent Bootstrap Configuration

For seamless handoff, configure each agent to read `.shared-context/latest.md` on session start. These are one-time setup per project:

**Claude Code** — add to `CLAUDE.md` at project root:
```markdown
On session start: if `.shared-context/latest.md` exists, read it and continue
from where the previous agent left off.
```

**Kilo / Cline / Aider** — add to `AGENTS.md` or `.clinerules`:
```markdown
On session start: check for `.shared-context/latest.md`. If present, read it
to understand current state, then continue work.
```

**Cursor / Windsurf** — add to `.cursorrules`:
```markdown
When a new session starts: if `.shared-context/latest.md` exists, read it and
resume from the last saved context.
```

**OpenCode** — built-in `/resume` command (reads `.shared-context/latest.md`):
```json
{
  "onStart": ["read .shared-context/latest.md"]
}
```

Once these configs are in place, every agent automatically picks up context — even agents that have never heard of Handoff OS.

### What's in `latest.md`

The snapshot is **what the new agent needs to know** — not a diff, but a briefing:

```markdown
## Context Snapshot

**Goal:** Add slow-scroll parallax animation for hero section
**Branch:** feat/parallax-hero
**Repo:** landing-page
**Agent:** Claude Code

### ✅ Done
- Added `useScrollPosition` hook that tracks Y offset
- Hook debounces at 30fps to avoid layout thrashing

### 🟡 In Progress
- Actually wiring the parallax offset to hero background in HeroSection.tsx

### 📋 Will Do
- Handle resize (recalculate parallax factor)
- Add reduced-motion media query fallback

### 🗑️ Removed
- `hooks/useLegacyScroll.ts` — old scroll listener deleted. Its
  `getScrollY()` callers migrated to `useScrollPosition()`.

### What happened
- `hooks/useScrollPosition.ts` — added custom hook using
  `requestAnimationFrame` + debounce. Main export: `useScrollPosition()`.
- `components/HeroSection.tsx` — wired the hook output to background
  `translateY` via inline style. Look at `parallaxStyle` computed prop.
- `hooks/useScrollPosition.test.ts` — added tests for scroll bounds.

### Key decisions
- Debounce at 30fps, not rAF directly, because rAF fires every frame
  (too often for a parallax effect — 30fps is smooth enough).
- Used `translateY` instead of `background-position` because GPU-composited.

### Blockers
- None

### Next Steps
1. Add `matchMedia('prefers-reduced-motion')` check — skip animation if true
2. Add `resize` listener to recalculate parallax factor on window resize
3. Test on mobile viewport sizes
```

No raw diffs in the briefing. The new agent reads `latest.md` first, knows exactly which files matter and what was done in each, reads only those files, and continues. If line-level detail is needed, `latest.diff` is right there. One page replaces scanning the whole codebase.

### Format Specification

For reliable cross-agent handoff, every agent must write `latest.md` with the same structure:

| Section | Required? | Content |
|---------|-----------|---------|
| `## Context Snapshot` | Yes | Top-level container for all content |
| `**Goal:**` | Yes | Single-line description of the current objective |
| `**Branch:**` | Yes | Current git branch |
| `**Repo:**` | Yes | Repository name |
| `**Agent:**` | Yes | Agent tool that wrote this (e.g. Claude Code, OpenCode) |
| `### ✅ Done` | Recommended | Completed items — bullet list, one per logical unit |
| `### 🟡 In Progress` | Yes | Currently active work — what the agent was doing at exit |
| `### 📋 Will Do` | Recommended | Upcoming work, ordered by priority |
| `### What happened` | Yes | File-by-file summary of changes since last handoff. Function names, not diffs. For deleted files, describe what they contained and where the functionality now lives. |
| `### 🗑️ Removed` | Recommended | Files deleted or content moved. What they contained and where it went. Prevents agents from trying to import deleted files or losing knowledge of removed code. |
| `### Key decisions` | Recommended | Technical decisions with rationale. Enables the next agent to understand _why_. |
| `### Blockers` | Yes | Current blocking issues, or "None" |
| `### Next Steps` | Recommended | Ordered action items for the next agent |

**Rules:**
- Do NOT include full file contents or raw diffs — `latest.diff` exists for line-level detail
- Do NOT include chat transcripts — synthesize into structured entries under the relevant section
- Keep the briefing under one page — if it's longer, the agent skipped context management
- All sections are **stable by name** — agents rely on exact header text to parse. Do not rename sections.
- **Deleted content must be documented** — when removing a file or moving its contents, describe what it contained and where the functionality now lives. Without this, the next agent has no way to know what was lost. Example:
  ```markdown
  ### 🗑️ Removed
  - `src/utils/helpers.ts` — contained `parseDate()` and `formatCurrency()`.
    Logic moved to `src/utils/parse.ts` and `src/utils/currency.ts`.
  - `src/legacy/adapter.ts` — no longer needed. API provider changed their
    contract, all call sites updated to use the new client directly.
  ```

## MCP Server

For agents that support the Model Context Protocol, Handoff OS provides an MCP server so the agent can read/write context directly:

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
| `copy_context` | Generate context snapshot for exit/switch |
| `get_resume_pack` | Pull context from store for current session |
| `commit_session` | Save completed work |
| `save_memory` | Store a single memory |
| `search_memory` | Query stored memories |
| `list_open_tasks` | Get active tasks |

## Key Features

- **Filesystem-first** — `.shared-context/latest.md` is readable by any agent, no install required
- **Agent-native** — plugins + MCP, not CLI; agents are the primary users, not humans
- **Branch-aware & task-aware** — memories scoped to repo/branch/task
- **Context snapshot** — goal, files touched, done/doing/will-do, decisions, blockers, next steps in one page
- **Auto memory** — agent saves decisions, blockers, completions as it works (no manual save)
- **Git-native** — reads branch, changed files, recent commits automatically
- **MCP server** — any MCP-compatible agent can query and store context

## Unique Differentiators

Handoff OS competes with tools like Memory File, Context7, and agent-specific memory features. Here's what makes it different:

### 1. Branch-aware & Task-aware Memory

Memories are scoped to repo + branch + task, not just to the workspace. This prevents the dangerous pattern of pulling context from a different branch into the current session. When an agent is working on `feat/payment` and a memory search returns decisions from `main`, the result is confusion at best, broken code at worst. Branch scoping eliminates this.

### 2. Usable Handoff Pack

The `latest.md` briefing isn't a raw transcript dump — it's a structured resume: current goal, what happened file-by-file, key decisions with rationale, blockers, and ordered next steps. Any agent can read it in one pass. It's more useful than a chat log because it distills what matters and omits what doesn't.

### 3. Memory Hygiene

Most memory tools become junk drawers over time because they lack lifecycle management. Handoff OS has:
- **Stale detection** — memories auto-decay after 7 days of inactivity
- **Invalidation** — explicit mark-bad when a memory is wrong
- **Supersede** — updated memories link to the version they replaced
- **Confidence scoring** — ranking formula weights recency, scope match, and semantic similarity

This is a product differentiator, not a technical footnote.

### 4. Git-native Context

Handoff OS reads the live git state — branch name, changed files, recent commits, commit messages — and ties context to real codebase changes. The agent's memory is anchored to what actually changed in the repo, not just to what the agent said in chat.

### 5. Progressive Context Loading

Memory loads in layers, not all at once:

```
global → project → branch → task → file-level
```

Each layer is narrower and more detailed. The agent reads the top layer first, then expands into deeper layers on demand. This keeps the initial prompt small and avoids blowing through context window with irrelevant memories.

## Core Use Cases

### Use case 1: Quota ends, switch agent

You're deep in a bug fix in Claude Code. Quota runs out. You run `/copy` (or it auto-saved), then open Codex and `/resume`. Codex picks up: current goal, what changed, which files, blockers, next step — without re-reading the entire session history.

### Use case 2: Planner → coder handoff

Agent A analyzes the codebase, plans the approach, documents key decisions. Agent B (better at code edits or test loops) picks up the implementation. The shared context layer transfers planning state to execution state without losing constraints that were already decided.

### Use case 3: Resume after days away

You come back to a repo after the weekend. You don't remember where you stopped. One `/status` or a quick read of `.shared-context/latest.md` tells you: current task, blockers, key decisions, and next steps. No scrolling through old chat transcripts.

### Use case 4: Cross-tool continuity

Part of the work happens in an IDE agent (Cursor), part in a terminal agent (Claude Code), but everything shares the same memory scope for the same project. Different tools, same context.

## How It Works (Detailed)

```
Plugins / MCP (agent-native entry points)
       ↓
Core Engine
  ├─ auto-save decisions, blockers, completions during work
  ├─ generate context snapshot on exit (/copy)
  └─ pull context on resume (/resume)
       ↓
Storage
  ├─ .shared-context/latest.md   (filesystem contract — any agent can read)
  ├─ .shared-context/latest.diff (full git diff for line-level reference)
  ├─ .shared-context/latest.json (machine-readable)
  ├─ memory.db                   (structured memory, SQLite)
  └─ sessions/                   (archived sessions)
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

Memories auto-decay to `stale` after 7 days of inactivity or can be explicitly invalidated/superseded.

### Auto-Save on Token Warning

Agents don't die silently — they warn first. Claude Code shows "approaching context limit." OpenCode displays token counters. That warning is the trigger.

**How it works:**

1. Agent is working normally
2. Token or quota warning fires — still enough tokens left to write
3. Agent auto-runs `/copy` in response: writes `latest.md` + `latest.diff` + `latest.json`
4. Snapshot is on disk before the cutoff hits

This is the same `/copy` command the user runs manually — just executed automatically when the agent senses the exit coming.

**What if the user ignores the warning?** If the user keeps pushing and the agent dies mid-response, you lose that last response. But the snapshot from the warning moment is already on disk. The next agent reads it and continues. Lost work is bounded to the last response — typically 30-60 seconds of output.

**Why not save every message?** Unnecessary overhead. Most messages don't change files. Running `git diff` and regenerating the briefing on every turn wastes 500-800 tokens per cycle. Save on the moment that matters: when the agent is about to die. `/copy` on demand for everything else.

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
├── core/           # Core engine: DB, memory CRUD, retrieval, handoff, context snapshot
├── cli/            # CLI interface (secondary, for scripting)
├── mcp-server/     # MCP protocol server (primary agent entry point)
├── adapters/       # Agent-specific output formatters
└── shared/         # Shared types, schemas, utilities
```

## Requirements

- Node.js 20+
- pnpm (recommended) or npm
- Git (for branch-aware features)

## Status

- [x] Core memory CRUD
- [x] Scope-based retrieval (repo/branch/task)
- [x] Ranking formula
- [x] Agent-specific formatters (Claude, Codex, OpenCode)
- [x] MCP server tools
- [x] Memory lifecycle (pin, invalidate, supersede, stale detection)
- [x] Git integration (branch, changed files, commits)
- [ ] Context snapshot generator (/copy core logic)
- [ ] Filesystem contract: .shared-context/latest.md + latest.diff + latest.json
- [ ] OpenCode /copy, /status, /commit, /resume, /init skills
- [ ] Claude Code / Kilo / Cline / Cursor bootstrap configs (CLAUDE.md, AGENTS.md, .clinerules, .cursorrules)
- [ ] Auto-save during agent work
- [ ] Auto-commit on token pressure
- [ ] Local embeddings/vector search

## License

MIT
