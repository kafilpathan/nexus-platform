Mission 004 — KAF-AI Problem Analyzer

Goal

Turn real-world problems into evidence-aware, actionable solution plans. Preserve the existing NEXUS website and Mission Board.

Architecture

- Frontend: Existing HTML, CSS and JavaScript deployed on Netlify.
- Backend API: Netlify Function at "netlify/functions/analyze-problem.js".
- AI engine: KAF-AI, powered by a server-side AI API.
- Database and authentication: Supabase PostgreSQL and Supabase Auth.

Request Flow

1. User submits a real-world problem.
2. Backend validates the input and request size.
3. Authentication and rate limits are checked.
4. KAF-AI analyzes the problem and generates structured solutions.
5. Backend validates the AI response and handles errors safely.
6. Problems, analyses and solutions are stored securely.
7. Frontend displays practical action steps.
8. Users provide feedback and report measured outcomes.

Initial Database Tables

1. problems

- id
- owner_id
- title
- description
- category
- visibility
- status
- created_at

2. analyses

- id
- problem_id
- model_version
- summary
- assumptions
- created_at

3. solutions

- id
- analysis_id
- description
- benefits
- costs
- risks

4. sources

- id
- analysis_id
- url
- title
- published_at
- supporting_claim

5. action_steps

- id
- solution_id
- title
- status
- due_at

6. outcomes

- id
- solution_id
- metric_name
- target_value
- actual_value
- recorded_at

7. feedback

- id
- analysis_id
- rating
- comments
- created_at

Use UUID primary keys, foreign keys, timestamps and appropriate indexes. Define access policies before allowing users to access database records.

Security

- Never expose AI API keys in frontend JavaScript.
- Never commit passwords, tokens or credentials to GitHub.
- Validate user inputs and AI outputs.
- Apply authentication, authorization and rate limits.
- Protect private user data with database access policies.
- Do not present AI-generated claims as verified facts without checking sources.

Rollout Plan

1. Review this architecture and database schema.
2. Create a Supabase project and version-controlled database migrations.
3. Build a protected test API endpoint.
4. Test representative problems and expected responses.
5. Integrate the existing frontend only after testing.
6. Monitor errors, latency, API costs and user feedback.

Acceptance Criteria

- Existing NEXUS website and Mission Board continue working.
- API secrets never reach the browser.
- Invalid inputs and failed AI requests produce safe error responses.
- Unauthorized users cannot access private records.
- KAF-AI returns structured analyses that can be tested.
- Solutions include benefits, costs, risks and actionable steps.
- User feedback can be collected to evaluate real-world outcomes.
