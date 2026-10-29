const MAX_BODY = 12000;
const recent = new Map();

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(data)
});

function getRoute(event) {
  // With the /api/* rewrite, Netlify may expose either the original path or function path.
  const raw = event.path || '/';
  const path = raw.replace(/^\/.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function parseBody(event) {
  const raw = event.body || '{}';
  if (raw.length > MAX_BODY) throw Object.assign(new Error('Request too large.'), { statusCode: 413 });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Invalid JSON request body.'), { statusCode: 400 }); }
}

function rateLimit(event) {
  const headers = event.headers || {};
  const ip = String(headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const previous = recent.get(ip) || 0;
  if (now - previous < 8000) return false;
  recent.set(ip, now);
  if (recent.size > 3000) {
    for (const [key, time] of recent) if (now - time > 3600000) recent.delete(key);
  }
  return true;
}

function databaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && /^https:\/\//i.test(process.env.SUPABASE_URL));
}
function aiConfigured() {
  return Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
}

async function dbRequest(endpoint, options = {}) {
  if (!databaseConfigured()) throw Object.assign(new Error('Database is not configured. Follow SETUP.md and add the Supabase environment variables in Netlify.'), { statusCode: 503 });
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${base}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    // Do not send provider/database response bodies to the public client; they can expose internal details.
    console.error('Supabase request failed:', response.status, endpoint);
    throw Object.assign(new Error('Database request failed. Check the Supabase URL, key, and schema.'), { statusCode: 502 });
  }
  try { return text ? JSON.parse(text) : []; }
  catch { throw Object.assign(new Error('Unexpected database response.'), { statusCode: 502 }); }
}

async function investigate(problem, constraint) {
  if (!aiConfigured()) throw Object.assign(new Error('KAF-AI is not configured yet. Add AI_API_URL, AI_API_KEY, and AI_MODEL in Netlify environment variables.'), { statusCode: 503 });
  const prompt = `You are KAF-AI, a careful research-planning assistant for NEXUS. Create an investigation plan, not a claim that you solved or researched the problem. Do not invent citations or claim web research. Separate known information from assumptions. Include: 1) goal reframing, 2) assumptions to test, 3) 4-6 research questions, 4) at least three possible approaches with trade-offs, 5) one safe low-risk first experiment, 6) evidence needed and what could disprove each approach, 7) risks and limitations. If the request is unsafe, refuse actionable harmful details and suggest a safe alternative. Keep it clear and practical. Challenge: ${problem}\nConstraint: ${constraint || 'Unknown / needs discovery'}`;
  let response;
  try {
    response = await fetch(process.env.AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: [
          { role: 'system', content: 'You are KAF-AI for NEXUS. Be transparent about uncertainty and never fabricate sources.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });
  } catch {
    throw Object.assign(new Error('Could not reach the AI provider. Check AI_API_URL and network/provider status.'), { statusCode: 502 });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('AI provider request failed:', response.status);
    throw Object.assign(new Error('AI provider request failed. Check the provider URL, model, API key, and account limits.'), { statusCode: 502 });
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error('AI provider returned no text. Check that the configured endpoint supports the OpenAI chat-completions format.'), { statusCode: 502 });
  return {
    investigation: content,
    disclaimer: 'AI-generated planning draft. It may be wrong; verify important claims independently. This endpoint does not perform web research or source verification.'
  };
}

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  const route = getRoute(event);
  try {
    if (method === 'GET' && route === '/health') {
      return json(200, { ok: true, databaseConfigured: databaseConfigured(), aiConfigured: aiConfigured() });
    }

    if (method === 'GET' && route === '/problems') {
      const rows = await dbRequest('nexus_problems?select=id,title,category,details,status,created_at&order=created_at.desc&limit=100');
      return json(200, { problems: rows });
    }

    if (method === 'POST' && route === '/problems') {
      if (!rateLimit(event)) return json(429, { error: 'Please wait a few seconds before submitting again.' });
      const body = parseBody(event);
      const title = String(body.title || '').trim();
      const category = String(body.category || 'Other').trim().slice(0, 80) || 'Other';
      const details = String(body.details || '').trim();
      if (title.length < 3 || title.length > 120 || details.length < 10 || details.length > 3000) {
        return json(400, { error: 'Please provide a title (3–120 characters) and description (10–3000 characters).' });
      }
      const rows = await dbRequest('nexus_problems', { method: 'POST', body: JSON.stringify([{ title, category, details, status: 'Open' }]) });
      return json(201, { problem: rows[0] });
    }

    if (method === 'POST' && route === '/investigate') {
      if (!rateLimit(event)) return json(429, { error: 'Please wait a few seconds before trying again.' });
      const body = parseBody(event);
      const problem = String(body.problem || '').trim();
      const constraint = String(body.constraint || '').trim().slice(0, 200);
      if (problem.length < 8 || problem.length > 1000) return json(400, { error: 'Challenge must be between 8 and 1000 characters.' });
      return json(200, await investigate(problem, constraint));
    }

    return json(404, { error: 'API endpoint not found.' });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('NEXUS API error:', error.message);
    return json(status, { error: status >= 500 ? error.message || 'Unexpected server error.' : error.message });
  }
};
