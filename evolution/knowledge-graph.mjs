/**
 * Small in-memory knowledge graph primitives. Persist through the admin-only
 * Supabase adapter; do not treat model-generated nodes as verified facts.
 */
const cleanText = (value, name, max = 500) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(name + " must be a non-empty string of at most " + max + " characters.");
  }
  return value.trim();
};

export function createKnowledgeNode(input) {
  const confidence = input.confidence ?? 0.5;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError("confidence must be between 0 and 1.");
  }
  let sourceUrl = null;
  if (input.sourceUrl) {
    const parsed = new URL(input.sourceUrl);
    if (parsed.protocol !== "https:") throw new TypeError("sourceUrl must use HTTPS.");
    sourceUrl = parsed.href;
  }
  return Object.freeze({
    id: input.id || null,
    label: cleanText(input.label, "label", 160),
    nodeType: cleanText(input.nodeType, "nodeType", 40),
    description: cleanText(input.description, "description", 1200),
    sourceUrl,
    sourceTitle: input.sourceTitle ? cleanText(input.sourceTitle, "sourceTitle", 200) : null,
    confidence
  });
}

export function createKnowledgeEdge(input, knownNodeIds) {
  const sourceId = cleanText(input.sourceId, "sourceId", 80);
  const targetId = cleanText(input.targetId, "targetId", 80);
  if (sourceId === targetId) throw new TypeError("Self-referencing edges are not allowed.");
  if (!(knownNodeIds instanceof Set) || !knownNodeIds.has(sourceId) || !knownNodeIds.has(targetId)) {
    throw new TypeError("Both edge endpoints must exist in the supplied node set.");
  }
  const confidence = input.confidence ?? 0.5;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError("confidence must be between 0 and 1.");
  }
  return Object.freeze({
    id: input.id || null,
    sourceId,
    targetId,
    relationType: cleanText(input.relationType, "relationType", 60),
    confidence
  });
}

export function traverseKnowledgeGraph({ nodes, edges, startId, maxDepth = 2, maxNodes = 50 }) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new TypeError("nodes and edges must be arrays.");
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 5) throw new RangeError("maxDepth must be 0..5.");
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 100) throw new RangeError("maxNodes must be 1..100.");
  const byId = new Map(nodes.filter(n => n && n.id).map(n => [String(n.id), n]));
  if (!byId.has(String(startId))) throw new TypeError("startId was not found.");
  const adjacency = new Map();
  for (const edge of edges) {
    if (!edge || !byId.has(String(edge.source_node_id)) || !byId.has(String(edge.target_node_id))) continue;
    const list = adjacency.get(String(edge.source_node_id)) || [];
    list.push(edge);
    adjacency.set(String(edge.source_node_id), list);
  }
  const queue = [{ id: String(startId), depth: 0 }];
  const visited = new Set();
  const result = [];
  while (queue.length && result.length < maxNodes) {
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const node = byId.get(current.id);
    if (node) result.push(node);
    if (current.depth >= maxDepth) continue;
    for (const edge of adjacency.get(current.id) || []) {
      const next = String(edge.target_node_id);
      if (!visited.has(next)) queue.push({ id: next, depth: current.depth + 1 });
    }
  }
  return Object.freeze(result);
}
