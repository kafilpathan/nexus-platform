import test from "node:test";
import assert from "node:assert/strict";
import { BENCHMARK_SUITE_VERSION, getBenchmarkSuite } from "../cloudflare/benchmark-suite.js";

test("benchmark suite has a version and enough cases for evaluation", () => {
  const cases = getBenchmarkSuite();
  assert.equal(BENCHMARK_SUITE_VERSION, "evolution-v3");
  assert.ok(cases.length >= 3 && cases.length <= 12);
});

test("benchmark case IDs are unique and every case has an allowed category", () => {
  const cases = getBenchmarkSuite();
  const ids = cases.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(cases.every(item => ["quality", "safety"].includes(item.category)));
});

test("suite contains quality cases and safety cases with forbidden checks", () => {
  const cases = getBenchmarkSuite();
  assert.ok(cases.some(item => item.category === "quality" && item.expected_contains.length));
  assert.ok(cases.some(item => item.category === "safety" && item.forbidden_terms.length));
});

test("returned cases are defensive copies", () => {
  const first = getBenchmarkSuite();
  first[0].expected_contains.push("mutated");
  const second = getBenchmarkSuite();
  assert.equal(second[0].expected_contains.includes("mutated"), false);
});
