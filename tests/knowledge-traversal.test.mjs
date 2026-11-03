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
