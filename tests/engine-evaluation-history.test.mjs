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
    assert.equal(body.sha256_match, true);
    assert.equal(body.actual_sha256, evaluation.evidence.evidence_integrity.sha256);
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
    assert.equal(body.sha256_match, false);
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

test("evidence verification returns not found for a valid but unknown ID", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations/123e4567-e89b-42d3-a456-426614174098/verify", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 404);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_evaluations")), true);
  } finally {
    mock.restore();
  }
});

test("knowledge node route rejects empty confidence before database lookup", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/nodes", {
      method: "POST",
      headers: { Authorization: "Bearer test-session", "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Validation test node",
        node_type: "concept",
        description: "A test node for confidence validation.",
        confidence: ""
      })
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_knowledge_nodes")), false);
  } finally {
    mock.restore();
  }
});

test("knowledge traversal rejects malformed limits before database reads", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/traverse?start_node_id=123e4567-e89b-42d3-a456-426614174000&max_depth=2abc", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_knowledge_nodes") || call.url.includes("/rest/v1/nexus_knowledge_edges")), false);
  } finally {
    mock.restore();
  }
});

test("evaluation history rejects a blank experiment filter before database query", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/evaluations?experiment_id=", {
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

test("knowledge traversal caps returned edges without truncating discovered nodes", async () => {
  const originalFetch = globalThis.fetch;
  const start = "123e4567-e89b-42d3-a456-426614174000";
  const b = "123e4567-e89b-42d3-a456-426614174001";
  const c = "123e4567-e89b-42d3-a456-426614174002";
  const d = "123e4567-e89b-42d3-a456-426614174003";
  const edges = [
    { id: "ab", source_node_id: start, target_node_id: b, relation_type: "supports", confidence: 0.9 },
    { id: "ac", source_node_id: start, target_node_id: c, relation_type: "supports", confidence: 0.9 },
    { id: "bd", source_node_id: b, target_node_id: d, relation_type: "supports", confidence: 0.9 }
  ];
  const nodes = [start, b, c, d].map(id => ({ id, label: id, node_type: "concept", description: "", confidence: 0.9 }));
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: adminId }), { status: 200 });
    if (target.includes("/rest/v1/nexus_admins")) return new Response(JSON.stringify([{ user_id: adminId }]), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_edges?")) return new Response(JSON.stringify(edges), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_nodes?id=eq.")) return new Response(JSON.stringify([nodes[0]]), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_nodes?select=")) return new Response(JSON.stringify(nodes), { status: 200 });
    throw new Error("Unexpected request: " + target);
  };
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/traverse?start_node_id=" + start + "&max_depth=2&max_nodes=10&max_edges=1", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.traversal.edges.length, 1);
    assert.equal(body.traversal.edges_truncated, true);
    assert.deepEqual(body.traversal.nodes.map(node => node.id), [start, b, c, d]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge traversal rejects invalid max_edges before database reads", async () => {
  const mock = mockSupabase([]);
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/traverse?start_node_id=123e4567-e89b-42d3-a456-426614174000&max_edges=0", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 400);
    assert.equal(mock.calls.some(call => call.url.includes("/rest/v1/nexus_knowledge_nodes") || call.url.includes("/rest/v1/nexus_knowledge_edges")), false);
  } finally {
    mock.restore();
  }
});

test("knowledge traversal reports edge targets missing from node storage", async () => {
  const originalFetch = globalThis.fetch;
  const start = "123e4567-e89b-42d3-a456-426614174000";
  const found = "123e4567-e89b-42d3-a456-426614174001";
  const missing = "123e4567-e89b-42d3-a456-426614174002";
  const edges = [
    { id: "ab", source_node_id: start, target_node_id: found, relation_type: "supports", confidence: 0.8 },
    { id: "ac", source_node_id: start, target_node_id: missing, relation_type: "supports", confidence: 0.8 }
  ];
  const rows = [
    { id: start, label: "start", node_type: "concept", description: "", confidence: 1 },
    { id: found, label: "found", node_type: "concept", description: "", confidence: 0.8 }
  ];
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: adminId }), { status: 200 });
    if (target.includes("/rest/v1/nexus_admins")) return new Response(JSON.stringify([{ user_id: adminId }]), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_edges?")) return new Response(JSON.stringify(edges), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_nodes?id=eq.")) return new Response(JSON.stringify([rows[0]]), { status: 200 });
    if (target.includes("/rest/v1/nexus_knowledge_nodes?select=")) return new Response(JSON.stringify(rows), { status: 200 });
    throw new Error("Unexpected request: " + target);
  };
  try {
    const request = new Request("https://nexus.test/api/engine/knowledge/traverse?start_node_id=" + start + "&max_depth=1", {
      headers: { Authorization: "Bearer test-session" }
    });
    const response = await handleEngineRequest(request, {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key"
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.integrity.missing_node_ids, [missing]);
    assert.equal(body.integrity.missing_node_count, 1);
    assert.deepEqual(body.integrity.dangling_edge_ids, ["ac"]);
    assert.equal(body.integrity.dangling_edge_count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
