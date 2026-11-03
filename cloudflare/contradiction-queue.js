export function buildContradictionReviewQueue(edges) {
  if (!Array.isArray(edges)) throw new TypeError("Knowledge edges must be an array.");
  return edges
    .filter(edge => edge && typeof edge.relation_type === "string" && edge.relation_type.trim().toLowerCase() === "contradicts")
    .map(edge => {
      const confidence = edge.confidence == null ? null : Number(edge.confidence);
      const normalizedConfidence = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null;
      return {
        id: edge.id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        confidence: normalizedConfidence,
        confidence_band: normalizedConfidence === null ? "unknown" : normalizedConfidence >= 0.8 ? "high" : normalizedConfidence >= 0.5 ? "medium" : "low",
        created_at: edge.created_at || null,
        review_status: "pending",
        review_required: true
      };
    })
    .sort((a, b) => {
      if (a.confidence === null && b.confidence !== null) return 1;
      if (a.confidence !== null && b.confidence === null) return -1;
      if (a.confidence !== b.confidence) return (b.confidence ?? 0) - (a.confidence ?? 0);
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
}
