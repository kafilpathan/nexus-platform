export function normalizeSourceProvenance({ sourceUrl, sourceTitle, provenance = {}, now = new Date().toISOString() }) {
  const metadata = provenance && typeof provenance === "object" && !Array.isArray(provenance) ? provenance : {};
  let canonicalUrl = null;
  if (sourceUrl != null && sourceUrl !== "") {
    if (typeof sourceUrl !== "string" || sourceUrl.length > 2000) throw new TypeError("Source URL must be a valid HTTPS URL.");
    let parsed;
    try { parsed = new URL(sourceUrl); } catch (_) { throw new TypeError("Source URL must be a valid HTTPS URL."); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
      throw new TypeError("Source URL must use HTTPS and cannot contain embedded credentials.");
    }
    canonicalUrl = parsed.toString();
  }

  const contentHash = metadata.content_sha256 == null ? null : String(metadata.content_sha256).toLowerCase();
  if (contentHash !== null && !/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new TypeError("content_sha256 must be a 64-character SHA-256 hex digest.");
  }
  const capturedAt = metadata.captured_at == null ? now : metadata.captured_at;
  if (typeof capturedAt !== "string" || !Number.isFinite(Date.parse(capturedAt))) {
    throw new TypeError("captured_at must be a valid ISO-compatible timestamp.");
  }
  return {
    source_url: canonicalUrl,
    source_title: typeof sourceTitle === "string" ? sourceTitle.trim().slice(0, 200) || null : null,
    captured_at: new Date(capturedAt).toISOString(),
    content_sha256: contentHash,
    verification_status: "unverified",
    verification_note: "Metadata is normalized; source ownership and content authenticity have not been independently verified."
  };
}
