export function parseKnowledgeTraversalOptions(params) {
  const rawDepth = params.get("max_depth");
  const rawNodes = params.get("max_nodes");
  const rawEdges = params.get("max_edges");
  const requestedDepth = rawDepth === null ? 2 : Number(rawDepth);
  const requestedNodes = rawNodes === null ? 50 : Number(rawNodes);
  const requestedEdges = rawEdges === null ? 500 : Number(rawEdges);
  if (!Number.isInteger(requestedDepth) || requestedDepth < 1) return { valid: false, error: "max_depth must be a positive integer." };
  if (!Number.isInteger(requestedNodes) || requestedNodes < 1) return { valid: false, error: "max_nodes must be a positive integer." };
  if (!Number.isInteger(requestedEdges) || requestedEdges < 1) return { valid: false, error: "max_edges must be a positive integer." };
  const direction = params.get("direction") || "outgoing";
  if (!["outgoing", "incoming", "both"].includes(direction)) return { valid: false, error: "direction must be outgoing, incoming, or both." };
  const relationType = params.get("relation_type") || null;
  if (relationType && !/^[a-z][a-z0-9_-]{0,59}$/i.test(relationType)) return { valid: false, error: "Invalid relation_type filter." };
  const rawConfidence = params.get("min_confidence");
  if (rawConfidence !== null && !rawConfidence.trim()) return { valid: false, error: "min_confidence must be a number between 0 and 1." };
  const minConfidence = rawConfidence === null ? null : Number(rawConfidence);
  if (minConfidence !== null && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    return { valid: false, error: "min_confidence must be a number between 0 and 1." };
  }
  return {
    valid: true,
    maxDepth: Math.min(3, requestedDepth),
    maxNodes: Math.min(100, requestedNodes),
    maxEdges: Math.min(500, requestedEdges),
    direction,
    relationType,
    minConfidence
  };
}
