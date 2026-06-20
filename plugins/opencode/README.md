# Handoff OS — OpenCode Plugin

Five slash commands for context handoff inside OpenCode.

## Requirements

- `ctx` in PATH (or `CTX_COMMAND` env var for a custom binary path)
- Handoff OS initialized in the repo (`/init`)

## Install

```bash
# Clone the repo (or point to your checkout)
git clone git@github.com:asta-nguyen/handoff-os.git

# Symlink the plugin into OpenCode
ln -sf "$(pwd)/plugins/opencode/handoff.ts" ~/.config/opencode/plugins/handoff.ts
```

Restart OpenCode. The five commands (`/copy`, `/init`, `/status`, `/resume`, `/commit`) are now available.

## Configuration

By default the plugin runs `ctx`. To use a different binary (e.g. a local dev build):

```bash
export CTX_COMMAND="node /path/to/handoff-os/packages/cli/dist/index.js"
```

## Commands

| Command | What it does | Calls |
|---------|-------------|-------|
| `/init` | Initialize `.shared-context/` | `ctx init` |
| `/status` | Show repo, branch, changed files, memories | `ctx status --json` |
| `/copy` | Write `latest.md`, `latest.diff`, `latest.json` | `ctx copy --json` |
| `/resume` | Load handoff context from `latest.md` | reads `.shared-context/latest.md` |
| `/commit <msg>` | Save session note + refresh snapshot | `ctx commit-session --json` + `ctx copy --json` |

## Workflow

```
Start session:   /resume
Check state:     /status
Save snapshot:   /copy or /commit <what I did>
```

On token pressure the plugin auto-saves a snapshot before compaction.
