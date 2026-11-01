# NEXUS KAF-AI

NEXUS is a static web frontend connected to a Cloudflare Worker backend, Cloudflare Workers AI, and Supabase Auth/PostgreSQL.

## Source of truth

- Frontend: `nexus_netlify_ready/index.html`
- Cloudflare Worker: `cloudflare/worker.js`
- Worker configuration guide: `cloudflare/README.md`
- Database migrations: `supabase/migrations/`
- Current architecture and release checks: `docs/mission-004archtecture.md`

The Netlify Functions package under `nexus_netlify_ready/netlify/` is a legacy alternative, not the active Cloudflare Worker backend.

## Core features

- KAF-AI chat through Cloudflare Workers AI.
- Optional per-user memory retrieval using Supabase Auth and RLS.
- Admin-only memory and project controls.
- Public community problem feed.

## Safe deployment sequence

1. Review the changes on a branch and run the release checks in the architecture guide.
2. Apply pending Supabase migrations to the intended project.
3. Deploy the reviewed Worker source and verify its root status endpoint.
4. Deploy the static frontend.
5. Test chat, memory-disabled chat, signed-in memory, admin actions, and community problem submission.

Never commit secrets. Keep the Supabase service-role key in Cloudflare Worker secrets only; the browser may contain only the publishable/anon key.
