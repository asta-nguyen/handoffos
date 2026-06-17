# 🧠 Shared Agent Context Tool — Full Plan v2.1 (Complete)

---

# 1. Product Idea

Sản phẩm là một **context OS for coding agents**, giúp chia sẻ và duy trì ngữ cảnh làm việc giữa nhiều AI agents như Claude Code, Codex, OpenCode, Cursor/Windsurf, và các công cụ khác qua MCP hoặc CLI wrapper.

Mục tiêu không phải sync chat history, mà là tạo một **structured memory layer** để agent mới có thể resume work mà không cần paste lại toàn bộ hội thoại.

### Core problem:

* Hết quota → đổi agent → mất context
* Quay lại repo sau vài ngày → không biết đang làm gì
* Multi-agent workflow bị broken continuity

---

# 2. Product Positioning

**Best handoff and resume layer for coding agents**

Không phải AI memory platform chung chung.

Focus:

* agent switching không mất context
* resume đúng repo / branch / task
* memory có structure + lifecycle
* tránh "memory junk drawer"

---

# 3. Competitive Landscape

## Groups:

* Private local memory (OpenMemory MCP)
* Shared MCP memory systems
* Codebase semantic memory tools
* Lightweight architecture memory tools

---

## Gap in market:

* thiếu **true agent handoff system**
* thiếu **branch-aware + task-aware memory**
* thiếu **execution-ready context format**

---

# 4. Unique Differentiators (UPDATED)

## 4.1 Branch + Task aware memory

Scope luôn gồm:

* repo
* branch
* task
* optional PR/issue

---

## 4.2 Execution-grade handoff pack

Không chỉ summary → mà là **machine runnable context**

✔ Per-agent format:

* Claude
* Codex
* OpenCode

---

## 4.3 Memory hygiene system

* stale detection
* supersede
* invalidate
* confidence decay
* conflict detection (NEW)

---

## 4.4 Git-native context

* branch state
* diff snapshot
* commit clustering
* file-level changes

---

## 4.5 Progressive context loading

* global → repo → branch → task → file

---

# 5. Core Use Cases

* agent A → agent B resume work
* planner → coder handoff
* resume repo after days
* cross-tool continuity

---

# 6. Product Scope

## In scope v1:

* CLI-first system
* MCP server
* structured memory system
* git integration
* handoff/resume pack
* memory lifecycle system

## Out of scope v1:

* full chat sync
* enterprise cloud system
* UI-heavy product
* universal AI memory

---

# 7. Architecture Overview

## Layers:

### 1. Adapter layer

* Claude adapter
* Codex adapter
* OpenCode adapter
* file-based adapter

---

### 2. Ingestion layer

* session output
* git metadata
* user commands
* project files

---

### 3. Processing layer

* summarization
* extraction (facts/tasks/blockers)
* embeddings
* confidence scoring
* stale detection

---

### 4. Storage layer

* SQLite (core state)
* Markdown snapshots
* vector DB (optional)

---

### 5. Retrieval layer

* hybrid ranking system
* scoped retrieval
* semantic + structural search

---

### 6. Orchestration layer (NEW)

* controls full pipeline:
  ingest → process → store → retrieve → handoff
* ensures deterministic behavior

---

# 8. Tech Stack

## Recommended v1 stack:

* TypeScript (core + CLI)
* Node.js 22+
* SQLite (better-sqlite3 / libsql)
* Drizzle ORM
* MCP server (TS SDK)
* optional vector DB later

---

## Key constraint (NEW):

✔ Must support **offline deterministic replay**
→ same input = same memory output

---

# 9. Project Structure

```text
shared-agent-context/
├── packages/
│   ├── cli/ ❌ not built
│   ├── core/ ❌ not built
│   ├── mcp-server/ ❌ not built
│   ├── adapters/ ❌ not built
│   └── shared/
├── runtime/ (NEW orchestration layer)
├── docs/
├── examples/
└── .shared-context/
```

---

# 10. Local Storage Design

```text
.shared-context/
  config.json
  memory.db
  sessions/
  snapshots/
  handoffs/
```

### Requirement:

* fully local-first
* inspectable
* replayable state

---

# 11. Data Model

## Memory types:

* fact
* decision
* task
* blocker
* summary
* repo_map
* assumption

---

## Extended fields (NEW):

```json
{
  "stale_score": 0.0,
  "decay_rate": 0.02,
  "last_validated_at": "",
  "git_anchor": {
    "commit": "",
    "branch": "",
    "diff_hash": ""
  }
}
```

---

# 12. Memory Lifecycle (UPDATED)

States:

* active
* stale
* superseded
* invalidated
* archived
* conflicted (NEW)
* decaying (NEW)

---

# 13. Retrieval Strategy

Hybrid scoring:

* scope match
* semantic similarity
* recency
* confidence
* pinned boost
* stale penalty

---

## Rule:

⚠️ Never return invalid git-anchored memory unless explicitly requested

---

# 14. Handoff System (UPDATED)

## Human format:

* Markdown resume pack

## Machine format (NEW):

```json
{
  "mode": "agent_handoff",
  "target": "claude | codex | opencode",
  "goal": "",
  "files": [],
  "state": {}
}
```

---

# 15. CLI Commands

```bash
ctx init
ctx status
ctx save
ctx search
ctx commit-session
ctx resume
ctx handoff
ctx pin
ctx invalidate
ctx supersede
ctx tasks
ctx branch-context
```

---

# 16. MCP Tools

* save_memory
* search_memory
* commit_session
* get_resume_pack
* pin_memory
* invalidate_memory
* supersede_memory
* list_open_tasks
* get_branch_context

---

# 17. Execution Roadmap

## P0 — MVP

1. CLI scaffold
2. SQLite schema
3. save_memory
4. search_memory
5. commit_session
6. get_resume_pack

---

## P1 — Intelligence

7. lifecycle system
8. git integration
9. retrieval scoring

---

## P2 — MCP layer

10. MCP server

---

## P3 — adapters

11. Claude / Codex / OpenCode adapters

---

# 18. FILES FIRST TO BE BUILT

```text
packages/cli/src/index.ts
packages/core/db/schema.ts
packages/core/memory/save.ts
packages/core/memory/search.ts
packages/core/session/commit.ts
packages/core/resume/pack.ts
```

---

# 19. MVP SUCCESS CRITERIA (UPDATED)

MVP is valid only if:

* cross-agent resume works
* deterministic replay works
* no branch contamination
* handoff pack is machine usable

---

# 20. Testing Strategy (UPDATED)

* replay test (delete state → rebuild)
* cross-agent continuity test
* stale memory rejection test

---

# 21. Security

* local-first
* redact secrets
* no mandatory cloud
* full audit trail per memory

---

# 22. Metrics

* context loss rate
* resume success rate
* handoff success across agents
* time-to-resume metric

---

# 23. What NOT to do

* don't build UI early
* don't over-expand beyond coding agents
* don't depend on cloud embeddings
* don't store raw chat as primary memory

---

# 24. FINAL EXECUTION STATE

## Status:

> 🟡 DESIGN COMPLETE → READY FOR IMPLEMENTATION

---

# 25. NEXT STEP (CRITICAL PATH)

Build in this order:

1. `ctx init`
2. SQLite schema
3. `save_memory`
4. `search_memory`
5. `commit_session`
6. `get_resume_pack`
