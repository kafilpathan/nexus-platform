import test from "node:test";
import assert from "node:assert/strict";
import { parseKnowledgeTraversalOptions } from "../cloudflare/knowledge-traversal-options.js";
test("uses safe defaults for traversal options", () => {
  assert.deepEqual(parseKnowledgeTraversalOptions(new URLSearchParams()), {
    valid: true, maxDepth: 2, maxNodes: 50, direction: "outgoing", relationType: null, minConfidence: null
  });
});
test("clamps positive traversal limits and accepts valid filters", () => {
  const params = new URLSearchParams({ max_depth: "8", max_nodes: "500", direction: "both", relation_type: "supports", min_confidence: "0.7" });
  assert.deepEqual(parseKnowledgeTraversalOptions(params), {
    valid: true, maxDepth: 3, maxNodes: 100, direction: "both", relationType: "supports", minConfidence: 0.7
  });
});
test("rejects partial, blank, non-positive, and malformed traversal parameters", () => {
  const invalid = [
    { max_depth: "2abc" }, { max_depth: "" }, { max_depth: "0" },
    { max_nodes: "3x" }, { max_nodes: "" }, { max_nodes: "-1" },
    { direction: "sideways" }, { relation_type: "bad relation" },
    { min_confidence: "" }, { min_confidence: "1.1" }
  ];
  for (const values of invalid) assert.equal(parseKnowledgeTraversalOptions(new URLSearchParams(values)).valid, false);
});
