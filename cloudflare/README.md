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


## Public problem submission rate limiting

The Worker supports an optional Cloudflare Rate Limiting binding named
`PROBLEM_RATE_LIMIT`. When configured, it checks anonymous problem submissions
before writing to Supabase and returns HTTP 429 when the configured threshold is
exceeded.

Configure the binding on the `nexus-kaf-ai` Worker (or in the Wrangler
configuration used to deploy it):

- Binding name: `PROBLEM_RATE_LIMIT`
- Unique namespace ID: choose a positive integer that is not already used by
  another rate-limit namespace in this Cloudflare account.
- Suggested initial threshold: 5 requests per 60 seconds.
- Use the key provided by the Worker, which is based on the request IP because
  this is a public anonymous endpoint.

The built-in Cloudflare limiter is approximate and counters are local to
Cloudflare locations; it is not a strict global quota. IP-based limits can also
affect multiple people sharing a network. Review the current Cloudflare
Rate Limiting documentation before deployment:
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

The Worker root status response reports `problemRateLimit` as
`configured` or `not_configured`. A missing binding does not block existing
submissions, so the route remains backward-compatible; do not promote public
submissions widely until the binding is configured and a 429 test has passed.
