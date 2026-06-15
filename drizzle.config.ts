import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/core/src/db/schema.ts",
  out: "./packages/core/src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./.shared-context/memory.db",
  },
} satisfies Config;