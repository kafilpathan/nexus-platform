const MAX_BODY = 16000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
});

const readBody = async request => {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY) throw Object.assign(new Error("Request body too large."), { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY) throw Object.assign(new Error("Request body too large."), { status: 413 });
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch (_) {
    throw Object.assign(new Error("A JSON object is required."), { status: 400 });
  }
};

const boundedText = (value, min, max) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max
    ? value.trim() : null;

async function requestJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!response.ok) {
    const message = data && (data.message || data.error_description || data.hint);
    throw Object.assign(new Error(message || "Database request failed."), { status: response.status });
  }
  return { data, response };
}

async function authenticateAdmin(request, env) {
  const match = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Sign in is required."), { status: 401 });
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw Object.assign(new Error("Supabase configuration is missing."), { status: 503 });
  }
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const token = match[1];
  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
  const { data: user } = await requestJson(base + "/auth/v1/user", { headers });
  if (!user || typeof user.id !== "string") throw Object.assign(new Error("Invalid session."), { status: 401 });
  const { data: admins } = await requestJson(
    base + "/rest/v1/nexus_admins?select=user_id&user_id=eq." + encodeURIComponent(user.id) + "&limit=1",
    { headers }
  );
  if (!Array.isArray(admins) || !admins.length) throw Object.assign(new Error("Admin access required."), { status: 403 });
  return { base, token, user, headers };
}

async function rest(ctx, path, method = "GET", body = null, prefer = "") {
  const headers = { ...ctx.headers, Accept: "application/json" };
  if (prefer) headers.Prefer = prefer;
  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);
  const { data } = await requestJson(ctx.base + "/rest/v1/" + path, options);
  return data;
}

const safeObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export async function handleEngineRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return json({ success: true }, 204);
  if (!url.pathname.startsWith("/api/engine/")) return null;
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const ctx = await authenticateAdmin(request, env);
    const route = url.pathname.slice("/api/engine/".length);

    if (route === "overview" && request.method === "GET") {
      const [experiments, nodes, edges, evaluations] = await Promise.all([
        rest(ctx, "nexus_experiments?select=id,name,status,baseline_score,candidate_score,created_at,updated_at&order=created_at.desc&limit=30"),
        rest(ctx, "nexus_knowledge_nodes?select=id,label,node_type,description,confidence,source_url,source_title,created_at&order=created_at.desc&limit=50"),
        rest(ctx, "nexus_knowledge_edges?select=id,source_node_id,target_node_id,relation_type,confidence,created_at&order=created_at.desc&limit=100"),
        rest(ctx, "nexus_evaluations?select=id,experiment_id,suite_version,metrics,passed,summary,created_at&order=created_at.desc&limit=30")
      ]);
      return json({
        success: true,
        counts: {
          experiments: experiments.length,
          proposed: experiments.filter(x => x.status === "proposed").length,
          awaitingReview: experiments.filter(x => x.status === "eligible_for_review").length,
          approved: experiments.filter(x => x.status === "approved").length,
          knowledgeNodes: nodes.length,
          knowledgeEdges: edges.length,
          evaluations: evaluations.length,
          passedEvaluations: evaluations.filter(x => x.passed).length
        },
        experiments, nodes, edges, evaluations,
        governance: "Experiments remain proposals until an authenticated admin reviews and approves them. Evaluation metrics are submitted test results, not proof of model capability."
      });
    }

    if (route === "experiments" && request.method === "POST") {
      const body = await readBody(request);
      const name = boundedText(body.name, 1, 120);
      const objective = boundedText(body.objective, 1, 1200);
      if (!name || !objective) return json({ error: "Name (1–120) and objective (1–1200) are required." }, 400);
      const parameters = safeObject(body.parameters);
      const notes = typeof body.notes === "string" ? body.notes.slice(0, 3000) : "";
      const rows = await rest(ctx, "nexus_experiments", "POST", {
        created_by: ctx.user.id, name, objective, parameters, notes, status: "proposed"
      }, "return=representation");
      return json({ success: true, experiment: Array.isArray(rows) ? rows[0] : rows }, 201);
    }

    if (route === "knowledge/nodes" && request.method === "POST") {
      const body = await readBody(request);
      const label = boundedText(body.label, 1, 160);
      const nodeType = boundedText(body.node_type, 1, 40);
      const description = boundedText(body.description, 1, 1200);
      const sourceUrl = body.source_url == null || body.source_url === "" ? null : boundedText(body.source_url, 9, 2000);
      if (!label || !nodeType || !description || (body.source_url && (!sourceUrl || !/^https:\/\//i.test(sourceUrl)))) {
        return json({ error: "Valid label, node_type, description and optional HTTPS source_url are required." }, 400);
      }
      const confidence = Number(body.confidence ?? 0.5);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return json({ error: "Confidence must be between 0 and 1." }, 400);
      const rows = await rest(ctx, "nexus_knowledge_nodes", "POST", {
        created_by: ctx.user.id, label, node_type: nodeType, description, source_url: sourceUrl,
        source_title: boundedText(body.source_title || "", 0, 200) || null,
        confidence, provenance: safeObject(body.provenance)
      }, "return=representation");
      return json({ success: true, node: Array.isArray(rows) ? rows[0] : rows }, 201);
    }

    if (route === "knowledge/edges" && request.method === "POST") {
      const body = await readBody(request);
      const source = boundedText(body.source_node_id, 36, 36);
      const target = boundedText(body.target_node_id, 36, 36);
      const relation = boundedText(body.relation_type, 1, 60);
      if (!source || !target || source === target || !relation) return json({ error: "Two distinct node IDs and a relation_type are required." }, 400);
      const confidence = Number(body.confidence ?? 0.5);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return json({ error: "Confidence must be between 0 and 1." }, 400);
      const rows = await rest(ctx, "nexus_knowledge_edges", "POST", {
        created_by: ctx.user.id, source_node_id: source, target_node_id: target,
        relation_type: relation, confidence, provenance: safeObject(body.provenance)
      }, "return=representation");
      return json({ success: true, edge: Array.isArray(rows) ? rows[0] : rows }, 201);
    }

    if (route === "evaluate" && request.method === "POST") {
      const body = await readBody(request);
      const experimentId = body.experiment_id == null ? null : boundedText(body.experiment_id, 36, 36);
      const metrics = safeObject(body.metrics);
      const quality = Number(metrics.quality_score);
      const safety = Number(metrics.safety_score);
      const regressions = Number(metrics.regression_count);
      const testCount = Number(metrics.test_count);
      if (![quality, safety, regressions, testCount].every(Number.isFinite) ||
          quality < 0 || quality > 1 || safety < 0 || safety > 1 ||
          regressions < 0 || testCount < 1 || testCount > 10000) {
        return json({ error: "metrics must include quality_score and safety_score (0–1), regression_count (>=0), and test_count (1–10000)." }, 400);
      }
      const passed = quality >= 0.8 && safety >= 0.95 && regressions === 0;
      const summary = boundedText(body.summary || (passed ? "Evaluation thresholds met; awaiting human review." : "Evaluation thresholds not met."), 1, 2000);
      const rows = await rest(ctx, "nexus_evaluations", "POST", {
        created_by: ctx.user.id, experiment_id: experimentId, suite_version: boundedText(body.suite_version || "v1", 1, 40),
        metrics, passed, summary
      }, "return=representation");
      if (passed && experimentId) {
        await rest(ctx, "nexus_experiments?id=eq." + encodeURIComponent(experimentId), "PATCH", {
          status: "eligible_for_review", candidate_score: quality, updated_at: new Date().toISOString()
        }, "return=minimal");
      }
      return json({
        success: true, passed, evaluation: Array.isArray(rows) ? rows[0] : rows,
        next_step: passed ? "An admin must review and explicitly approve this experiment." : "Revise the candidate and run the evaluation again.",
        note: "Metrics are caller-supplied test results. This endpoint records them; it does not independently validate model quality or safety."
      }, 201);
    }

    if (route === "experiments/review" && request.method === "POST") {
      const body = await readBody(request);
      const id = boundedText(body.id, 36, 36);
      const decision = body.decision === "approve" ? "approved" : body.decision === "reject" ? "rejected" : null;
      if (!id || !decision) return json({ error: "An experiment id and decision approve|reject are required." }, 400);
      const rows = await rest(ctx, "nexus_experiments?id=eq." + encodeURIComponent(id) + "&status=eq.eligible_for_review", "PATCH", {
        status: decision, reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, "return=representation");
      if (!Array.isArray(rows) || !rows.length) return json({ error: "Experiment not found or not awaiting review." }, 409);
      return json({ success: true, experiment: rows[0] });
    }

    return json({ error: "Unknown engine endpoint." }, 404);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    return json({ success: false, error: status >= 500 ? "Engine request failed. Check Worker and Supabase logs." : error.message }, status);
  }
}
