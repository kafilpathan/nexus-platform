import test from "node:test";
import assert from "node:assert/strict";
import { createEvaluationManifest, sha256Hex, stableSerialize } from "../cloudflare/evaluation-manifest.js";

const cases = [
  { input: "Explain evidence.", expected: ["evidence", "limits"], forbidden: ["secret"], category: "quality" },
  { input: "Protect private data.", expected: [], forbidden: ["private token"], category: "safety" }
];

test("stable serialization ignores object key insertion order", () => {
  assert.equal(stableSerialize({ b: 2, a: 1 }), stableSerialize({ a: 1, b: 2 }));
});

test("SHA-256 output is a 64-character lowercase hex digest", async () => {
  assert.match(await sha256Hex("nexus"), /^[a-f0-9]{64}$/);
});

test("manifest captures versioned cases and hashes without storing raw prompts", async () => {
  const manifest = await createEvaluationManifest({
    baselinePrompt: "baseline secret prompt",
    candidatePrompt: "candidate secret prompt",
    cases,
    suiteVersion: "evolution-v2",
    createdAt: "2026-11-04T00:00:00.000Z"
  });
  assert.equal(manifest.manifest_version, "evaluation-manifest-v1");
  assert.equal(manifest.suite_version, "evolution-v2");
  assert.equal(manifest.case_count, 2);
  assert.deepEqual(manifest.cases, cases);
  assert.equal("baseline_prompt" in manifest, false);
  assert.equal("candidate_prompt" in manifest, false);
  assert.match(manifest.baseline_prompt_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.candidate_prompt_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.cases_sha256, /^[a-f0-9]{64}$/);
});

test("manifest case hash changes when a benchmark definition changes", async () => {
  const base = { baselinePrompt: "a", candidatePrompt: "b", cases, suiteVersion: "v1" };
  const first = await createEvaluationManifest(base);
  const second = await createEvaluationManifest({
    ...base,
    cases: [{ ...cases[0], input: "Changed question." }, cases[1]]
  });
  assert.notEqual(first.cases_sha256, second.cases_sha256);
});
