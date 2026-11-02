# NEXUS KAF-AI — Mission 006 Repository & Production Audit

Audit date: 2026-11-03  
Audit branch: `mission-006-audit`  
Base: `main`  
Scope: repository source, Mission 005 proposal, connected Supabase project metadata/schema/policies/advisors.  
Safety: read-only inspection only; no production code, database schema, secrets, or deployment settings were changed.

## 1. Confirmed architecture

- Frontend source: `nexus_netlify_ready/index.html`
- Active backend source: `cloudflare/worker.js`
- Database and authentication: Supabase project `nexus-platform` (`ap-south-1`, PostgreSQL 17).
- AI runtime: Cloudflare Workers AI binding, model `@cf/meta/llama-3.1-8b-instruct-fp8`.
- `nexus_netlify_ready/netlify/` is documented as a legacy backend, not the active Worker API.
- The frontend contains a public Supabase publishable key. No service-role key was found in the inspected frontend source. Publishable keys are intended for client use; service-role credentials must remain server-side.

## 2. Verified database state

The connected project reports `ACTIVE_HEALTHY`.

Ten public tables were returned by the live schema inspection:
- `problems`, `analyses`, `solutions`, `sources`, `action_steps`, `outcomes`, `feedback`
- `nexus_problems`, `nexus_admins`, `nexus_memory`

RLS is enabled on all ten tables.

The inspected policies include owner-scoped access for the original problem workflow and `nexus_memory`, plus admin-membership checks for `nexus_problems` and designated evidence-ledger records. The Evolution Engine tables are absent from the live schema.

The migration history tool returned one recorded migration: `add_conversation_memory_category`. The live `nexus_memory.category` constraint already includes `conversation`. The migration history and repository migration filenames should be reconciled before applying any additional DDL; do not infer that a file is unapplied solely from its filename.

### Database findings

- **P1 — Evolution schema absent:** `nexus_experiments`, `nexus_knowledge_nodes`, `nexus_knowledge_edges`, and `nexus_evaluations` are not present. Mission 005's migration is review-only and has not been applied.
- **P1 — Migration ledger needs reconciliation:** only one migration record was returned. Compare the repository migration directory against the remote migration ledger and actual schema before any apply operation.
- **P1 — Broad API grants:** `anon` has table privileges on several legacy workflow tables. Current RLS policies are scoped to `authenticated`, so the grants alone do not bypass RLS. Map actual frontend/API use and test anonymous flows before considering any privilege revocation.
- **P2 — Auth hardening:** Supabase Security Advisor reports leaked-password protection is disabled. Enable it through the Auth settings after owner approval and verify the sign-in/password flows.
- **P2 — Performance advisor:** seven indexes on the legacy workflow tables are reported unused. Do not drop them based on this notice alone; the project is young and usage may be low. Re-evaluate after real traffic and query-plan review.

## 3. Worker source comparison

- The `main` Worker validates JSON object bodies and bounds chat/problem payload sizes.
- The `main` Worker has no `PROBLEM_RATE_LIMIT` binding check on the public problem submission route.
- Mission 005's Worker adds optional Cloudflare Rate Limiting binding support. The feature remains inactive unless the binding is configured on the deployed Worker.
- The Worker uses the service-role key for the public problem proxy. Keep that key exclusively in Worker secrets; never send it to the browser or model.
- The Worker root response reports source-level configuration indicators only. It is not proof that a production deployment uses the inspected source revision.

## 4. Mission 005 status

PR #24 (`mission-005-complete-improvements` -> `main`) was observed as an open draft during the audit. Its latest reported GitHub Actions validation passed. The PR includes an Evolution Engine prototype, admin workspace, optional rate-limit support, tests, and a Supabase migration.

The PR description explicitly says browser-level interaction tests, Supabase migration/RLS tests, live rate-limit tests, and local VAE training were not completed. It also says no production Cloudflare Worker or Pages deployment was performed.

A passing CI syntax/safety check is not equivalent to production integration verification.

## 5. Prioritized Mission 006 work

### P0 — Establish a safe release baseline
1. Keep `main` unchanged while auditing.
2. Verify the exact deployed Worker and frontend revisions from their respective hosting dashboards.
3. Add repeatable tests for Worker routes, request validation, and failure handling.
4. Preserve a rollback path and never expose service-role credentials.

### P1 — Close public submission abuse gap
1. Configure the Cloudflare rate-limit binding on the actual deployed Worker.
2. Verify a normal submission, threshold response (429), and configured-limiter failure response (503).
3. Do not claim protection is active until a live test confirms it.

### P1 — Reconcile and stage Evolution schema
1. Compare all repository migrations with the remote migration ledger and live schema.
2. Test the Mission 005 migration on a disposable Supabase branch/database.
3. Verify RLS and admin-only behavior using both admin and non-admin accounts.
4. Apply to production only after a reviewed migration plan and explicit owner approval.

### P1 — Auth and authorization hardening
1. Enable leaked-password protection after owner approval.
2. Review the broad `anon` grants against real client usage.
3. Confirm all admin operations remain enforced by database policies, not only frontend checks.

### P2 — Frontend and chat reliability
1. Browser-test admin login, logout, problem listing/status update, Memory Core, consent, and delete flows.
2. Test mobile layout, keyboard navigation, loading/error/empty states.
3. Add regression tests without changing existing data or removing working controls.

## 6. Changes made in this audit

- Created this audit document on the isolated `mission-006-audit` branch.
- No application source files were modified.
- No database migrations were applied.
- No Cloudflare/Pages deployment or secret/configuration changes were made.

## 7. Release gate

Do not merge or deploy Mission 006 until P0 checks pass and P1 database/abuse-control changes have been tested and reviewed. Keep Mission 005 separate until its integration gaps are closed.
