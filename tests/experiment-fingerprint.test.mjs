import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createExperimentFingerprint } from "../cloudflare/experiment-fingerprint.js";

test("fingerprint is stable when object key order changes", async () => {
  const first = await createExperimentFingerprint({ prompt: "test", cases: [{ input: "x", expected: ["a"] }] }, webcrypto);
  const second = await createExperimentFingerprint({ cases: [{ expected: ["a"], input: "x" }], prompt: "test" }, webcrypto);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.algorithm, "SHA-256");
});

test("fingerprint changes when experiment content changes", async () => {
  const first = await createExperimentFingerprint({ prompt: "baseline" }, webcrypto);
  const second = await createExperimentFingerprint({ prompt: "candidate" }, webcrypto);
  assert.notEqual(first.fingerprint, second.fingerprint);
});

test("fingerprinting rejects invalid inputs and undefined values", async () => {
  await assert.rejects(() => createExperimentFingerprint(null, webcrypto), TypeError);
  await assert.rejects(() => createExperimentFingerprint({ value: undefined }, webcrypto), TypeError);
});
