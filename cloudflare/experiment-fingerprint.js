function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Fingerprint input must contain finite numbers.");
  if (value === undefined) throw new TypeError("Fingerprint input cannot contain undefined values.");
  return value;
}

export async function createExperimentFingerprint(spec, cryptoProvider = globalThis.crypto) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new TypeError("A replay specification object is required.");
  }
  if (!cryptoProvider || !cryptoProvider.subtle || typeof cryptoProvider.subtle.digest !== "function") {
    throw new Error("Web Crypto SHA-256 is unavailable.");
  }
  const canonical = JSON.stringify(canonicalize(spec));
  const bytes = new TextEncoder().encode(canonical);
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { algorithm: "SHA-256", fingerprint: hex, canonical_spec: canonical };
}
