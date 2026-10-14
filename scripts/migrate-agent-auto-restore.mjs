// Run before drizzle push: seed intent once, before stale-process reconciliation.
import postgres from "postgres";

try { process.loadEnvFile?.(process.env.ENV_FILE ?? ".env"); }
catch (error) { if (error?.code !== "ENOENT") throw error; }

const sql = postgres(process.env.DATABASE_URL ?? "postgres://opentag:opentag@localhost:5433/opentag", { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    const [table] = await tx`SELECT to_regclass('public.agents') AS agents`;
    if (!table?.agents) return; // Fresh installation: drizzle creates the default-false column.
    await tx`LOCK TABLE public.agents IN ACCESS EXCLUSIVE MODE`;
    const [column] = await tx`SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'auto_restore'`;
    if (column) return; // Never re-enable an explicitly stopped agent on later deployments.
    await tx`ALTER TABLE public.agents ADD COLUMN auto_restore boolean NOT NULL DEFAULT false`;
    await tx`UPDATE public.agents SET auto_restore = true
      WHERE deleted_at IS NULL AND status IN ('active', 'starting', 'queued', 'sleeping')`;
  });
  console.log("[agent-auto-restore] migration complete");
} finally { await sql.end(); }
