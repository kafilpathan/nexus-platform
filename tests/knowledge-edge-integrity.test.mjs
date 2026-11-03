import test from "node:test";
import assert from "node:assert/strict";
import { validateKnowledgeEdge } from "../cloudflare/knowledge-edge-integrity.js";
const a = "123e4567-e89b-42d3-a456-426614174000";
const b = "123e4567-e89b-42d3-a456-426614174001";
test("normalizes valid edge relations and confidence", () => { const r = validateKnowledgeEdge({ source_node_id: a, target_node_id: b, relation_type: " Supports ", confidence: 0.8 }); assert.equal(r.valid, true); assert.equal(r.edge.relation_type, "supports"); });
test("rejects invalid UUIDs and self edges", () => { assert.equal(validateKnowledgeEdge({ source_node_id: "bad", target_node_id: b, relation_type: "supports" }).valid, false); assert.equal(validateKnowledgeEdge({ source_node_id: a, target_node_id: a, relation_type: "supports" }).valid, false); });
test("rejects malformed relation identifiers", () => { for (const relation_type of ["", "has spaces", "x".repeat(61), "UPPER CASE"]) assert.equal(validateKnowledgeEdge({ source_node_id: a, target_node_id: b, relation_type }).valid, false); });
test("rejects confidence outside inclusive range", () => { for (const confidence of [-0.1, 1.1, NaN, Infinity]) assert.equal(validateKnowledgeEdge({ source_node_id: a, target_node_id: b, relation_type: "supports", confidence }).valid, false); });
test("rejects duplicate directed edges independent of relation case", () => { const existing = [{ source_node_id: a, target_node_id: b, relation_type: "SUPPORTS" }]; const r = validateKnowledgeEdge({ source_node_id: a, target_node_id: b, relation_type: "supports" }, existing); assert.equal(r.valid, false); assert.equal(r.duplicate, true); });
test("allows reverse edge because direction is meaningful", () => { const existing = [{ source_node_id: a, target_node_id: b, relation_type: "supports" }]; assert.equal(validateKnowledgeEdge({ source_node_id: b, target_node_id: a, relation_type: "supports" }, existing).valid, true); });

import { normalizeKnowledgeEdgeProvenance } from "../cloudflare/knowledge-edge-integrity.js";
test("normalizes HTTPS edge provenance without claiming authenticity", () => {
  const p = normalizeKnowledgeEdgeProvenance({
    source_url: "https://example.org/evidence",
    source_title: " Evidence ",
    content_sha256: "B".repeat(64),
    captured_at: "2026-11-04T00:00:00Z"
  });
  assert.equal(p.source_url, "https://example.org/evidence");
  assert.equal(p.source_title, "Evidence");
  assert.equal(p.content_sha256, "b".repeat(64));
  assert.equal(p.verification_status, "unverified");
});
test("rejects insecure edge provenance and malformed digests", () => {
  assert.throws(() => normalizeKnowledgeEdgeProvenance({ source_url: "http://example.org" }), TypeError);
  assert.throws(() => normalizeKnowledgeEdgeProvenance({ content_sha256: "not-a-hash" }), TypeError);
});

test("rejects null and empty confidence instead of coercing them to zero", () => {
  for (const confidence of [null, ""]) {
    assert.equal(validateKnowledgeEdge({ source_node_id: a, target_node_id: b, relation_type: "supports", confidence }).valid, false);
  }
});
