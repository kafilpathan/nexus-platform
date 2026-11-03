import test from "node:test";
import assert from "node:assert/strict";
import { handleEngineRequest } from "../cloudflare/engine.js";

const adminId = "123e4567-e89b-42d3-a456-426614174000";
function mockSupabase(evaluations = []) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, method: options.method || "GET" });
    if (target.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: adminId }), { status: 200 });
    if (target.includes("/rest/v1/nexus_admins")) return new Response(JSON.stringify([{ user_id: adminId }]), { status: 200 });
    if (target.includes("/rest/v1/nexus_evaluations")) return new Response(JSON.stringify(evaluations), { status: 200 });
    throw new Error("Unexpected test request: " + target);
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("evaluation history endpoint requires a bearer session", async () => {
  const response = await handleEngineRequest(new Request("https://nexus.test/api/engine/evaluations"), {});
  assert.equal(response.status, 401);
});

test("evaluation history endpoint applies filters and returns page metadata", async () => {
  const mock = mockSupabase([{ id: "evaluation-1", passed: true }]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations?limit=5&offset=10&passed=true&experiment_id=" + adminId, {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 1);
    assert.deepEqual(body.page, { limit: 5, offset: 10, returned: 1, next_offset: null });
    const query = decodeURIComponent(mock.calls.find(call => call.url.includes("/rest/v1/nexus_evaluations")).url);
    assert.match(query, /experiment_id=eq\./);
    assert.match(query, /passed=eq.true/);
    assert.match(query, /limit=5/);
    assert.match(query, /offset=10/);
  } finally {
    mock.restore();
  }
});

test("invalid evaluation history filters return 400 before querying evaluations", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations?limit=500", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_evaluations")), false);
  } finally {
    mock.restore();
  }
});

test("evaluation history query includes a stable ID tie-breaker", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations?limit=5", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const query = mock.calls.find(call => call.url.includes("/rest/v1/nexus_evaluations")).url;
    assert.match(query, /order=created_at\.desc%2Cid\.desc/);
  } finally {
    mock.restore();
  }
});
