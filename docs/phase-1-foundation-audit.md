# NEXUS KAF-AI — Phase 1 Foundation Audit

Audit date: 2026-11-03  
Repository: `kafilpathan/nexus-platform`  
Working branch: `audit/phase-1-foundation-repair`

## Scope and safety

This work is isolated to a development branch and additive database changes. The production `main` branch was not modified. No application rows were deleted or rewritten, and no unused indexes were dropped.

## Verified platform state

- Supabase project is reachable and reports `ACTIVE_HEALTHY`.
- Database engine is PostgreSQL 17.
- All inspected public tables have row-level security enabled (0 public tables without RLS).
- Admin UI verifies the signed-in user against `public.nexus_admins`.
- The existing Evolution workspace is a structured prompt workflow, not a genetic algorithm or autonomous self-modifying system.

## Completed in Phase 1

Added migration `index_uncovered_foreign_keys` to cover the five foreign-key columns reported by the Supabase performance advisor:

- `nexus_evaluations.created_by`
- `nexus_experiments.created_by`
- `nexus_experiments.reviewed_by`
- `nexus_knowledge_edges.created_by`
- `nexus_knowledge_nodes.created_by`

The migration was applied successfully to Supabase and the five indexes were verified in `pg_indexes`. A subsequent advisor run no longer reported unindexed foreign keys.

## Open findings

### 1. Auth password protection

Supabase security advisor still reports leaked-password protection as disabled. Enable it in the Supabase Dashboard under Authentication / Password Security, then rerun the security advisor. This is an Auth project setting and was not changed by SQL.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Migration history drift

The repository contains:
- `20261101000000_nexus_memory.sql`
- `20261102000000_add_conversation_memory_category.sql`

The remote migration history reports:
- `20261101213232_add_conversation_memory_category`
- `20261102212911_nexus_evolution_engine_hardened_20261103`
- `20261103175120_index_uncovered_foreign_keys`

The initial memory migration is not represented in the remote history, and the category migration version differs. The hardened evolution migration is recorded remotely but its matching source file was not present in the inspected repository migration directory. Do not blindly replay or mark migrations as applied. Reconcile by recovering the exact SQL for the remote hardened migration, comparing live schema with source migrations, and then establishing a canonical migration baseline in a reviewed follow-up.

### 3. Unused-index notices

The advisor reports 17 indexes as unused, including newly created indexes. This is expected immediately after creation and may also reflect low traffic or advisor statistics reset. Keep them for now; collect representative workload statistics before considering any removal.

### 4. Deployment validation

The inspected repository has a Worker syntax-check workflow, but a full deployment workflow and live deployment health were not verified in this audit. Verify CI, Cloudflare Worker routes/secrets/bindings, and smoke tests before production rollout.

## Next safe steps

1. Enable leaked-password protection in the Supabase Dashboard.
2. Reconcile migration history using exact source SQL and schema comparison.
3. Add repeatable database and Worker tests to CI.
4. Run a non-destructive authenticated smoke test for admin access and owner-scoped memory.
5. Open and review a pull request before merging anything to `main`.

## Acceptance checks

- Five new indexes exist in the live database.
- Supabase advisor no longer reports unindexed foreign keys.
- No public table is missing RLS.
- No application data was deleted or rewritten by this phase.
- Production `main` remains unchanged pending PR review.
