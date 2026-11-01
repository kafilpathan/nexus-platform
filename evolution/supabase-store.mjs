/**
 * Browser-safe adapter. It uses the user's publishable client and relies on
 * Postgres RLS; never pass service-role credentials to this module.
 */
async function requireNexusAdmin(client) {
  if (!client?.auth || typeof client.from !== "function") throw new TypeError("Supabase client unavailable.");
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !user?.id) throw new Error("Sign in with a NEXUS admin account first.");
  const admin = await client.from("nexus_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (admin.error || !admin.data) throw new Error("NEXUS admin access is required.");
  return user;
}

export async function listExperiments(client) {
  await requireNexusAdmin(client);
  const { data, error } = await client.from("nexus_experiments")
    .select("id,name,objective,status,baseline_score,candidate_score,created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function saveExperiment(client, input) {
  const user = await requireNexusAdmin(client);
  const record = {
    created_by: user.id,
    name: String(input.name || "").trim().slice(0, 120),
    objective: String(input.objective || "").trim().slice(0, 1200),
    parameters: input.parameters && typeof input.parameters === "object" ? input.parameters : {},
    baseline_score: Number.isFinite(input.baselineScore) ? input.baselineScore : null,
    candidate_score: Number.isFinite(input.candidateScore) ? input.candidateScore : null,
    status: "proposed",
    notes: String(input.notes || "").slice(0, 3000)
  };
  if (!record.name || !record.objective) throw new TypeError("Experiment name and objective are required.");
  const { data, error } = await client.from("nexus_experiments").insert(record).select().single();
  if (error) throw error;
  return data;
}

export async function listKnowledgeGraph(client) {
  await requireNexusAdmin(client);
  const [nodes, edges] = await Promise.all([
    client.from("nexus_knowledge_nodes").select("id,label,node_type,description,source_url,source_title,confidence,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("nexus_knowledge_edges").select("id,source_node_id,target_node_id,relation_type,confidence,created_at").order("created_at", { ascending: false }).limit(200)
  ]);
  if (nodes.error) throw nodes.error;
  if (edges.error) throw edges.error;
  return { nodes: nodes.data || [], edges: edges.data || [] };
}

export async function saveKnowledgeNode(client, node) {
  const user = await requireNexusAdmin(client);
  const record = {
    created_by: user.id,
    label: node.label,
    node_type: node.nodeType,
    description: node.description,
    source_url: node.sourceUrl || null,
    source_title: node.sourceTitle || null,
    confidence: node.confidence
  };
  const { data, error } = await client.from("nexus_knowledge_nodes").insert(record).select().single();
  if (error) throw error;
  return data;
}

export async function saveKnowledgeEdge(client, edge) {
  const user = await requireNexusAdmin(client);
  const record = {
    created_by: user.id,
    source_node_id: edge.sourceId,
    target_node_id: edge.targetId,
    relation_type: edge.relationType,
    confidence: edge.confidence
  };
  const { data, error } = await client.from("nexus_knowledge_edges").insert(record).select().single();
  if (error) throw error;
  return data;
}

export async function saveEvaluation(client, evaluation) {
  const user = await requireNexusAdmin(client);
  const record = {
    created_by: user.id,
    experiment_id: evaluation.experimentId || null,
    suite_version: String(evaluation.suiteVersion || "v1").slice(0, 40),
    metrics: evaluation.metrics,
    passed: evaluation.passed === true,
    summary: String(evaluation.summary || "").slice(0, 2000)
  };
  const { data, error } = await client.from("nexus_evaluations").insert(record).select().single();
  if (error) throw error;
  return data;
}

/** Mark an experiment as eligible for review after a passing evaluation. */
export async function markExperimentEligible(client, experimentId, candidateScore) {
  await requireNexusAdmin(client);
  if (typeof experimentId !== "string" || !experimentId) throw new TypeError("experimentId is required.");
  if (!Number.isFinite(candidateScore)) throw new TypeError("candidateScore must be finite.");
  const { data, error } = await client.from("nexus_experiments")
    .update({ status: "eligible_for_review", candidate_score: candidateScore })
    .eq("id", experimentId).select().single();
  if (error) throw error;
  return data;
}

/** Human admin decision only. Approval means staged-test eligibility, not deployment. */
export async function reviewExperiment(client, experimentId, decision) {
  const user = await requireNexusAdmin(client);
  if (!["approved", "rejected"].includes(decision)) throw new TypeError("decision must be approved or rejected.");
  const { data, error } = await client.from("nexus_experiments")
    .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", experimentId).eq("status", "eligible_for_review").select().single();
  if (error) throw error;
  return data;
}
