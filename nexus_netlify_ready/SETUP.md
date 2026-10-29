# NEXUS — Netlify-ready package

This project is structured for a Netlify site with Netlify Functions. It includes the NEXUS website (MindMesh, Impossible Button, Solution Evolution, Global Problem Map), one API function, URL rewrites, and the Supabase schema.

## What works immediately after deployment

- The static website loads.
- `/.netlify/functions/api/health` (also `/api/health`) reports whether database and AI environment variables are present.
- If configured, the API can save and list problem submissions using Supabase.
- If configured, the Impossible Button calls an OpenAI-compatible chat-completions endpoint to create an investigation plan.

## Required configuration

Deployment can complete without credentials, but persistent submissions and live AI will remain disabled until you configure services. Do not put secrets into `index.html` or commit them to GitHub.

### 1. Create the database

1. Create a Supabase project.
2. Open its SQL Editor and run `schema.sql` from this package.
3. In Supabase project settings, copy the project URL and the **service_role** secret key. Keep the service-role key private; it is only used inside the Netlify Function.

### 2. Deploy to Netlify (recommended path)

Netlify needs a Git-based build or Netlify CLI deployment to bundle Functions; uploading the ZIP as a plain static Drop deployment will not deploy the function.

1. Extract this ZIP on your computer.
2. Create a private GitHub repository and upload the *contents* of this folder (so `netlify.toml`, `index.html`, `package.json`, `schema.sql`, and `netlify/functions/api.js` are at the repository root).
3. In Netlify, choose **Add new site / Import an existing project**, connect GitHub, and select the repository.
4. Build command: leave blank. Publish directory: `.`. The included `netlify.toml` declares the functions directory.
5. Deploy the site.

Alternative: install Node.js and Netlify CLI, then run `npm install -g netlify-cli`, `netlify login`, and from this folder run `netlify deploy --build --prod`. Test with `netlify dev` first if desired.

### 3. Add environment variables in Netlify

In the site's environment-variable settings, add these values for the Production deploy context:

- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service-role secret key.
- `AI_API_URL` — an OpenAI-compatible chat-completions endpoint, e.g. `https://api.openai.com/v1/chat/completions` for OpenAI.
- `AI_API_KEY` — the provider's secret API key.
- `AI_MODEL` — a model name enabled for your provider/account.

Save changes and trigger a new deploy so Functions receive the environment variables. API usage may cost money depending on provider and plan.

### 4. Verify deployment

Open `https://YOUR-SITE.netlify.app/api/health`. It should return JSON. After credentials are added and a new deploy is completed, `databaseConfigured` and `aiConfigured` should both be `true`.

Test problem submissions with non-sensitive sample information. The Global Problem Map shows community submissions returned by the database. Do not submit private or sensitive personal information; the current schema stores submitted details and this package does not yet include moderation, user accounts, or spam-resistant CAPTCHA.

## API routes

- `GET /api/health`
- `GET /api/problems`
- `POST /api/problems` JSON `{ "title": "...", "category": "...", "details": "..." }`
- `POST /api/investigate` JSON `{ "problem": "...", "constraint": "..." }`

## Important limitations

- The AI endpoint creates a planning draft. It does not browse the web or independently verify claims/citations.
- In-memory rate limiting is best-effort and can reset between serverless invocations; do not treat it as production-grade abuse protection.
- Public community problem listings are not moderated in this starter. Add moderation/approval and abuse protection before promoting it widely.
