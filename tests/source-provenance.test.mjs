import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSourceProvenance } from "../cloudflare/source-provenance.js";

test("normalizes HTTPS provenance metadata without claiming verification", () => {
  const result = normalizeSourceProvenance({
    sourceUrl: "https://example.com/article",
    sourceTitle: " Example article ",
    provenance: { content_sha256: "a".repeat(64), captured_at: "2026-11-04T00:00:00Z" }
  });
  assert.equal(result.source_url, "https://example.com/article");
  assert.equal(result.source_title, "Example article");
  assert.equal(result.verification_status, "unverified");
  assert.equal(result.content_sha256, "a".repeat(64));
});

test("rejects insecure URLs and embedded credentials", () => {
  assert.throws(() => normalizeSourceProvenance({ sourceUrl: "http://example.com" }), TypeError);
  assert.throws(() => normalizeSourceProvenance({ sourceUrl: "https://user:pass@example.com" }), TypeError);
});

test("rejects malformed hashes and timestamps", () => {
  assert.throws(() => normalizeSourceProvenance({ provenance: { content_sha256: "bad" } }), TypeError);
  assert.throws(() => normalizeSourceProvenance({ provenance: { captured_at: "not-a-date" } }), TypeError);
});
