# NEXUS KAF-AI Evolution Engine v1 — Implementation Status

Status: prototype implemented on `mission-005-complete-improvements`. No production deployment or live database migration was performed.

## Implemented in this branch

| Capability | Implementation | Current boundary |
|---|---|---|
| Generative proposals | Existing Workers AI inference endpoint via `generative-proposals.mjs` | Draft text only; not GAN/VAE training and not verified facts |
| Generative model research | Optional PyTorch VAE training script on synthetic 2D data | Local research demo; no NEXUS/user data |
| Evolutionary algorithms | Seeded genetic optimizer with bounded numeric search | Tunes demo/application parameters; no model-weight or production changes |
| Self-improvement | Deterministic candidate assessor with safety, correctness, latency and cost gates | Eligibility recommendation only; requires human review |
| Scalability | Bounded payloads, history, optimizer runs and graph traversal; existing Worker remains stateless | Needs load tests and actual traffic metrics before capacity claims |
| Knowledge integration | Provenance-aware nodes/edges, bounded traversal, Supabase admin adapter | Requires reviewed SQL migration to be applied before cloud persistence works |
| Hybrid AI | Rule-first decision boundary; model output marked untrusted | Model cannot authorize permissions or deployments |
| Continuous learning | Experiment/evaluation ledger, eligible-for-review state, explicit admin decision | Approval is for staged testing only; no automatic deploy or online weight update |

## How to use the dashboard

1. Open the NEXUS Pages site after this PR is reviewed and deployed separately.
2. Sign in through the existing Admin Login.
3. Open the Evolution Engine workspace below Memory Core / Agent Council.
4. Generate proposals or run the seeded optimizer locally.
5. Enter baseline and candidate metrics from the same evaluation suite.
6. Save experiments and evaluations only after the schema migration has been reviewed and applied.
7. Only candidates passing every gate can be moved to `eligible_for_review`.
8. An admin may approve for staged testing or reject. This does not deploy anything.

## Database migration

File: `supabase/migrations/20261102000100_nexus_evolution_engine.sql`

Creates four admin-only tables:
- `nexus_experiments`
- `nexus_knowledge_nodes`
- `nexus_knowledge_edges`
- `nexus_evaluations`

Each table enables RLS and has policies requiring a matching row in `nexus_admins`. Explicit Data API grants are limited to `authenticated`; there is no `anon` grant. The migration is committed for review and has NOT been applied to the connected Supabase project.

## Security / privacy boundaries

- Browser code uses only the Supabase publishable client and the signed-in admin session; never use a service-role key in the browser.
- Knowledge nodes support HTTPS source URLs and confidence metadata. Confidence is a review hint, not proof of truth.
- Do not store secrets, credentials, private records, or raw chat transcripts in experiment telemetry.
- Model-generated content is untrusted input and must be validated and reviewed.
- No autonomous production code edits, permission changes, database migrations, or deployments.
- The existing Memory Core opt-in remains off by default.

## Verification still required

- GitHub Actions syntax and deterministic regression suite.
- Browser test on the Pages preview with an admin session.
- Apply migration only after explicit approval; then verify table visibility, RLS and grants with admin and non-admin accounts.
- Test a rejected candidate, a passing candidate, and manual staged-test approval.
- Run the optional VAE script locally with PyTorch; it is not part of CI.
- Perform a measured load test before increasing concurrency or payload limits.

## Free-first note

The code adds no paid service dependency. Existing Cloudflare and Supabase free-tier quotas, account limits, and availability still apply. The local VAE experiment uses open-source PyTorch and synthetic data.
