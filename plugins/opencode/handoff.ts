import type { Plugin } from "@opencode-ai/plugin"

/**
 * Handoff OS — OpenCode plugin
 *
 * Uses only the public `ctx` CLI (no direct core imports, no DB writes).
 * Set CTX_COMMAND env var for a custom binary path.
 *
 * Commands:
 *   /init   — Initialize .shared-context/
 *   /status — Show handoff state (repo, branch, changed files, memories)
 *   /copy   — Write latest.md / latest.diff / latest.json
 *   /resume — Load context from latest.md
 *   /commit — Save session note + refresh snapshot
 */

const CTX_BIN = process.env.CTX_COMMAND || "ctx"

export const HandoffPlugin: Plugin = async ({ $, directory }) => {
  const root = directory || process.cwd()
  const sharedDir = `${root}/.shared-context`

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Run ctx with args via shell. Returns { exitCode, stdout }. */
  const exec = (args: string) =>
    $`${CTX_BIN} ${args}`.quiet().nothrow()

  /** Read file content; returns "" on missing. */
  const readFile = async (p: string): Promise<string> => {
    const r = await $`node -e "try{process.stdout.write(require('fs').readFileSync('${p}','utf-8'))}catch(e){}"`
    return r.stdout
  }

  // ---------------------------------------------------------------------------
  // /init
  // ---------------------------------------------------------------------------

  async function cmdInit(): Promise<string> {
    const r = await exec("init")
    if (r.exitCode !== 0) return "Failed to initialize. Try `/init` again."
    return "Handoff OS initialized. Run `/status` to confirm."
  }

  // ---------------------------------------------------------------------------
  // /status
  // ---------------------------------------------------------------------------

  async function cmdStatus(): Promise<string> {
    const r = await exec("status --json")
    if (r.exitCode !== 0 || !r.stdout) return "Not initialized. Run `/init` first."

    try {
      const s = JSON.parse(r.stdout)
      const lines: string[] = [
        s.initialized !== false ? "Handoff OS is initialized." : "Not initialized. Run `/init`.",
        `Repo: ${s.repo || "unknown"}`,
        `Branch: ${s.branch || "unknown"}`,
        `Changed: ${s.changed_files?.length ?? 0} files`,
      ]
      if (s.memories) {
        lines.push(
          `Memories: ${s.memories.total} total, ${s.memories.active} active, ${s.memories.stale} stale`,
        )
      }
      if (s.latest_snapshot?.exists) {
        lines.push("Snapshot: .shared-context/latest.md")
      }
      return lines.join("\n")
    } catch {
      return "Failed to parse status."
    }
  }

  // ---------------------------------------------------------------------------
  // /copy
  // ---------------------------------------------------------------------------

  async function cmdCopy(): Promise<string> {
    const r = await exec("copy --json")
    if (r.exitCode !== 0 || !r.stdout) return "Failed to write snapshot."

    try {
      const j = JSON.parse(r.stdout)
      if (!j.ok) return "Failed to write snapshot."

      const paths = Object.values(j.files ?? {}).filter(Boolean) as string[]
      const relative = paths.map((p: string) => p.replace(root, "."))
      return [
        `Snapshot written (${j.generated_at?.slice(0, 19).replace("T", " ") || "now"})`,
        ...relative.map((p: string) => `• ${p}`),
      ].join("\n")
    } catch {
      return "Snapshot written."
    }
  }

  // ---------------------------------------------------------------------------
  // /resume
  // ---------------------------------------------------------------------------

  async function cmdResume(): Promise<string> {
    const md = await readFile(`${sharedDir}/latest.md`)
    if (!md) return "No snapshot found. Run `/init` then `/copy` first."

    const lines = md.split("\n")
    const goal = lines.find((l) => l.startsWith("**Goal:**"))?.replace("**Goal:** ", "") || ""

    const idxNext = lines.findIndex((l) => l.startsWith("### Next") || l.startsWith("### Next Steps"))
    const next: string[] = []
    if (idxNext >= 0) {
      for (let i = idxNext + 1; i < lines.length; i++) {
        const t = lines[i]?.trim() ?? ""
        if (t.startsWith("- ")) next.push(t.slice(2))
        else if (/^\d+\.\s/.test(t)) next.push(t.replace(/^\d+\.\s*/, ""))
        else if (t.startsWith("### ")) break
      }
    }

    const header = [`*handoff* resume — **${goal}**`]
    if (next.length > 0) header.push(`Next: ${next[0]}${next.length > 1 ? ` (+${next.length - 1} more)` : ""}`)
    header.push("", `Full: \`.shared-context/latest.md\``)

    return header.join("\n")
  }

  // ---------------------------------------------------------------------------
  // /commit
  // ---------------------------------------------------------------------------

  async function cmdCommit(args: string): Promise<string> {
    const summary = args.trim() || "session checkpoint"

    const r = await exec(`commit-session -m ${JSON.stringify(summary)} --json`)
    if (r.exitCode !== 0 || !r.stdout) return "Failed to commit session."

    let ok = false
    try {
      const j = JSON.parse(r.stdout)
      ok = j.ok === true
    } catch { /* use default */ }

    // Refresh snapshot
    const snapR = await exec("copy --json")
    const snapOk = snapR.exitCode === 0 && snapR.stdout.includes('"ok":')

    return `Session committed: ${summary}\nSnapshot ${snapOk ? "updated" : "update failed"}.`
  }

  // ===========================================================================
  // Plugin hooks
  // ===========================================================================

  return {
    "command.execute.before": async (input: any, output: any) => {
      const cmd = (input?.command ?? "").toLowerCase()
      const cmdArgs: string = input?.arguments ?? input?.args ?? ""
      let result = ""

      try {
        switch (cmd) {
          case "copy":
            result = await cmdCopy()
            break
          case "init":
            result = await cmdInit()
            break
          case "status":
            result = await cmdStatus()
            break
          case "resume":
            result = await cmdResume()
            break
          case "commit":
            result = await cmdCommit(cmdArgs)
            break
          default:
            return // not our command
        }
      } catch (e: any) {
        result = `*handoff* error: ${e?.message ?? e}`
      }

      output.parts = [{ type: "content", content: result.trim() }]
    },

    "experimental.session.compacting": async (_input: any, output: any) => {
      await exec("copy --json").catch(() => {})

      output.context.push(`
## Handoff OS Context Snapshot

A full context snapshot was auto-saved at .shared-context/latest.md.
Read that file to resume the current task.
`)
    },
  }
}
