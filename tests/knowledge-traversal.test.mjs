import test from "node:test";
import assert from "node:assert/strict";
import { traverseKnowledgeGraph } from "../cloudflare/knowledge-traversal.js";

test("traverses graph breadth-first within depth and node limits", () => {
  const result = traverseKnowledgeGraph([
    { id: "e1", source_node_id: "a", target_node_id: "b" },
    { id: "e2", source_node_id: "a", target_node_id: "c" },
    { id: "e3", source_node_id: "b", target_node_id: "d" },
    { id: "e4", source_node_id: "d", target_node_id: "e" }
  ], "a", 2, 10);
  assert.deepEqual(result.nodes.map(node => [node.id, node.depth]), [["b", 1], ["c", 1], ["d", 2]]);
});

test("traversal avoids cycles and repeated nodes", () => {
  const result = traverseKnowledgeGraph([
    { id: "e1", source_node_id: "a", target_node_id: "b" },
    { id: "e2", source_node_id: "b", target_node_id: "a" },
    { id: "e3", source_node_id: "b", target_node_id: "c" }
  ], "a", 3, 10);
  assert.deepEqual(result.nodes.map(node => node.id), ["b", "c"]);
});

test("traversal clamps limits and rejects invalid input", () => {
  const result = traverseKnowledgeGraph([{ source_node_id: "a", target_node_id: "b" }], "a", 99, 999);
  assert.equal(result.max_depth, 3);
  assert.equal(result.nodes.length, 1);
  assert.throws(() => traverseKnowledgeGraph(null, "a"), TypeError);
});
