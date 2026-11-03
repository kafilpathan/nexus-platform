import test from "node:test";
import assert from "node:assert/strict";
import workerModule from "../cloudflare/worker.js";

const worker = workerModule.default;

function aiBinding() {
  let calls = 0;
  return {
    async run() {
      calls += 1;
      if (calls === 1) return { response: "A short test response." };
      return { response: JSON.stringify({
        factual_grounding: 4,
        source_alignment: 3,
        uncertainty_handling: 4,
        completeness: 4,
        unsupported_claims: [],
        missing_caveats: [],
        verdict: "strong"
      }) };
    }
  };
}

async function chatRequest(env, body, headers = {}) {
  return worker.fetch(new Request("https://nexus.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  }), env);
}

test("health endpoint reports service and limiter configuration without secrets", async () => {
  const response = await worker.fetch(new Request("https://nexus.test/"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project, "NEXUS KAF-AI");
  assert.equal(body.problemRateLimit, "not_configured");
});

test("memory diagnostics distinguish an opted-in request without a bearer token", async () => {
  const response = await chatRequest({ AI: aiBinding() }, {
    message: "hello",
    messages: [{ role: "user", content: "hello" }],
    useMemory: true
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.memory, {
    status: "missing_token",
    count: 0,
    stage: "request",
    httpStatus: null
  });
  assert.equal(JSON.stringify(body).includes("Bearer"), false);
});

test("memory diagnostics distinguish missing Worker configuration without exposing the token", async () => {
  const response = await chatRequest({ AI: aiBinding() }, {
    message: "hello",
    messages: [{ role: "user", content: "hello" }],
    useMemory: true
  }, { Authorization: "Bearer test-token-not-to-leak" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.memory.status, "missing_config");
  assert.equal(body.memory.stage, "worker_config");
  assert.equal(body.memory.httpStatus, null);
  assert.equal(JSON.stringify(body).includes("test-token-not-to-leak"), false);
});

test("public problem submissions return 429 when the configured limiter rejects", async () => {
  const response = await worker.fetch(new Request("https://nexus.test/api/problems", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify({ title: "Test problem", category: "Other", details: "A sufficiently detailed test problem." })
  }), {
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    PROBLEM_RATE_LIMIT: { async limit() { return { success: false }; } }
  });
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.match(body.error, /Too many submissions/);
});

test("public problem submissions fail closed when the configured limiter errors", async () => {
  const response = await worker.fetch(new Request("https://nexus.test/api/problems", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify({ title: "Test problem", category: "Other", details: "A sufficiently detailed test problem." })
  }), {
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    PROBLEM_RATE_LIMIT: { async limit() { throw new Error("internal limiter detail"); } }
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /temporarily unavailable/);
  assert.equal(JSON.stringify(body).includes("internal limiter detail"), false);
});
