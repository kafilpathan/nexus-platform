import test from "node:test";
import assert from "node:assert/strict";
import { buildContradictionReviewQueue } from "../cloudflare/contradiction-queue.js";

test("queue includes only contradiction edges and marks them pending review", () => {
  const queue = buildContradictionReviewQueue([
    { id: "1", relation_type: "contradicts", source_node_id: "a", target_node_id: "b", confidence: 0.9 },
    { id: "2", relation_type: "supports", source_node_id: "b", target_node_id: "c" },
    { id: "3", relation_type: " CONTRADICTS ", source_node_id: "c", target_node_id: "d", confidence: 0.7 }
  ]);
  assert.equal(queue.length, 2);
  assert.ok(queue.every(item => item.review_status === "pending" && item.review_required));
  assert.deepEqual(queue.map(item => item.id), ["1", "3"]);
});

test("queue handles empty input and rejects non-array input", () => {
  assert.deepEqual(buildContradictionReviewQueue([]), []);
  assert.throws(() => buildContradictionReviewQueue(null), TypeError);
});
