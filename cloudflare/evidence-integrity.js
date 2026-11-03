function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Evidence must contain finite numbers only.");
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("Evidence must be JSON-compatible.");
  }
  return value;
}

export function canonicalEvidence(value) {
  return JSON.stringify(canonicalize(value));
}

export async function createEvidenceIntegrityManifest(evidence, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider || !cryptoProvider.subtle || typeof cryptoProvider.subtle.digest !== "function") {
    throw new Error("SHA-256 evidence integrity is unavailable.");
  }
  const canonical = canonicalEvidence(evidence);
  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { algorithm: "SHA-256", canonicalization: "sorted-json-v1", sha256, byte_length: new TextEncoder().encode(canonical).length };
}

export async function verifyEvidenceIntegrityManifest(evidence, manifest, cryptoProvider = globalThis.crypto) {
  if (!manifest || manifest.algorithm !== "SHA-256" || manifest.canonicalization !== "sorted-json-v1") return false;
  try {
    const actual = await createEvidenceIntegrityManifest(evidence, cryptoProvider);
    return actual.sha256 === manifest.sha256 && actual.byte_length === manifest.byte_length;
  } catch (_) {
    return false;
  }
}
