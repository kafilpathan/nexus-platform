# NEXUS KAF-AI — Current Architecture

## Active deployment shape

- **Frontend:** static HTML/CSS/JavaScript in `nexus_netlify_ready/index.html`. It is hosted separately from the API; the current project uses the Cloudflare Worker endpoint documented below.
- **API/backend:** Cloudflare Worker source in `cloudflare/worker.js`, deployed as `nexus-kaf-ai`.
- **AI:** Cloudflare Workers AI through the `AI` binding and model `@cf/meta/llama-3.1-8b-instruct-fp8`.
- **Identity and database:** Supabase Auth and PostgreSQL.
- **Memory:** `public.nexus_memory`, scoped by `owner_id` and protected by Supabase Row Level Security.
- **Admin authorization:** `public.nexus_admins`; browser actions verify the signed-in user's own admin record and database policies enforce authorization.

The Netlify Functions package under `nexus_netlify_ready/netlify/functions/` is a legacy alternative. It is not the active Cloudflare Worker API. Do not deploy both backends against the same frontend without intentionally changing the API routing.

## Active request flow

### KAF-AI chat

1. The browser sends the current message and a bounded conversation history to `POST /api/chat`.
2. If the user enables memory and has a valid Supabase session, the browser sends the access token as a bearer token.
3. The Worker validates the token with Supabase Auth.
4. The Worker queries only that user's memory using the same JWT and the publishable key, so Supabase RLS remains in force.
5. The Worker supplies a small, ranked set of saved memories as untrusted reference context to Workers AI.
6. The Worker returns the assistant reply and a non-sensitive memory status.

Chat can continue without memory if authentication or memory retrieval is unavailable.

### Community problem feed

- `GET /api/problems` returns the public community problem list.
- `POST /api/problems` validates and stores a submitted problem using the Worker-held service-role key.
- The service-role key must remain server-side. Treat submitted problem details as public content; do not put private or sensitive information in submissions.
- This endpoint currently needs stronger abuse controls before being promoted widely.

### Admin and memory controls

- Supabase Auth manages sign-in and session refresh.
- `nexus_admins` determines admin membership.
- RLS limits memory reads/writes/deletes to the owning authenticated user and restricts designated admin-only records/actions.

## Database migration policy

- Keep schema changes in `supabase/migrations/`.
- Apply migrations to the intended Supabase project in order.
- Verify existing rows satisfy any new constraints before adding them.
- Never place service-role keys, passwords, or access tokens in source control.

## Known limitations to track

- Community problem submission is public and currently has no durable abuse-prevention layer at the Worker route. Add an appropriate challenge/rate-limit control before broad public promotion.
- Chat conversations are stored in the current browser's local storage; they are not a cross-device cloud chat history.
- AI-generated content is not independently verified or web-researched by the chat Worker.
- The legacy Netlify package has a separate API and setup guide; it must not be mistaken for the active Cloudflare deployment.

## Release checks

Before a production deployment, verify:
- Worker root status reports AI and database configuration as present.
- Normal chat returns a non-empty response.
- Chat works with memory disabled.
- Signed-in memory retrieval returns only the current user's records.
- Save Exchange succeeds with the `conversation` category.
- Memory refresh and delete work for the admin owner.
- Non-admin accounts cannot access admin-only records/actions.
- Public problem GET/POST works with valid payloads and rejects invalid payloads.
- No service-role key is present in frontend files, build artifacts, logs, or browser responses.
