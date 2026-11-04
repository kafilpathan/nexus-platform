export function traverseKnowledgeGraph(edges, startNodeId, maxDepth = 2, maxNodes = 50, options = {}) {
  if (!Array.isArray(edges)) throw new TypeError("Knowledge edges must be an array.");
  if (typeof startNodeId !== "string" || !startNodeId.trim()) throw new TypeError("A start node id is required.");
  const depthLimit = Math.max(1, Math.min(3, Number.isInteger(maxDepth) ? maxDepth : 2));
  const nodeLimit = Math.max(1, Math.min(100, Number.isInteger(maxNodes) ? maxNodes : 50));
  const direction = ["outgoing", "incoming", "both"].includes(options.direction) ? options.direction : "outgoing";
  const relation = typeof options.relationType === "string" && options.relationType.trim() ? options.relationType.trim().toLowerCase() : null;
  const minConfidence = options.minConfidence === undefined || options.minConfidence === null ? null : options.minConfidence;
  const maxEdges = options.maxEdges === undefined ? 500 : options.maxEdges;
  if (!Number.isInteger(maxEdges) || maxEdges < 1 || maxEdges > 500) throw new TypeError("Maximum traversed edges must be between 1 and 500.");
  if (minConfidence !== null && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    throw new TypeError("Minimum confidence must be between 0 and 1.");
  }
  const adjacency = new Map();
  const addNeighbor = (nodeId, neighbor) => {
    if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);
    adjacency.get(nodeId).push(neighbor);
  };
  for (const edge of edges) {
    if (!edge || (relation && String(edge.relation_type).toLowerCase() !== relation)) continue;
    if (minConfidence !== null && (edge.confidence == null || edge.confidence === "" || !Number.isFinite(Number(edge.confidence)) || Number(edge.confidence) < minConfidence)) continue;
    if ((direction === "outgoing" || direction === "both") && typeof edge.source_node_id === "string" && typeof edge.target_node_id === "string") {
      addNeighbor(edge.source_node_id, { edge, nextId: edge.target_node_id, viaDirection: "outgoing" });
    }
    if ((direction === "incoming" || direction === "both") && typeof edge.source_node_id === "string" && typeof edge.target_node_id === "string") {
      addNeighbor(edge.target_node_id, { edge, nextId: edge.source_node_id, viaDirection: "incoming" });
    }
  }
  const visited = new Set([startNodeId]);
  const frontier = [{ id: startNodeId, depth: 0 }];
  const reached = [];
  const traversed = [];
  const traversedEdgeKeys = new Set();
  let edgesTruncated = false;
  let depthTruncated = false;
  let nodeLimitTruncated = false;
  while (frontier.length && reached.length < nodeLimit) {
    const current = frontier.shift();
    if (current.depth >= depthLimit) {
      if ((adjacency.get(current.id) || []).some(neighbor => !visited.has(neighbor.nextId))) depthTruncated = true;
      continue;
    }
    const neighbors = adjacency.get(current.id) || [];
    for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex += 1) {
      const neighbor = neighbors[neighborIndex];
      const { edge, nextId, viaDirection } = neighbor;
      const edgeKey = typeof edge.id === "string" && edge.id
        ? edge.id
        : [edge.source_node_id, edge.target_node_id, edge.relation_type ?? ""].join("|");
      if (!traversedEdgeKeys.has(edgeKey)) {
        traversedEdgeKeys.add(edgeKey);
        if (traversed.length < maxEdges) traversed.push(edge);
        else edgesTruncated = true;
      }
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const item = { id: nextId, depth: current.depth + 1, via_edge_id: edge.id ?? null, via_direction: viaDirection };
      reached.push(item);
      frontier.push(item);
      if (reached.length >= nodeLimit) {
        if (neighbors.slice(neighborIndex + 1).some(pending => !visited.has(pending.nextId))) nodeLimitTruncated = true;
        break;
      }
    }
  }
  if (reached.length >= nodeLimit && frontier.some(item => (adjacency.get(item.id) || []).some(neighbor => !visited.has(neighbor.nextId)))) nodeLimitTruncated = true;
  return { start_node_id: startNodeId, max_depth: depthLimit, max_edges: maxEdges, edges_truncated: edgesTruncated, depth_truncated: depthTruncated, node_limit_truncated: nodeLimitTruncated, direction, relation_type: relation, min_confidence: minConfidence, nodes: reached, edges: traversed };
}
