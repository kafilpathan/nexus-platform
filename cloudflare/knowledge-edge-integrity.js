const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateKnowledgeEdge(input, existingEdges = []) {
  const value = input && typeof input === "object" ? input : {};
  const source = typeof value.source_node_id === "string" ? value.source_node_id.trim() : "";
  const target = typeof value.target_node_id === "string" ? value.target_node_id.trim() : "";
  const relation = typeof value.relation_type === "string" ? value.relation_type.trim().toLowerCase() : "";
  const confidence = value.confidence === undefined ? 0.5 : Number(value.confidence);
  if (!UUID.test(source) || !UUID.test(target)) return { valid: false, error: "Valid source and target UUIDs are required." };
  if (source === target) return { valid: false, error: "Self-referential knowledge edges are not allowed." };
  if (!/^[a-z][a-z0-9_-]{0,59}$/.test(relation)) return { valid: false, error: "Relation type must be a 1–60 character lowercase identifier." };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { valid: false, error: "Confidence must be between 0 and 1." };
  const duplicate = Array.isArray(existingEdges) && existingEdges.some(edge =>
    edge && String(edge.source_node_id).toLowerCase() === source.toLowerCase()
    && String(edge.target_node_id).toLowerCase() === target.toLowerCase()
    && String(edge.relation_type).toLowerCase() === relation
  );
  if (duplicate) return { valid: false, duplicate: true, error: "This directed relation already exists." };
  return { valid: true, edge: { source_node_id: source, target_node_id: target, relation_type: relation, confidence } };
}
