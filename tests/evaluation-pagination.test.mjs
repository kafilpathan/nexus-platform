import test from "node:test";
import assert from "node:assert/strict";
import { parseEvaluationPagination } from "../cloudflare/evaluation-pagination.js";
test("uses safe defaults for evaluation history pagination", () => {
  assert.deepEqual(parseEvaluationPagination(new URLSearchParams()), { valid: true, limit: 20, offset: 0, experimentId: null, passed: null });
});
test("accepts bounded pagination and optional filters", () => {
  const params = new URLSearchParams({ limit: "50", offset: "100", experiment_id: "123e4567-e89b-42d3-a456-426614174000", passed: "false" });
  assert.deepEqual(parseEvaluationPagination(params), { valid: true, limit: 50, offset: 100, experimentId: "123e4567-e89b-42d3-a456-426614174000", passed: false });
});
test("rejects out-of-range pagination and malformed filters", () => {
  for (const params of [
    new URLSearchParams({ limit: "0" }),
    new URLSearchParams({ limit: "101" }),
    new URLSearchParams({ offset: "-1" }),
    new URLSearchParams({ offset: "10001" }),
    new URLSearchParams({ passed: "yes" }),
    new URLSearchParams({ experiment_id: "not-a-uuid" })
  ]) assert.equal(parseEvaluationPagination(params).valid, false);
});

test("rejects explicitly blank limit and offset values", () => {
  assert.equal(parseEvaluationPagination(new URLSearchParams({ limit: "" })).valid, false);
  assert.equal(parseEvaluationPagination(new URLSearchParams({ offset: "" })).valid, false);
  assert.equal(parseEvaluationPagination(new URLSearchParams({ offset: "   " })).valid, false);
});
