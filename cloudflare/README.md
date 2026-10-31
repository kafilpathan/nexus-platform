# NEXUS KAF-AI Cloudflare Worker

This file is the version-controlled source for the deployed Worker.

## Bindings and variables

Keep the existing bindings/secrets:
- `AI`: Cloudflare Workers AI binding.
- `SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: existing secret used only by the legacy `/api/problems` route.

Add one Worker secret/variable:
- `SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable (or legacy anon) key. This is a public project key, but configure it as a Worker variable for consistent deployment.

Do not put the service-role key in frontend code or expose it to the model.

## Memory retrieval v1

The chat frontend sends the current Supabase access token only when the user enables the memory checkbox. The Worker validates it through Supabase Auth, then queries `nexus_memory` using that same user JWT and the publishable key. Supabase RLS remains the authorization boundary. The Worker does not use the service-role key for memory retrieval.

It fetches at most 30 of the signed-in user's rows, ranks them by keyword overlap with the current/recent user messages, and supplies at most 5 matching memories (6,000 characters total) as untrusted reference context. If authentication or retrieval fails, normal chat continues without memory.

## Deploy

1. In Cloudflare Dashboard, open Workers & Pages > `nexus-kaf-ai` > Settings > Variables and Secrets.
2. Add `SUPABASE_PUBLISHABLE_KEY` using the project's publishable key (the same public key already used by the frontend).
3. Open Edit Code and replace the Worker source with `cloudflare/worker.js`.
4. Save and Deploy only after reviewing this change.
5. Test the root status endpoint, normal chat, signed-in memory chat, and chat with the memory checkbox disabled.

No deployment is performed by this repository change.
