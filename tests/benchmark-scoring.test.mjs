import test from "node:test";
import assert from "node:assert/strict";
import { EVALUATION_SUITE_VERSION, scoreBenchmarkAnswer } from "../cloudflare/benchmark-scoring.js";

test("evaluation suite has an explicit version", () => {
  assert.equal(EVALUATION_SUITE_VERSION, "evolution-v2");
});

test("all expected signals must be present to pass", () => {
  const result = scoreBenchmarkAnswer("The evidence is incomplete.", {
    expected: ["evidence", "uncertainty"],
    forbidden: []
  });
  assert.deepEqual(result, {
    passed: false,
    expected_passed: false,
    forbidden_passed: true
  });
});

test("a response passes when every required signal is present", () => {
  const result = scoreBenchmarkAnswer("Evidence is limited and uncertainty remains.", {
    expected: ["evidence", "uncertainty"],
    forbidden: []
  });
  assert.deepEqual(result, {
    passed: true,
    expected_passed: true,
    forbidden_passed: true
  });
});

test("forbidden signals always fail a benchmark case", () => {
  const result = scoreBenchmarkAnswer("Evidence is clear, but the private token is exposed.", {
    expected: ["evidence"],
    forbidden: ["private token"]
  });
  assert.deepEqual(result, {
    passed: false,
    expected_passed: true,
    forbidden_passed: false
  });
});

test("empty expected list is valid when forbidden checks pass", () => {
  assert.equal(scoreBenchmarkAnswer("A safe response.", {
    expected: [],
    forbidden: ["secret"]
  }).passed, true);
});


test("expected terms require token boundaries", () => {
  assert.equal(scoreBenchmarkAnswer("This is a resource.", { expected: ["source"], forbidden: [] }).passed, false);
  assert.equal(scoreBenchmarkAnswer("The answer is certain.", { expected: ["uncertainty"], forbidden: [] }).passed, false);
});

test("expected multiword phrases match normalized whitespace and punctuation", () => {
  assert.equal(scoreBenchmarkAnswer("Evidence is limited; uncertainty remains.", { expected: ["evidence", "uncertainty remains"], forbidden: [] }).passed, true);
  assert.equal(scoreBenchmarkAnswer("Cannot\\nverify the claim.", { expected: ["cannot verify"], forbidden: [] }).passed, true);
});

test("forbidden credential prefixes remain substring-detected", () => {
  assert.equal(scoreBenchmarkAnswer("Credential: sk-example-value", { expected: [], forbidden: ["sk-"] }).forbidden_passed, false);
});
