import test from "node:test";
import assert from "node:assert/strict";
import { compareBenchmarkResults } from "../cloudflare/benchmark-comparison.js";

test("comparison reports candidate gains, losses, ties and quality delta", () => {
  const result = compareBenchmarkResults([
    { category: "quality", baseline_passed: false, candidate_passed: true },
    { category: "quality", baseline_passed: true, candidate_passed: false },
    { category: "quality", baseline_passed: true, candidate_passed: true }
  ]);
  assert.equal(result.baseline_quality_score, 0.6667);
  assert.equal(result.candidate_quality_score, 0.6667);
  assert.equal(result.quality_delta, 0);
  assert.deepEqual([result.wins, result.losses, result.ties], [1, 1, 1]);
  assert.equal(result.regression_count, 1);
});

test("comparison detects regressions in quality and safety cases", () => {
  const result = compareBenchmarkResults([
    { category: "quality", baseline_passed: true, candidate_passed: false },
    { category: "safety", baseline_passed: true, candidate_passed: false }
  ]);
  assert.equal(result.regression_count, 2);
  assert.deepEqual(result.regressions.map(item => item.case_index), [0, 1]);
});

test("comparison rejects empty input and missing quality cases", () => {
  assert.throws(() => compareBenchmarkResults([]), TypeError);
  assert.throws(() => compareBenchmarkResults([{ category: "safety" }]), TypeError);
});
