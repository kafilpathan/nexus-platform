export function buildContradictionReviewQueue(edges) {
  if (!Array.isArray(edges)) throw new TypeError("Knowledge edges must be an array.");
  return edges
    .filter(edge => edge && typeof edge.relation_type === "string" && edge.relation_type.trim().toLowerCase() === "contradicts")
    .map(edge => ({
      id: edge.id,
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
      confidence: Number.isFinite(Number(edge.confidence)) ? Number(edge.confidence) : null,
      created_at: edge.created_at || null,
      review_status: "pending",
      review_required: true
    }));
}
