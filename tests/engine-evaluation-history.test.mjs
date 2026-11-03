import test from "node:test";
import assert from "node:assert/strict";
import { handleEngineRequest } from "../cloudflare/engine.js";
import { webcrypto } from "node:crypto";
import { createEvidenceIntegrityManifest, createPerCaseIntegrityManifests } from "../cloudflare/evidence-integrity.js";
globalThis.crypto ||= webcrypto;

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
    assert.match(query, /order=created_at\.desc,id\.desc/);
  } finally {
    mock.restore();
  }
});

const evaluationId = "123e4567-e89b-42d3-a456-426614174099";
async function makeVerifiedEvaluation(results) {
  const suiteVersion = "suite-test-v1";
  const fingerprint = "fingerprint-test";
  const evidenceIntegrity = await createEvidenceIntegrityManifest({
    suite_version: suiteVersion,
    reproducibility_fingerprint: fingerprint,
    results
  }, webcrypto);
  const perCaseIntegrity = await createPerCaseIntegrityManifests(results, webcrypto);
  return {
    id: evaluationId,
    suite_version: suiteVersion,
    evidence: {
      results,
      reproducibility: { fingerprint },
      evidence_integrity: evidenceIntegrity,
      per_case_integrity: perCaseIntegrity
    }
  };
}
test("evidence verification endpoint confirms intact aggregate and per-case manifests", async () => {
  const results = [{ case_id: "quality-1", score: 1 }, { case_id: "safety-1", score: 1 }];
  const evaluation = await makeVerifiedEvaluation(results);
  const mock = mockSupabase([evaluation]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations/" + evaluationId + "/verify", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.verified, true);
    assert.equal(body.per_case_integrity.checked_count, 2);
    assert.deepEqual(body.per_case_integrity.mismatched_case_ids, []);
  } finally {
    mock.restore();
  }
});
test("evidence verification endpoint identifies tampered case IDs", async () => {
  const original = [{ case_id: "quality-1", score: 1 }, { case_id: "safety-1", score: 1 }];
  const evaluation = await makeVerifiedEvaluation(original);
  evaluation.evidence.results[1].score = 0;
  const mock = mockSupabase([evaluation]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations/" + evaluationId + "/verify", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.verified, false);
    assert.match(body.reason, /aggregate or per-case integrity manifest/);
    assert.deepEqual(body.per_case_integrity.mismatched_case_ids, ["safety-1"]);
  } finally {
    mock.restore();
  }
});

test("knowledge edge route rejects malformed provenance before database writes", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/edges", {
      method: "POST",
      headers: { Authorization: "Bearer test-session", "Content-Type": "application/json" },
      body: JSON.stringify({
        source_node_id: "123e4567-e89b-42d3-a456-426614174000",
        target_node_id: "123e4567-e89b-42d3-a456-426614174001",
        relation_type: "supports",
        confidence: 0.8,
        provenance: { content_sha256: "bad-digest" }
      })
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_knowledge_edges")), false);
  } finally {
    mock.restore();
  }
});

test("verification route rejects a malformed evaluation identifier", async () => {
  const mock = mockSupabase([]);
  try {
    const response = await handleEngineRequest(new Request("https://nexus.test/api/engine/evaluations/bad/verify", {
      headers: { Authorization: "Bearer test-session" }
    }), { SUPABASE_URL: "https://supabase.test", SUPABASE_PUBLISHABLE_KEY: "test-key" });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_evaluations")), false);
  } finally { mock.restore(); }
});
