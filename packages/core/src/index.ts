export { createConnection, getDb, initializeDatabase } from "./db/connection.js";
export { memories, sessions, handoffLogs } from "./db/schema.js";
export {
  createMemory,
  createSession,
  updateMemoryStatus,
  getMemory,
  searchMemories,
  listOpenTasks,
  getBranchContext,
} from "./memory/engine.js";
export { pinMemory, invalidateMemory, supersedeMemory, detectStaleMemories } from "./memory/lifecycle.js";
export { generateResumePack, formatForAgent } from "./handoff/pack.js";
export {
  generateSnapshotData,
  formatSnapshotMarkdown,
  formatSnapshotJson,
  getGitDiff,
  writeContextSnapshot,
} from "./handoff/snapshot.js";
export type { SnapshotData } from "./handoff/snapshot.js";
export { getGitContext, getCurrentBranch, getBranchInfoSafely } from "./git/context.js";
export { resolveScope } from "./scope/index.js";