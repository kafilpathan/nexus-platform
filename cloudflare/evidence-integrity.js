function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Evidence must contain finite numbers only.");
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") throw new TypeError("Evidence must be JSON-compatible.");
  return value;
}
export function canonicalEvidence(value) { return JSON.stringify(canonicalize(value)); }
export async function createEvidenceIntegrityManifest(evidence, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider || !cryptoProvider.subtle || typeof cryptoProvider.subtle.digest !== "function") throw new Error("SHA-256 evidence integrity is unavailable.");
  const canonical = canonicalEvidence(evidence);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { algorithm: "SHA-256", canonicalization: "sorted-json-v1", sha256, byte_length: bytes.length };
}
export async function verifyEvidenceIntegrityManifest(evidence, manifest, cryptoProvider = globalThis.crypto) {
  if (!manifest || manifest.algorithm !== "SHA-256" || manifest.canonicalization !== "sorted-json-v1") return false;
  try { const actual = await createEvidenceIntegrityManifest(evidence, cryptoProvider); return actual.sha256 === manifest.sha256 && actual.byte_length === manifest.byte_length; }
  catch (_) { return false; }
}

export async function createPerCaseIntegrityManifests(results, cryptoProvider = globalThis.crypto) {
  if (!Array.isArray(results) || results.length === 0) throw new TypeError("Case evidence must be a non-empty array.");
  const ids = new Set();
  const manifests = [];
  for (const result of results) {
    if (!result || typeof result.case_id !== "string" || !result.case_id.trim() || ids.has(result.case_id)) {
      throw new TypeError("Every evidence case needs a unique non-empty case_id.");
    }
    ids.add(result.case_id);
    manifests.push({
      case_id: result.case_id,
      manifest: await createEvidenceIntegrityManifest(result, cryptoProvider)
    });
  }
  return { version: "per-case-sha256-v1", case_count: manifests.length, cases: manifests };
}
export async function verifyPerCaseIntegrityManifests(results, manifest, cryptoProvider = globalThis.crypto) {
  if (!Array.isArray(results) || !manifest || manifest.version !== "per-case-sha256-v1"
    || !Array.isArray(manifest.cases) || manifest.case_count !== manifest.cases.length) {
    return { verified: false, checked_count: 0, mismatched_case_ids: [] };
  }
  const byId = new Map(results.filter(item => item && typeof item.case_id === "string").map(item => [item.case_id, item]));
  const seen = new Set();
  const mismatched = [];
  let checked = 0;
  for (const entry of manifest.cases) {
    if (!entry || typeof entry.case_id !== "string" || seen.has(entry.case_id)) return { verified: false, checked_count: checked, mismatched_case_ids: mismatched };
    seen.add(entry.case_id);
    const result = byId.get(entry.case_id);
    if (!result || !(await verifyEvidenceIntegrityManifest(result, entry.manifest, cryptoProvider))) mismatched.push(entry.case_id);
    checked += 1;
  }
  for (const item of results) if (item && typeof item.case_id === "string" && !seen.has(item.case_id)) mismatched.push(item.case_id);
  return {
    verified: checked === results.length && mismatched.length === 0,
    checked_count: checked,
    mismatched_case_ids: mismatched
  };
}
