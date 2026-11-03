export function findDuplicateKnowledgeNode(candidate, existingNodes = []) {
  if (!candidate || typeof candidate !== "object" || !Array.isArray(existingNodes)) return null;
  const label = String(candidate.label || "").trim().toLowerCase();
  const type = String(candidate.node_type || "").trim().toLowerCase();
  const source = String(candidate.source_url || "").trim().toLowerCase();
  if (!label || !type) return null;
  return existingNodes.find(node => {
    if (!node) return false;
    const sameSource = source && String(node.source_url || "").trim().toLowerCase() === source;
    const sameIdentity = String(node.label || "").trim().toLowerCase() === label
      && String(node.node_type || "").trim().toLowerCase() === type;
    return sameSource || sameIdentity;
  }) || null;
}
