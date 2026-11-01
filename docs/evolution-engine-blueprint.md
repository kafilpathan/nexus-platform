# NEXUS KAF-AI — Evolution Engine Blueprint

Status: prototype foundation; no production deployment.
Branch: `mission-005-complete-improvements`

## Product goal

Evolve NEXUS from a single-model chat interface into a modular, evidence-led AI platform. The system may generate candidate improvements and evaluate them in a sandbox, but it must not silently rewrite production code, database policies, secrets, prompts, or model configuration.

## Architecture

```text
User request
    |
Chat + existing Workers AI
    |
Orchestrator / policy boundary
    +--> Generative proposals (later)
    +--> Knowledge retrieval (Memory Core + reviewed graph)
    +--> Hybrid reasoning (rules + model)
    |
Evaluation harness
    +--> quality / correctness / latency / cost / safety checks
    +--> Evolution Engine (bounded parameter search)
    |
Experiment ledger
    |
Human review -> CI -> staged release -> approved deployment
```

## Seven modules

1. **Generative models:** initially use the existing Workers AI inference binding for text proposals. GAN/VAE training is a later research track; begin with small, public, properly licensed datasets and CPU-sized experiments. Do not imply that prompting an inference model is model training.
2. **Evolutionary algorithms:** v1 is a seeded genetic optimizer for bounded numeric settings. Its fitness function is trusted application code, not generated/evaluated user-supplied JavaScript. Candidate results remain experimental.
3. **Self-improvement:** collect explicit, privacy-minimized feedback and run a fixed regression suite. The system can recommend changes, not approve them.
4. **Scalability:** keep Worker request handling stateless; bound payloads, histories, and experiment sizes. Use Postgres for durable records and queues only when measured load requires them.
5. **Knowledge integration:** retain Supabase/Postgres as the source of truth; add normalized entity/relationship tables and source/provenance fields before considering a graph extension. Memory remains user-scoped by RLS.
6. **Hybrid AI:** combine deterministic validation/rules with model-generated explanations and candidate plans. Rules enforce permissions and safety; model output never grants access.
7. **Continuous learning:** version datasets, evaluation cases, prompts, and candidate configs. Run offline evaluation -> human review -> staged rollout -> monitoring -> rollback. No unattended online weight updates.

## Free-first technology choices

| Need | First choice | Notes |
|---|---|---|
| Existing inference | Current Cloudflare Workers AI binding | Already integrated; observe account quotas/limits |
| Evolution prototype | Native JavaScript ES modules | No new service or paid dependency |
| Tests | Node.js built-in test/assert tools | Run in GitHub Actions |
| Durable experiment records | Existing Supabase Postgres | Add tables/migrations only after schema review |
| Knowledge graph | Relational node/edge tables in Postgres | Avoid adding graph infrastructure prematurely |
| Small model experiments | PyTorch CPU / scikit-learn locally | Training quality and speed depend on hardware |
| Version control/release | GitHub + Actions | PR review and CI before release |

"Free" means no additional paid service is required by this prototype; existing provider quotas and hosting limits still apply. Do not send private user data to public datasets or third-party services.

## Evolution Engine v1

File: `evolution/engine.mjs`

- deterministic seeded pseudo-random generator for repeatable experiments;
- finite numeric search bounds;
- tournament selection, uniform crossover, bounded mutation, and elitism;
- explicit finite fitness scores;
- immutable result summary and per-generation best score;
- hard caps on population and generation count.

This optimizes application-level numeric settings only. It does not train neural network weights, discover a new architecture automatically, or prove a candidate is better in production.

## Evaluation contract

Each experiment should record: experiment ID, code/version hash, dataset/evaluation-suite version, parameter bounds, seed, fitness definition, baseline score, candidate score, run timestamp, and reviewer decision. Do not store raw private chat content as experiment telemetry.

A candidate is eligible for review only if it:
- passes syntax, unit, regression, privacy, and security checks;
- beats the baseline on the predeclared objective;
- does not regress critical safety or correctness cases;
- has a documented rollback path.

## Implementation sequence

- [x] Make Memory Core retrieval/auto-save an explicit opt-in by default.
- [x] Add the isolated genetic-search prototype and deterministic tests.
- [x] Add CI execution of optimizer, assessor, graph, hybrid-rule, and proposal-adapter tests.
- [x] Add an admin-only Evolution Engine workspace with proposal generation, genetic search, self-assessment, experiment review, and knowledge graph controls.
- [x] Design an admin-only Supabase experiment/knowledge/evaluation schema with RLS and explicit authenticated grants; migration file is committed but not applied.
- [x] Add provenance-aware knowledge nodes/edges and bounded graph traversal.
- [x] Add hybrid rules that block privileged actions and keep model output untrusted.
- [x] Add an isolated local PyTorch VAE research script using synthetic data only.
- [x] Define gated experiment review and CI as the continuous-improvement loop; no unattended production release.
- [ ] Apply the migration only after explicit approval, then test admin and non-admin access.
- [ ] Run browser integration tests, measured load tests, and the optional local VAE training experiment.
- [ ] Define production monitoring and rollback before any staged release.

## Security and deployment boundary

No automatic production code edits, schema changes, secret changes, or deployments. All model-generated proposals are untrusted data. Require human approval and passing CI before merge; require separate explicit approval for production deployment.
