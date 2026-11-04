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

const directionalEdges = [
  { id: "ab", source_node_id: "a", target_node_id: "b", relation_type: "supports" },
  { id: "ca", source_node_id: "c", target_node_id: "a", relation_type: "contradicts" },
  { id: "bd", source_node_id: "b", target_node_id: "d", relation_type: "supports" }
];
test("incoming traversal follows edges toward their sources",()=>{const r=traverseKnowledgeGraph(directionalEdges,"a",2,50,{direction:"incoming"});assert.deepEqual(r.nodes.map(n=>n.id),["c"]);assert.equal(r.nodes[0].via_direction,"incoming");});
test("both direction traverses incoming and outgoing neighbors",()=>{const r=traverseKnowledgeGraph(directionalEdges,"a",1,50,{direction:"both"});assert.deepEqual(new Set(r.nodes.map(n=>n.id)),new Set(["b","c"]));});
test("relation filter is case insensitive",()=>{const r=traverseKnowledgeGraph(directionalEdges,"a",2,50,{direction:"both",relationType:"CONTRADICTS"});assert.deepEqual(r.nodes.map(n=>n.id),["c"]);});
test("cycles and duplicate visits remain bounded",()=>{const cycle=[...directionalEdges,{id:"ba",source_node_id:"b",target_node_id:"a",relation_type:"supports"}];const r=traverseKnowledgeGraph(cycle,"a",3,10,{direction:"both"});assert.equal(new Set(r.nodes.map(n=>n.id)).size,r.nodes.length);});

const confidenceEdges = [
  { id: "low", source_node_id: "root", target_node_id: "weak", confidence: 0.25 },
  { id: "high", source_node_id: "root", target_node_id: "strong", confidence: 0.9 },
  { id: "missing", source_node_id: "root", target_node_id: "unknown" }
];
test("minimum confidence excludes weak and unscored edges", () => {
  const r = traverseKnowledgeGraph(confidenceEdges, "root", 2, 50, { minConfidence: 0.7 });
  assert.deepEqual(r.nodes.map(n => n.id), ["strong"]);
  assert.equal(r.min_confidence, 0.7);
});
test("minimum confidence zero retains only edges with a numeric confidence", () => {
  const r = traverseKnowledgeGraph(confidenceEdges, "root", 1, 50, { minConfidence: 0 });
  assert.deepEqual(r.nodes.map(n => n.id), ["weak", "strong"]);
});
test("rejects invalid minimum confidence thresholds", () => {
  assert.throws(() => traverseKnowledgeGraph([], "root", 2, 50, { minConfidence: 1.1 }), TypeError);
});

test("both-direction traversal emits each edge only once", () => {
  const edges = [
    { id: "ab", source_node_id: "a", target_node_id: "b", relation_type: "supports" },
    { id: "bc", source_node_id: "b", target_node_id: "c", relation_type: "supports" }
  ];
  const result = traverseKnowledgeGraph(edges, "a", 3, 10, { direction: "both" });
  assert.deepEqual(result.edges.map(edge => edge.id), ["ab", "bc"]);
  assert.equal(new Set(result.edges.map(edge => edge.id)).size, result.edges.length);
});

test("indexed traversal preserves breadth-first order with disconnected edges", () => {
  const edges = [
    { id: "ab", source_node_id: "a", target_node_id: "b", relation_type: "supports" },
    { id: "xy", source_node_id: "x", target_node_id: "y", relation_type: "supports" },
    { id: "bc", source_node_id: "b", target_node_id: "c", relation_type: "supports" },
    { id: "ad", source_node_id: "a", target_node_id: "d", relation_type: "supports" }
  ];
  const result = traverseKnowledgeGraph(edges, "a", 2, 10);
  assert.deepEqual(result.nodes.map(node => node.id), ["b", "d", "c"]);
  assert.deepEqual(result.edges.map(edge => edge.id), ["ab", "ad", "bc"]);
});

test("minimum confidence excludes null and empty-string edge confidence", () => {
  const edges = [
    { id: "null", source_node_id: "root", target_node_id: "null-node", confidence: null },
    { id: "empty", source_node_id: "root", target_node_id: "empty-node", confidence: "" },
    { id: "zero", source_node_id: "root", target_node_id: "zero-node", confidence: 0 }
  ];
  const result = traverseKnowledgeGraph(edges, "root", 1, 10, { minConfidence: 0 });
  assert.deepEqual(result.nodes.map(node => node.id), ["zero-node"]);
});

test("bounds returned edges while preserving node traversal", () => {
  const edges = [
    { id: "ab", source_node_id: "a", target_node_id: "b" },
    { id: "ac", source_node_id: "a", target_node_id: "c" },
    { id: "bd", source_node_id: "b", target_node_id: "d" }
  ];
  const result = traverseKnowledgeGraph(edges, "a", 2, 10, { maxEdges: 1 });
  assert.deepEqual(result.nodes.map(node => node.id), ["b", "c", "d"]);
  assert.deepEqual(result.edges.map(edge => edge.id), ["ab"]);
  assert.equal(result.max_edges, 1);
  assert.equal(result.edges_truncated, true);
});
test("reports when edge output is not truncated", () => {
  const result = traverseKnowledgeGraph([{ id: "ab", source_node_id: "a", target_node_id: "b" }], "a", 1, 10, { maxEdges: 2 });
  assert.equal(result.edges_truncated, false);
  assert.equal(result.edges.length, 1);
});
test("rejects invalid edge output bounds", () => {
  assert.throws(() => traverseKnowledgeGraph([], "a", 1, 10, { maxEdges: 0 }), TypeError);
  assert.throws(() => traverseKnowledgeGraph([], "a", 1, 10, { maxEdges: 501 }), TypeError);
});

test("reports when the depth limit hides further reachable nodes", () => {
  const edges = [
    { id: "ab", source_node_id: "a", target_node_id: "b" },
    { id: "bc", source_node_id: "b", target_node_id: "c" }
  ];
  const result = traverseKnowledgeGraph(edges, "a", 1, 10);
  assert.equal(result.depth_truncated, true);
  assert.equal(result.node_limit_truncated, false);
});
test("reports when the node limit prevents processing the remaining frontier", () => {
  const edges = [
    { id: "ab", source_node_id: "a", target_node_id: "b" },
    { id: "ac", source_node_id: "a", target_node_id: "c" }
  ];
  const result = traverseKnowledgeGraph(edges, "a", 3, 1);
  assert.equal(result.node_limit_truncated, true);
  assert.equal(result.nodes.length, 1);
});
test("reports no truncation when the reachable graph is fully traversed", () => {
  const result = traverseKnowledgeGraph([{ id: "ab", source_node_id: "a", target_node_id: "b" }], "a", 2, 10);
  assert.equal(result.depth_truncated, false);
  assert.equal(result.node_limit_truncated, false);
});
