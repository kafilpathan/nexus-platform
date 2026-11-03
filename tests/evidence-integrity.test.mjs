import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { canonicalEvidence, createEvidenceIntegrityManifest, verifyEvidenceIntegrityManifest } from "../cloudflare/evidence-integrity.js";

test("canonical evidence is independent of object key order", () => {
  assert.equal(canonicalEvidence({ b: 2, a: 1 }), canonicalEvidence({ a: 1, b: 2 }));
});

test("manifest verifies unchanged evidence", async () => {
  const evidence = { suite: "v1", results: [{ passed: true, score: 0.9 }] };
  const manifest = await createEvidenceIntegrityManifest(evidence, webcrypto);
  assert.equal(manifest.algorithm, "SHA-256");
  assert.equal(manifest.sha256.length, 64);
  assert.equal(await verifyEvidenceIntegrityManifest(evidence, manifest, webcrypto), true);
});

test("manifest rejects modified evidence and modified metadata", async () => {
  const evidence = { score: 0.9 };
  const manifest = await createEvidenceIntegrityManifest(evidence, webcrypto);
  assert.equal(await verifyEvidenceIntegrityManifest({ score: 0.8 }, manifest, webcrypto), false);
  assert.equal(await verifyEvidenceIntegrityManifest(evidence, { ...manifest, byte_length: 0 }, webcrypto), false);
});

test("non-finite and non-JSON evidence is rejected", async () => {
  await assert.rejects(() => createEvidenceIntegrityManifest({ score: NaN }, webcrypto));
  await assert.rejects(() => createEvidenceIntegrityManifest({ callback() {} }, webcrypto));
});

test("missing or unsupported manifests fail closed", async () => {
  assert.equal(await verifyEvidenceIntegrityManifest({ a: 1 }, null, webcrypto), false);
  assert.equal(await verifyEvidenceIntegrityManifest({ a: 1 }, { algorithm: "MD5" }, webcrypto), false);
});
