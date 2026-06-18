# CLAUDE.md

Read `@AGENTS.md` for the repository instructions and conventions.

## Handoff OS — Claude Code bootstrap

When starting a new session:

1. **Check for existing context:**
   ```bash
   cat .shared-context/latest.md 2>/dev/null || echo "No handoff context found"
   ```

2. If handoff context exists, read it to understand current state (goal, done,
   blockers, next steps, key decisions).

## Exit Protocol (CRITICAL)

1. **Before your context limit hits:** Call `copy_context` MCP tool immediately to
   snapshot current state to `.shared-context/latest.md`.
2. **After making any changes:** Call `commit_session` to save a session summary to
   the memory database.
3. **Do not end a response without writing the snapshot.** If you're about to stop
   and haven't called `copy_context`, do it first.
