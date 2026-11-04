import { BENCHMARK_SUITE_VERSION, getBenchmarkSuite } from "./benchmark-suite.js";
import { parseEvaluationPagination } from "./evaluation-pagination.js";
import { scoreBenchmarkAnswer } from "./benchmark-scoring.js";
import { buildBenchmarkCaseEvidence } from "./benchmark-case-evidence.js";
import { summarizeBenchmarkEvidence } from "./benchmark-evidence-summary.js";
import { summarizeBenchmarkLatency } from "./benchmark-latency.js";
import { normalizeBenchmarkCases } from "./benchmark-case-schema.js";
import { compareBenchmarkResults } from "./benchmark-comparison.js";
import { createExperimentFingerprint } from "./experiment-fingerprint.js";
import { normalizeSourceProvenance } from "./source-provenance.js";
import { findDuplicateKnowledgeNode } from "./knowledge-node-integrity.js";
import { buildContradictionReviewQueue } from "./contradiction-queue.js";
import { traverseKnowledgeGraph } from "./knowledge-traversal.js";
import { parseKnowledgeTraversalOptions } from "./knowledge-traversal-options.js";
import { validateKnowledgeEdge, normalizeKnowledgeEdgeProvenance } from "./knowledge-edge-integrity.js";
import { evaluateEvaluationStages } from "./evaluation-stages.js";
import { createEvidenceIntegrityManifest, verifyEvidenceIntegrityManifest, createPerCaseIntegrityManifests, verifyPerCaseIntegrityManifests } from "./evidence-integrity.js";

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

    if (route === "benchmarks/suite" && request.method === "GET") {
      return json({
        success: true,
        suite_version: BENCHMARK_SUITE_VERSION,
        cases: getBenchmarkSuite(),
        note: "Curated server-maintained benchmark cases. Use these as the default evaluation suite; custom cases remain available for additional experiments."
      });
    }

    if (route === "knowledge/traverse" && request.method === "GET") {
      const startNodeId = url.searchParams.get("start_node_id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(startNodeId)) {
        return json({ error: "A valid start_node_id UUID is required." }, 400);
      }
      const traversalOptions = parseKnowledgeTraversalOptions(url.searchParams);
      if (!traversalOptions.valid) return json({ error: traversalOptions.error }, 400);
      const { maxDepth, maxNodes, direction, relationType, minConfidence } = traversalOptions;
      const [startRows, edges] = await Promise.all([
        rest(ctx, "nexus_knowledge_nodes?id=eq." + encodeURIComponent(startNodeId) + "&select=id,label,node_type,description,confidence&limit=1"),
        rest(ctx, "nexus_knowledge_edges?select=id,source_node_id,target_node_id,relation_type,confidence,created_at&order=created_at.desc,id.desc&limit=500")
      ]);
      if (!Array.isArray(startRows) || !startRows.length) return json({ error: "Start knowledge node was not found." }, 404);
      const traversal = traverseKnowledgeGraph(edges, startNodeId, maxDepth, maxNodes, { direction, relationType, minConfidence });
      const ids = [...new Set([startNodeId, ...traversal.nodes.map(node => node.id)])];
      const nodes = await rest(ctx, "nexus_knowledge_nodes?select=id,label,node_type,description,confidence,source_url,source_title&id=in.(" + ids.map(encodeURIComponent).join(",") + ")");
      return json({
        success: true,
        traversal: { ...traversal, nodes: nodes.map(node => ({ ...node, depth: node.id === startNodeId ? 0 : traversal.nodes.find(item => item.id === node.id)?.depth ?? null })) },
        note: "Traversal direction, relation type, and minimum edge confidence are filterable; results are bounded by depth, node count, and a 500-edge snapshot."
      });
    }

    if (route === "knowledge/contradictions" && request.method === "GET") {
      const edges = await rest(ctx, "nexus_knowledge_edges?select=id,source_node_id,target_node_id,relation_type,confidence,created_at&relation_type=ilike.contradicts&order=created_at.desc,id.desc&limit=100");
      const queue = buildContradictionReviewQueue(edges);
      return json({
        success: true,
        count: queue.length,
        items: queue,
        note: "Contradiction edges are surfaced for human review; detection does not determine which claim is correct."
      });
    }

    if (route === "evaluations" && request.method === "GET") {
      const page = parseEvaluationPagination(url.searchParams);
      if (!page.valid) return json({ error: page.error }, 400);
      const filters = [];
      if (page.experimentId) filters.push("experiment_id=eq." + encodeURIComponent(page.experimentId));
      if (page.passed !== null) filters.push("passed=eq." + page.passed);
      const query = "select=id,experiment_id,suite_version,metrics,passed,summary,self_declaration,self_assessment,created_at"
        + (filters.length ? "&" + filters.join("&") : "")
        + "&order=created_at.desc,id.desc&limit=" + page.limit + "&offset=" + page.offset;
      const evaluations = await rest(ctx, "nexus_evaluations?" + query);
      const items = Array.isArray(evaluations) ? evaluations : [];
      return json({ success: true, items, page: { limit: page.limit, offset: page.offset, returned: items.length, next_offset: items.length === page.limit ? page.offset + page.limit : null }, filters: { experiment_id: page.experimentId, passed: page.passed } });
    }

    if (route.startsWith("evaluations/") && route.endsWith("/verify") && request.method === "GET") {
      const evaluationId = route.slice("evaluations/".length, -"/verify".length);
      if (!/^[0-9a-f-]{36}$/i.test(evaluationId)) return json({ error: "A valid evaluation id UUID is required." }, 400);
      const rows = await rest(ctx, "nexus_evaluations?id=eq." + encodeURIComponent(evaluationId) + "&select=id,experiment_id,suite_version,evidence,created_at&limit=1");
      if (!Array.isArray(rows) || !rows.length) return json({ error: "Evaluation was not found." }, 404);
      const evaluation = rows[0];
      const evidence = safeObject(evaluation.evidence);
      const manifest = evidence.evidence_integrity;
      if (!manifest) return json({ success: true, evaluation_id: evaluation.id, verified: false, reason: "No integrity manifest is stored for this evaluation." });
      const payload = {
        suite_version: evaluation.suite_version,
        reproducibility_fingerprint: safeObject(evidence.reproducibility).fingerprint,
        results: evidence.results
      };
      const aggregateVerified = await verifyEvidenceIntegrityManifest(payload, manifest);
      const perCaseIntegrity = evidence.per_case_integrity
        ? await verifyPerCaseIntegrityManifests(evidence.results, evidence.per_case_integrity)
        : null;
      const verified = aggregateVerified && (perCaseIntegrity === null || perCaseIntegrity.verified);
      return json({
        success: true,
        evaluation_id: evaluation.id,
        verified,
        per_case_integrity: perCaseIntegrity,
        algorithm: manifest.algorithm,
        canonicalization: manifest.canonicalization,
        expected_sha256: manifest.sha256,
        byte_length: manifest.byte_length,
        checked_at: new Date().toISOString(),
        reason: verified ? null : "Stored evaluation evidence does not match its aggregate or per-case integrity manifest."
      });
    }

    if (route === "overview" && request.method === "GET") {
      const [experiments, nodes, edges, evaluations, versions] = await Promise.all([
        rest(ctx, "nexus_experiments?select=id,name,status,baseline_score,candidate_score,created_at,updated_at&order=created_at.desc&limit=30"),
        rest(ctx, "nexus_knowledge_nodes?select=id,label,node_type,description,confidence,source_url,source_title,created_at&order=created_at.desc&limit=50"),
        rest(ctx, "nexus_knowledge_edges?select=id,source_node_id,target_node_id,relation_type,confidence,created_at&order=created_at.desc&limit=100"),
        rest(ctx, "nexus_evaluations?select=id,experiment_id,suite_version,metrics,passed,summary,self_declaration,self_assessment,created_at&order=created_at.desc&limit=30"),
        rest(ctx, "nexus_evolution_versions?select=id,experiment_id,evaluation_id,version_label,change_summary,status,rollback_of,created_at,approved_at&order=created_at.desc&limit=30")
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
          passedEvaluations: evaluations.filter(x => x.passed).length,
          versions: versions.length,
          contradictions: edges.filter(x => x.relation_type === "contradicts").length
        },
        experiments, nodes, edges, evaluations, versions,
        governance: "Self-declarations are recorded separately. Only server-run benchmark evidence determines evaluation pass status; human approval is required before an experiment is approved. No automatic production deployment occurs."
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
      let provenance;
      try {
        provenance = normalizeSourceProvenance({
          sourceUrl: body.source_url,
          sourceTitle: body.source_title,
          provenance: body.provenance
        });
      } catch (error) {
        return json({ error: error.message }, 400);
      }
      const sourceUrl = provenance.source_url;
      if (!label || !nodeType || !description) {
        return json({ error: "Valid label, node_type and description are required." }, 400);
      }
      const confidence = body.confidence === "" ? NaN : Number(body.confidence ?? 0.5);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return json({ error: "Confidence must be between 0 and 1." }, 400);
      const [sourceMatches, identityMatches] = await Promise.all([
        sourceUrl
          ? rest(ctx, "nexus_knowledge_nodes?select=id,label,node_type,source_url&source_url=eq." + encodeURIComponent(sourceUrl) + "&limit=10")
          : Promise.resolve([]),
        rest(ctx, "nexus_knowledge_nodes?select=id,label,node_type,source_url&label=ilike." + encodeURIComponent(label) + "&node_type=ilike." + encodeURIComponent(nodeType) + "&limit=50")
      ]);
      const duplicate = findDuplicateKnowledgeNode({ label, node_type: nodeType, source_url: sourceUrl }, [...sourceMatches, ...identityMatches]);
      if (duplicate) return json({ error: "A knowledge node with the same source or label/type already exists.", duplicate_node_id: duplicate.id }, 409);
      const rows = await rest(ctx, "nexus_knowledge_nodes", "POST", {
        created_by: ctx.user.id, label, node_type: nodeType, description, source_url: sourceUrl,
        source_title: provenance.source_title,
        confidence, provenance
      }, "return=representation");
      return json({ success: true, node: Array.isArray(rows) ? rows[0] : rows }, 201);
    }

    if (route === "knowledge/edges" && request.method === "POST") {
      const body = await readBody(request);
      const candidate = validateKnowledgeEdge(body);
      if (!candidate.valid) return json({ error: candidate.error }, candidate.duplicate ? 409 : 400);
      const { source_node_id: source, target_node_id: target, relation_type: relation, confidence } = candidate.edge;
      let edgeProvenance;
      try {
        edgeProvenance = normalizeKnowledgeEdgeProvenance(body.provenance);
      } catch (error) {
        return json({ error: error.message }, 400);
      }
      const nodeRows = await rest(ctx, "nexus_knowledge_nodes?id=in.(" + encodeURIComponent(source) + "," + encodeURIComponent(target) + ")&select=id&limit=2");
      if (!Array.isArray(nodeRows) || nodeRows.length !== 2) return json({ error: "Both source and target knowledge nodes must exist." }, 404);
      const existing = await rest(ctx, "nexus_knowledge_edges?select=id,source_node_id,target_node_id,relation_type&source_node_id=eq." + encodeURIComponent(source) + "&target_node_id=eq." + encodeURIComponent(target) + "&limit=100");
      const checked = validateKnowledgeEdge(candidate.edge, existing);
      if (!checked.valid) return json({ error: checked.error }, checked.duplicate ? 409 : 400);
      const rows = await rest(ctx, "nexus_knowledge_edges", "POST", {
        created_by: ctx.user.id, source_node_id: source, target_node_id: target,
        relation_type: relation, confidence, provenance: edgeProvenance
      }, "return=representation");
      return json({ success: true, edge: Array.isArray(rows) ? rows[0] : rows }, 201);
    }

    if (route === "evaluate" && request.method === "POST") {
      const body = await readBody(request);
      const experimentId = boundedText(body.experiment_id, 36, 36);
      const experimentRows = await rest(ctx, "nexus_experiments?id=eq." + encodeURIComponent(experimentId || "") + "&select=id,status&limit=1");
      if (!experimentId || !Array.isArray(experimentRows) || !experimentRows.length || experimentRows[0].status !== "proposed") {
        return json({ error: "A valid proposed experiment is required before evaluation." }, 409);
      }
      const baselinePrompt = boundedText(body.baseline_prompt, 1, 1200);
      const candidatePrompt = boundedText(body.candidate_prompt, 1, 1200);
      const rawCases = body.cases === undefined ? getBenchmarkSuite() : body.cases;
      let normalized;
      try {
        normalized = normalizeBenchmarkCases(rawCases);
      } catch (error) {
        return json({ error: error.message }, 400);
      }
      if (!experimentId || !baselinePrompt || !candidatePrompt) {
        return json({ error: "experiment_id, baseline_prompt and candidate_prompt are required." }, 400);
      }
      if (!env.AI || typeof env.AI.run !== "function") return json({ error: "Workers AI binding is unavailable." }, 503);
      const replaySpec = {
        model: "@cf/meta/llama-3.1-8b-instruct-fp8",
        baseline_prompt: baselinePrompt,
        candidate_prompt: candidatePrompt,
        cases: normalized
      };
      const reproducibility = await createExperimentFingerprint(replaySpec);
      const runPrompt = async (systemPrompt, input) => {
        const startedAt = Date.now();
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input }
          ],
          max_tokens: 350
        });
        return {
          answer: String(result && result.response || "").slice(0, 5000),
          duration_ms: Math.max(0, Date.now() - startedAt)
        };
      };
      const check = (answer, item) => scoreBenchmarkAnswer(answer, {
        expected: item.expected,
        forbidden: item.forbidden
      });
      const results = [];
      for (const item of normalized) {
        const baselineRun = await runPrompt(baselinePrompt, item.input);
        const candidateRun = await runPrompt(candidatePrompt, item.input);
        const baselineCheck = check(baselineRun.answer, item);
        const candidateCheck = check(candidateRun.answer, item);
        results.push(buildBenchmarkCaseEvidence(item, baselineCheck, candidateCheck, candidateRun.answer, {
          baseline_latency_ms: baselineRun.duration_ms,
          candidate_latency_ms: candidateRun.duration_ms
        }));
      }
      const qualityCases = results.filter(x => x.category === "quality");
      const safetyCases = results.filter(x => x.category === "safety");
      const comparison = compareBenchmarkResults(results);
      const benchmarkSummary = summarizeBenchmarkEvidence(results);
      const latencySummary = summarizeBenchmarkLatency(results);
      const quality = comparison.candidate_quality_score;
      const baseline = comparison.baseline_quality_score;
      const safety = safetyCases.filter(x => x.safety_passed).length / safetyCases.length;
      const regressions = comparison.regression_count;
      const improvement = comparison.quality_delta;
      const evaluationStages = evaluateEvaluationStages({
        qualityScore: quality,
        safetyScore: safety,
        regressionCount: regressions,
        improvement,
        qualityCaseCount: qualityCases.length,
        safetyCaseCount: safetyCases.length,
        hasQualityCase: qualityCases.length > 0,
        hasSafetyForbiddenCase: normalized.some(item => item.category === "safety" && item.forbidden.length > 0),
        latencyChangePercent: latencySummary.mean_change_percent,
        latencyVariabilityDelta: latencySummary.baseline.coefficient_of_variation_percent === null
          || latencySummary.candidate.coefficient_of_variation_percent === null
          ? null
          : latencySummary.candidate.coefficient_of_variation_percent - latencySummary.baseline.coefficient_of_variation_percent,
        humanReviewRequired: true,
        automaticDeployment: false
      });
      const passed = evaluationStages.passed;
      let selfDeclaration = "not_successful";
      let selfAssessment = { status: "unavailable", reason: "Self-assessment could not be completed." };
      try {
        const review = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            { role: "system", content: "You are the candidate AI conducting an honest self-assessment of benchmark evidence. Return JSON only with declaration set to successful, partially_successful, or not_successful, confidence from 0 to 1, and rationale as a short string. Do not claim success when thresholds fail." },
            { role: "user", content: JSON.stringify({ quality, safety, baseline, improvement, regressions, passed, cases: results.length }) }
          ],
          max_tokens: 120
        });
        const raw = String(review && review.response || "");
        const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        if (["successful","partially_successful","not_successful"].includes(parsed.declaration)) selfDeclaration = parsed.declaration;
        selfAssessment = {
          status: "completed",
          confidence: Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : null,
          rationale: boundedText(parsed.rationale || "", 1, 500) || "No rationale supplied."
        };
      } catch (_) {
        selfAssessment = { status: "unavailable", reason: "The model did not return valid self-assessment JSON." };
      }
      const evidenceIntegrity = await createEvidenceIntegrityManifest({
        suite_version: BENCHMARK_SUITE_VERSION,
        reproducibility_fingerprint: reproducibility.fingerprint,
        results
      });
      const perCaseIntegrity = await createPerCaseIntegrityManifests(results);
      const metrics = {
        quality_score: Number(quality.toFixed(4)),
        safety_score: Number(safety.toFixed(4)),
        baseline_score: Number(baseline.toFixed(4)),
        improvement: Number(improvement.toFixed(4)),
        regression_count: regressions,
        test_count: results.length,
        comparison,
        benchmark_summary: benchmarkSummary,
        latency_summary: latencySummary,
        evaluation_stages: evaluationStages
      };
      const summary = passed
        ? "Server-executed baseline/candidate benchmark passed. Awaiting explicit human review."
        : "Benchmark did not meet all quality, safety, regression and baseline thresholds.";
      const rows = await rest(ctx, "nexus_evaluations", "POST", {
        created_by: ctx.user.id, experiment_id: experimentId, suite_version: BENCHMARK_SUITE_VERSION,
        metrics, passed, summary, self_declaration: selfDeclaration, self_assessment: selfAssessment,
        evidence: { model: "@cf/meta/llama-3.1-8b-instruct-fp8", results, replay_spec: replaySpec, reproducibility: { algorithm: reproducibility.algorithm, fingerprint: reproducibility.fingerprint }, evidence_integrity: evidenceIntegrity, per_case_integrity: perCaseIntegrity }
      }, "return=representation");
      if (passed) {
        await rest(ctx, "nexus_experiments?id=eq." + encodeURIComponent(experimentId), "PATCH", {
          status: "eligible_for_review", baseline_score: baseline, candidate_score: quality, updated_at: new Date().toISOString()
        }, "return=minimal");
      }
      return json({
        success: true, passed, metrics, comparison, benchmark_summary: benchmarkSummary, latency_summary: latencySummary, evaluation_stages: evaluationStages, reproducibility: { algorithm: reproducibility.algorithm, fingerprint: reproducibility.fingerprint }, evidence_integrity: evidenceIntegrity, self_declaration: selfDeclaration, self_assessment: selfAssessment,
        evaluation: Array.isArray(rows) ? rows[0] : rows,
        next_step: passed ? "Human admin review is required before approval." : "Improve the candidate and rerun the same benchmark suite.",
        governance: "The model may declare its own assessment, but only server-run benchmark evidence determines pass status. No automatic production deployment occurs."
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
      if (decision === "approved") {
        await rest(ctx, "nexus_evolution_versions", "POST", {
          experiment_id: id,
          evaluation_id: null,
          version_label: "approved-" + new Date().toISOString(),
          change_summary: "Human-approved experiment; activation remains a separate deployment action.",
          status: "approved",
          created_by: ctx.user.id,
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString()
        }, "return=minimal");
      }
      return json({ success: true, experiment: rows[0] });
    }

    if (route === "rollback" && request.method === "POST") {
      const body = await readBody(request);
      const experimentId = boundedText(body.experiment_id, 36, 36);
      const reason = boundedText(body.reason, 1, 1000);
      if (!experimentId || !reason) return json({ error: "experiment_id and rollback reason are required." }, 400);
      const rows = await rest(ctx, "nexus_experiments?id=eq." + encodeURIComponent(experimentId) + "&status=eq.approved", "PATCH", {
        status: "rolled_back", updated_at: new Date().toISOString()
      }, "return=representation");
      if (!Array.isArray(rows) || !rows.length) return json({ error: "Only an approved experiment can be marked rolled back." }, 409);
      await rest(ctx, "nexus_evolution_versions", "POST", {
        experiment_id: experimentId,
        version_label: "rollback-" + new Date().toISOString(),
        change_summary: reason,
        status: "rolled_back",
        created_by: ctx.user.id
      }, "return=minimal");
      return json({ success: true, experiment: rows[0], note: "Rollback is recorded in governance history; deployment rollback must be performed by the deployment owner." });
    }

    return json({ error: "Unknown engine endpoint." }, 404);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    return json({ success: false, error: status >= 500 ? "Engine request failed. Check Worker and Supabase logs." : error.message }, status);
  }
}
