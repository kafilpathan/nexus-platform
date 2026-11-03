export function traverseKnowledgeGraph(edges, startNodeId, maxDepth = 2, maxNodes = 50, options = {}) {
  if (!Array.isArray(edges)) throw new TypeError("Knowledge edges must be an array.");
  if (typeof startNodeId !== "string" || !startNodeId.trim()) throw new TypeError("A start node id is required.");
  const depthLimit = Math.max(1, Math.min(3, Number.isInteger(maxDepth) ? maxDepth : 2));
  const nodeLimit = Math.max(1, Math.min(100, Number.isInteger(maxNodes) ? maxNodes : 50));
  const direction = ["outgoing", "incoming", "both"].includes(options.direction) ? options.direction : "outgoing";
  const relation = typeof options.relationType === "string" && options.relationType.trim() ? options.relationType.trim().toLowerCase() : null;
  const visited = new Set([startNodeId]);
  const frontier = [{ id: startNodeId, depth: 0 }];
  const reached = [];
  const traversed = [];
  while (frontier.length && reached.length < nodeLimit) {
    const current = frontier.shift();
    if (current.depth >= depthLimit) continue;
    for (const edge of edges) {
      if (!edge || (relation && String(edge.relation_type).toLowerCase() !== relation)) continue;
      const outgoing = edge.source_node_id === current.id;
      const incoming = edge.target_node_id === current.id;
      if (!(direction === "both" ? outgoing || incoming : direction === "incoming" ? incoming : outgoing)) continue;
      const nextId = outgoing ? edge.target_node_id : edge.source_node_id;
      if (typeof nextId !== "string") continue;
      traversed.push(edge);
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const item = { id: nextId, depth: current.depth + 1, via_edge_id: edge.id ?? null, via_direction: outgoing ? "outgoing" : "incoming" };
      reached.push(item);
      frontier.push(item);
      if (reached.length >= nodeLimit) break;
    }
  }
  return { start_node_id: startNodeId, max_depth: depthLimit, direction, relation_type: relation, nodes: reached, edges: traversed };
}
