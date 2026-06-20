import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CAC } from "cac";

const TEMPLATES: Record<string, { file: string; content: string }> = {
  claude: {
    file: "CLAUDE.md",
    content: `# Handoff OS — Claude Code Template

At session start:
1. If .shared-context/latest.md exists, read it first.
2. Continue from the current goal and next steps.
3. Read .shared-context/latest.diff only if line-level detail is needed.

During work:
1. Record important decisions and blockers.
2. Keep context branch-scoped.
3. Do not store raw chat transcripts.

Before ending:
1. Run \`ctx copy\`.
2. If meaningful work happened, run \`ctx commit-session -m "<summary>"\`.
3. Tell the next agent to read .shared-context/latest.md.
`,
  },
  codex: {
    file: "AGENTS.md",
    content: `# Handoff OS — Codex Template

When starting:
- Read .shared-context/latest.md before exploring the repo.
- If no latest snapshot exists, run \`ctx resume\`.
- Respect repo/branch/task scope.

Before final response:
- If work changed context, run \`ctx copy\`.
- If the session should be persisted, run \`ctx commit-session -m "<summary>"\`.
- Do not save raw conversation transcripts.
`,
  },
  cursor: {
    file: ".cursorrules",
    content: `When a new session starts, check .shared-context/latest.md.
Use it as the initial working context.
Use .shared-context/latest.diff only when exact line changes are needed.
Before ending a handoff-worthy session, run \`ctx copy\`.
`,
  },
  windsurf: {
    file: ".windsurfrules",
    content: `When a new session starts, check .shared-context/latest.md.
Use it as the initial working context.
Use .shared-context/latest.diff only when exact line changes are needed.
Before ending a handoff-worthy session, run \`ctx copy\`.
`,
  },
  cline: {
    file: ".clinerules",
    content: `Always read .shared-context/latest.md first when it exists.
Do not scan unrelated memories from other branches.
Before stopping, write a fresh handoff snapshot with \`ctx copy\`.
`,
  },
  kilo: {
    file: "AGENTS.md",
    content: `# Handoff OS — Kilo Template

Use Handoff OS context if present.
Start with .shared-context/latest.md.
Use \`ctx status --json\` for current state.
Use \`ctx copy\` for handoff.
`,
  },
  generic: {
    file: "AGENT_CONTEXT.md",
    content: `# Agent Context Rules

At session start:
1. If .shared-context/latest.md exists, read it first.
2. If .shared-context/latest.json exists and structured fields are needed, read it.
3. If .shared-context/latest.diff exists, read it only for exact line-level details.
4. Continue from the \`Next\` or \`Next Steps\` section.

Before ending:
1. Run \`ctx copy\` if available.
2. If \`ctx copy\` is unavailable, manually update .shared-context/latest.md.
3. Do not store raw chat transcripts.
`,
  },
};

const VALID_AGENTS = Object.keys(TEMPLATES);

export type InstallTemplateResult =
  | { ok: true; path: string; message: string }
  | { ok: false; message: string };

export function installTemplate(
  agent: string,
  options: { force?: boolean; cwd?: string },
): InstallTemplateResult {
  const normalized = agent.toLowerCase();
  const template = TEMPLATES[normalized];

  if (!template) {
    return {
      ok: false,
      message: `Unknown agent "${agent}". Valid agents: ${VALID_AGENTS.join(", ")}`,
    };
  }

  const targetPath = join(options.cwd ?? process.cwd(), template.file);

  if (existsSync(targetPath) && !options.force) {
    return {
      ok: false,
      message: `${template.file} already exists. Use --force to overwrite.`,
    };
  }

  writeFileSync(targetPath, template.content, "utf-8");
  return { ok: true, path: targetPath, message: `Installed ${normalized} template → ${targetPath}` };
}

export function installTemplateCommand(cli: CAC) {
  cli
    .command(
      "install-template <agent>",
      "Install a handoff OS agent template into the current project",
    )
    .option("--force", "Overwrite existing files")
    .action((agent: string, options: { force?: boolean }) => {
      const result = installTemplate(agent, options);
      if (result.ok) {
        console.log(result.message);
      } else {
        console.error(result.message);
      }
    });
}
