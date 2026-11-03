# NEXUS KAF-AI Cloudflare Worker

This is the version-controlled source for the Cloudflare Worker backend. The static frontend lives at `nexus_netlify_ready/index.html`; the Netlify Functions package in that folder is a legacy alternative and is not the active Worker backend.

## Bindings and variables

Keep the existing bindings/secrets:
- `AI`: Cloudflare Workers AI binding.
- `SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: secret used only by the public community-problems API proxy. Never expose it to the browser or model.

Required Worker variable:
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable (or legacy anon) key. It is a public project key, but configure it as a Worker variable for consistent deployment.

Do not put the service-role key in frontend code or expose it to the model.

## Memory retrieval

The chat frontend sends the current Supabase access token only when the user enables the memory checkbox. The Worker validates it through Supabase Auth, then queries `nexus_memory` using that same user's JWT and the publishable key. Supabase RLS remains the authorization boundary. The Worker does not use the service-role key for memory retrieval.

It fetches at most 30 of the signed-in user's rows, ranks them by keyword overlap with the current/recent user messages, and supplies at most 5 matching memories (6,000 characters total) as untrusted reference context. If authentication or retrieval fails, normal chat continues without memory.

Supported memory categories are `project`, `decision`, `preference`, `milestone`, `lesson`, and `conversation`. The `conversation` category is required by the chat's **Save exchange to Memory** action.

## API input validation

- Chat JSON bodies are capped at 64 KB; community-problem JSON bodies are capped at 8 KB.
- Malformed JSON, null values, arrays, and oversized payloads receive client errors (400/413), not generic server errors.
- Chat messages remain limited to 4,000 characters and problem fields retain their database-aligned limits.

## Deploy and verify

1. In Cloudflare Dashboard, open Workers & Pages > `nexus-kaf-ai` > Settings > Variables and Secrets.
2. Confirm `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` exist. Keep secret values private.
3. Confirm the `AI` Workers AI binding is attached.
4. Review `cloudflare/worker.js` before deploying it.
5. Test the root status endpoint, normal chat, signed-in memory chat, chat with the memory checkbox disabled, and the public problem feed.

Database changes are versioned under `supabase/migrations/`. Apply each pending migration to the intended Supabase project before deploying frontend code that depends on it. Never paste service-role keys into GitHub or chat.

No Cloudflare deployment is performed by a repository change alone.


## Admin Evolution & Knowledge API

The Worker also exposes admin-only endpoints under `/api/engine/*`. Every request requires a Supabase access token in the Authorization bearer header; the Worker verifies the user with Supabase Auth and checks `public.nexus_admins` using that same user JWT. Database writes remain subject to RLS.

- `GET /api/engine/overview`: recent experiments, evaluations and knowledge graph records.
- `POST /api/engine/experiments`: create a proposed experiment.
- `POST /api/engine/evaluate`: execute the same 3–12 benchmark cases against baseline and candidate system prompts using the Worker AI binding. Requires at least one quality case and one safety case with forbidden terms. The server calculates quality, safety, baseline improvement and regressions; caller-supplied scores are not accepted.
- `POST /api/engine/rollback`: mark an approved experiment as rolled back and record the reason. This records governance history; it does not perform a Cloudflare deployment rollback.
- `POST /api/engine/experiments/review`: an admin explicitly approves or rejects an eligible experiment.
- `POST /api/engine/knowledge/nodes` and `POST /api/engine/knowledge/edges`: add sourced knowledge graph records.

The five parts form one Evolution Core: benchmark evaluation, experiment proposals, sourced knowledge graph, human approval/rollback governance, and dashboard data from `GET /api/engine/overview`. The candidate model also returns a self-declaration (`successful`, `partially_successful`, or `not_successful`) with confidence and rationale. This declaration is stored separately and never overrides server-calculated benchmark results. An experiment becomes eligible for review only when quality ≥ 0.80, safety ≥ 0.95, regression count is zero, and candidate quality is not below baseline. Human approval is still required. No endpoint deploys code, changes Worker settings, or autonomously modifies production behavior.

Apply `supabase/migrations/20261104000000_unified_evolution_core.sql` before deploying this Worker. The migration creates the experiment, evaluation, knowledge graph and evolution-version tables with admin-only RLS. Knowledge contradictions can be represented explicitly with a `contradicts` edge.


## Memory Core diagnostics and consent

Memory use is off by default. The chat checkbox is explicit opt-in for per-user memory retrieval and eligible project-chat auto-save. Auto-save is limited to messages containing an explicit NEXUS/KAF-AI/Memory Core/Cloudflare Worker/Supabase signal and excludes common sensitive-data terms. This keyword filter is a minimization aid, not a privacy guarantee. Auto-save remains admin-only.

When memory is enabled, chat responses may include only fixed diagnostic labels (`status`, `stage`) and a numeric upstream HTTP status. Diagnostics never include bearer tokens, user IDs, memory contents, or upstream response bodies. Normal chat continues if memory retrieval fails.

## Public problem submission rate limiting

The Worker supports an optional Cloudflare Rate Limiting binding named `PROBLEM_RATE_LIMIT`. It is intentionally not assumed to exist until configured on the `nexus-kaf-ai` Worker. Suggested initial threshold: 5 requests per 60 seconds. The key uses the `CF-Connecting-IP` header because this endpoint currently accepts anonymous submissions; this can group users behind the same mobile carrier, school, office, or household connection. Cloudflare's built-in limiter is approximate and counters are separate per Cloudflare location, so it is an abuse-reduction control rather than a strict global quota. A limited request receives HTTP 429. If a configured limiter errors, the Worker fails closed with HTTP 503. If the binding is absent, the endpoint remains backward-compatible but is not rate limited; the root status endpoint reports `problemRateLimit: not_configured`.

### Cloudflare configuration

Cloudflare's current Wrangler configuration uses the top-level `ratelimits` array. Merge this entry into the existing Worker configuration (do not replace existing AI bindings, variables, compatibility settings, or build settings):

```jsonc
{
  "ratelimits": [
    {
      "name": "PROBLEM_RATE_LIMIT",
      "namespace_id": "REPLACE_WITH_A_UNIQUE_POSITIVE_INTEGER_FOR_THIS_CLOUDFLARE_ACCOUNT",
      "simple": { "limit": 5, "period": 60 }
    }
  ]
}
```

The namespace ID must be a positive integer represented as a string and unique to the Cloudflare account for an independent counter. Choose/check it in the account's deployment configuration; do not copy an ID from another account. If this Worker is configured only through the Cloudflare dashboard, add the same binding under the Worker's Settings → Bindings → Rate limiting and set the variable name to `PROBLEM_RATE_LIMIT`, the unique namespace ID, 5 requests, and 60 seconds. If the current dashboard UI does not offer this binding, deploy the merged Wrangler configuration with Wrangler 4.36.0 or later.

After deploying, call the Worker root endpoint and confirm `problemRateLimit` is `configured`. Then submit more than five valid test requests from the same network within 60 seconds and confirm a later request returns HTTP 429. Do not use real private data in test submissions. The binding is not active until both checks pass.

### Deployment boundary

A GitHub merge or Cloudflare Pages frontend deployment does not configure a Worker binding. The repository currently has no Cloudflare account-management connection, so the binding must be attached in the Cloudflare account or deployed from its Wrangler configuration. Never paste Cloudflare API tokens or Supabase secrets into chat or source control.

## Supabase Auth password protection

The connected Supabase project currently belongs to the Free plan. Supabase's built-in leaked-password protection (Have I Been Pwned Pwned Passwords check) is available on the Pro plan and above, so this setting cannot be enabled on the current plan. No plan upgrade or paid change is being made. If the project is upgraded later, enable it in Supabase Dashboard → Authentication → Password Security and rerun the Security Advisor. See https://supabase.com/docs/guides/auth/password-security.

The Security Advisor currently reports this as a warning, not a database migration issue. Do not try to imitate this control by sending raw passwords from the browser or Worker to a third-party service.
