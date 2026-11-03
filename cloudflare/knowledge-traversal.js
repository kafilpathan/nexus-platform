export function traverseKnowledgeGraph(edges, startNodeId, maxDepth = 2, maxNodes = 50) {
  if (!Array.isArray(edges)) throw new TypeError("Knowledge edges must be an array.");
  if (typeof startNodeId !== "string" || !startNodeId.trim()) throw new TypeError("A start node id is required.");
  const depthLimit = Math.max(1, Math.min(3, Number.isInteger(maxDepth) ? maxDepth : 2));
  const nodeLimit = Math.max(1, Math.min(100, Number.isInteger(maxNodes) ? maxNodes : 50));
  const visited = new Set([startNodeId]);
  const frontier = [{ id: startNodeId, depth: 0 }];
  const reached = [];
  const traversed = [];

  while (frontier.length && reached.length < nodeLimit) {
    const current = frontier.shift();
    if (current.depth >= depthLimit) continue;
    for (const edge of edges) {
      if (!edge || edge.source_node_id !== current.id || typeof edge.target_node_id !== "string") continue;
      traversed.push(edge);
      if (visited.has(edge.target_node_id)) continue;
      visited.add(edge.target_node_id);
      const item = { id: edge.target_node_id, depth: current.depth + 1, via_edge_id: edge.id ?? null };
      reached.push(item);
      frontier.push(item);
      if (reached.length >= nodeLimit) break;
    }
  }
  return { start_node_id: startNodeId, max_depth: depthLimit, nodes: reached, edges: traversed };
}
