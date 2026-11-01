# NEXUS KAF-AI — Mission 005 Improvement Audit

Date: 2026-11-02
Base: main (read-only audit; no production deployment)

## Scope
Memory Core, API/security, chat experience, performance/reliability, and product intelligence.

## Confirmed current architecture
- Static frontend: `nexus_netlify_ready/index.html`
- Active backend source: `cloudflare/worker.js`
- Supabase Auth/PostgreSQL; user memory is protected by RLS.
- Workers AI model: `@cf/meta/llama-3.1-8b-instruct-fp8`
- Browser chat history and evolution history are stored in localStorage.
- Legacy Netlify Functions are not the active backend.

## Findings and priority

### P0 — Public problem submission abuse protection
The Worker accepts unauthenticated `POST /api/problems` and uses a server-side service-role key to insert records. Payload validation and size limits exist, but there is no durable rate limit, challenge, or abuse control. Add a Cloudflare-native rate-limit binding or another durable control, plus a clear 429 response and monitoring. Do not rely on in-memory counters in a horizontally scaled Worker.

### P0 — Memory consent and eligibility are unclear
The chat checkbox says “Use my saved NEXUS memories when signed in”, but it also triggers automatic memory saving. The save function additionally requires admin membership, so ordinary signed-in users may not save even though the label implies sign-in is sufficient. Separate retrieval consent from automatic-save consent, explain the admin restriction, and show save outcomes in the UI.

### P1 — Automatic memory selection is too broad
The save filter treats the word “project” as a project signal and uses a keyword list to skip sensitive content. Keyword filters are not a privacy guarantee. Narrow the project classifier, minimize saved text, make saving status visible, and preserve user-controlled review/delete.

### P1 — Chat history controls and accessibility
The chat stores up to 30 conversations and 60 messages per conversation locally. The current UI has conversation selection and New, but no visible delete/rename/export controls. Add per-chat deletion with confirmation, clearer empty/loading/error states, keyboard/focus behavior, and accessible labels. Do not upload local chat history without explicit consent.

### P1 — Memory Core lifecycle
The Memory Core already supports manual save, refresh, and per-item delete for admin users. Improve filtering/search, category visibility, edit/update, bulk delete with confirmation, and clear explanation of account scope. Keep owner_id scoping and RLS as mandatory boundaries.

### P1 — Admin dashboard
Admin sign-in verifies membership in `nexus_admins`; problem status updates are available. Improve loading/error states, empty states, pagination/search, and ensure database policies—not only frontend checks—enforce admin privileges.

### P2 — AI response quality and reliability
Chat uses a single Workers AI model request with up to 12 history messages and a maximum of 800 generated tokens. Add bounded retries only for transient failures, request timeouts where supported, clearer error classification, response length controls, and regression tests. Do not claim web research or multiple independent agents unless those capabilities are actually connected.

### P2 — Performance and maintainability
The active frontend is a large single HTML file with embedded CSS/JS and several prototype features. Preserve the current deployment shape initially; extract/test modules only after a safe build path exists. Add basic JS syntax checks, Worker unit tests, and a release checklist before production deployment.

## Implementation sequence
1. Establish a test baseline and inspect Supabase policies/migrations.
2. Fix memory consent semantics and visible save/retrieval states.
3. Add durable rate limiting to public problem POST and verify abuse behavior.
4. Improve chat controls and mobile/accessibility behavior.
5. Improve Memory Core search/edit/delete lifecycle and admin dashboard states.
6. Add regression tests and update architecture/release docs.
7. Review PR diff and test results before any deployment.

## Deployment and secrets
- This audit did not deploy or modify Cloudflare, Pages, or Supabase.
- Do not apply migrations or deploy Worker/frontend until explicitly approved.
- Never commit service-role keys, access tokens, passwords, or other secrets.
- Keep the Supabase service-role key exclusively in Worker secrets.
