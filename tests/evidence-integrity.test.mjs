import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { canonicalEvidence, createEvidenceIntegrityManifest, verifyEvidenceIntegrityManifest } from "../cloudflare/evidence-integrity.js";
test("canonical evidence ignores object key order", () => assert.equal(canonicalEvidence({ b: 2, a: 1 }), canonicalEvidence({ a: 1, b: 2 })));
test("manifest verifies unchanged evidence", async () => { const data = { suite: "v1", results: [{ passed: true }] }; const m = await createEvidenceIntegrityManifest(data, webcrypto); assert.equal(m.sha256.length, 64); assert.equal(await verifyEvidenceIntegrityManifest(data, m, webcrypto), true); });
test("manifest rejects tampering", async () => { const data = { score: 0.9 }; const m = await createEvidenceIntegrityManifest(data, webcrypto); assert.equal(await verifyEvidenceIntegrityManifest({ score: 0.8 }, m, webcrypto), false); assert.equal(await verifyEvidenceIntegrityManifest(data, { ...m, byte_length: 0 }, webcrypto), false); });
test("invalid evidence is rejected", async () => { await assert.rejects(() => createEvidenceIntegrityManifest({ score: NaN }, webcrypto)); await assert.rejects(() => createEvidenceIntegrityManifest({ callback() {} }, webcrypto)); });
test("unsupported manifest fails closed", async () => assert.equal(await verifyEvidenceIntegrityManifest({ a: 1 }, { algorithm: "MD5" }, webcrypto), false));

import { createPerCaseIntegrityManifests, verifyPerCaseIntegrityManifests } from "../cloudflare/evidence-integrity.js";
test("per-case manifests identify only the altered benchmark case", async () => {
  const results = [{ case_id: "quality-1", score: 1 }, { case_id: "safety-1", score: 1 }];
  const manifest = await createPerCaseIntegrityManifests(results, webcrypto);
  const checked = await verifyPerCaseIntegrityManifests([{ ...results[0] }, { ...results[1], score: 0 }], manifest, webcrypto);
  assert.equal(checked.verified, false);
  assert.deepEqual(checked.mismatched_case_ids, ["safety-1"]);
  assert.equal(checked.checked_count, 2);
});
test("per-case verification fails closed for missing and duplicate cases", async () => {
  const results = [{ case_id: "one", score: 1 }, { case_id: "two", score: 2 }];
  const manifest = await createPerCaseIntegrityManifests(results, webcrypto);
  assert.equal((await verifyPerCaseIntegrityManifests([results[0]], manifest, webcrypto)).verified, false);
  await assert.rejects(() => createPerCaseIntegrityManifests([{ case_id: "x" }, { case_id: "x" }], webcrypto));
});
