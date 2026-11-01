import { evolve } from "./evolution/engine.mjs";
import { assessCandidate } from "./evolution/assessor.mjs";
import { createKnowledgeNode, createKnowledgeEdge, traverseKnowledgeGraph } from "./evolution/knowledge-graph.mjs";
import { combineHybridReasoning } from "./evolution/hybrid-reasoner.mjs";
import { requestGenerativeProposals } from "./evolution/generative-proposals.mjs";
import {
  listExperiments, saveExperiment, saveEvaluation, listKnowledgeGraph,
  saveKnowledgeNode, saveKnowledgeEdge, markExperimentEligible, reviewExperiment
} from "./evolution/supabase-store.mjs";

(() => {
  const anchor = document.getElementById("nexus-intelligence");
  if (!anchor || document.getElementById("nexus-evolution-console")) return;

  const section = document.createElement("section");
  section.id = "nexus-evolution-console";
  section.className = "wrap";
  section.innerHTML = `
    <style>
      #nexus-evolution-console{margin:40px auto;padding:22px;border:1px solid #31506a;border-radius:22px;background:#0b1220;color:#f4f7ff}
      #nexus-evolution-console *{box-sizing:border-box}
      #nexus-evolution-console .ec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
      #nexus-evolution-console .ec-panel{min-width:0;padding:16px;border:1px solid #30415b;border-radius:15px;background:#080e1a}
      #nexus-evolution-console h2{font-size:clamp(26px,4vw,38px);margin:8px 0}
      #nexus-evolution-console h3{margin:0 0 8px}
      #nexus-evolution-console p{color:#aebbd0;font-size:13px;line-height:1.55}
      #nexus-evolution-console label{display:block;margin:10px 0 5px;font-size:12px;font-weight:800;color:#dbe6f7}
      #nexus-evolution-console input,#nexus-evolution-console textarea,#nexus-evolution-console select{width:100%;padding:10px 11px;border:1px solid #3a4b67;border-radius:9px;background:#101a2b;color:#f4f7ff;font:inherit}
      #nexus-evolution-console textarea{min-height:74px;resize:vertical}
      #nexus-evolution-console button{border:0;border-radius:9px;padding:10px 13px;margin:9px 6px 0 0;background:#7df1df;color:#07131d;font-weight:850;cursor:pointer}
      #nexus-evolution-console button.secondary{background:#27364d;color:#eef4ff}
      #nexus-evolution-console button:disabled{opacity:.5;cursor:wait}
      #nexus-evolution-console pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-radius:10px;background:#101a2b;color:#dce7f8;font:12px/1.55 ui-monospace,monospace;max-height:340px;overflow:auto}
      #nexus-evolution-console .ec-status{min-height:22px;color:#7df1df;font-size:12px;margin-top:12px}
      #nexus-evolution-console .ec-small{font-size:11px;color:#91a2bc}
      #nexus-evolution-console .ec-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #nexus-evolution-console .ec-node{padding:9px;border:1px solid #2c3c55;border-radius:9px;margin-top:7px;font-size:12px}
      #nexus-evolution-console .ec-top{color:#7df1df;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:900}
      @media(max-width:760px){#nexus-evolution-console .ec-grid{grid-template-columns:1fr}}
    </style>
    <div class="ec-top">KAF-AI / Evolution Engine v1</div>
    <h2>Self-assessment. Knowledge. Evolution.</h2>
    <p>Admin-only experimental workspace. AI output is unverified; evaluation results are recommendations for human review, never production approvals.</p>
    <div id="ec-access" class="ec-status" role="status">Checking NEXUS admin access…</div>
    <div class="ec-grid">
      <article class="ec-panel">
        <h3>01 · Generative proposal lab</h3>
        <p>Generate candidate ideas with the existing KAF-AI inference endpoint. This is model inference, not GAN/VAE training.</p>
        <label for="ec-objective">Objective</label>
        <textarea id="ec-objective" maxlength="1800" placeholder="Describe the improvement you want to explore…"></textarea>
        <label for="ec-constraints">Constraints (one per line)</label>
        <textarea id="ec-constraints" maxlength="1200" placeholder="Free-first; no production changes; privacy-preserving"></textarea>
        <button id="ec-generate" type="button">Generate proposals</button>
        <button id="ec-save-proposal" class="secondary" type="button" disabled>Save as experiment</button>
        <pre id="ec-proposal" aria-live="polite">No proposal generated yet.</pre>
      </article>
      <article class="ec-panel">
        <h3>02 · Evolutionary optimizer</h3>
        <p>Run a reproducible genetic search over bounded demo parameters. The fitness objective is explicit and editable.</p>
        <div class="ec-row">
          <div><label for="ec-target-temperature">Target parameter A</label><input id="ec-target-temperature" type="number" min="0" max="2" step=".05" value=".7"></div>
          <div><label for="ec-target-context">Target parameter B</label><input id="ec-target-context" type="number" min="0" max="4" step=".05" value="2.4"></div>
        </div>
        <button id="ec-optimize" type="button">Run genetic search</button>
        <button id="ec-save-optimization" class="secondary" type="button" disabled>Save experiment</button>
        <pre id="ec-optimization">No experiment run yet.</pre>
      </article>
      <article class="ec-panel">
        <h3>03 · Self-assessment gates</h3>
        <p>Enter baseline and candidate evaluation metrics from the same test suite. Scores are not inferred from model confidence.</p>
        <div class="ec-row">
          <div><label for="ec-base-correct">Baseline correctness /100</label><input id="ec-base-correct" type="number" min="0" max="100" value="90"></div>
          <div><label for="ec-cand-correct">Candidate correctness /100</label><input id="ec-cand-correct" type="number" min="0" max="100" value="92"></div>
          <div><label for="ec-base-safety">Baseline safety /100</label><input id="ec-base-safety" type="number" min="0" max="100" value="99"></div>
          <div><label for="ec-cand-safety">Candidate safety /100</label><input id="ec-cand-safety" type="number" min="0" max="100" value="99"></div>
          <div><label for="ec-base-latency">Baseline latency ms</label><input id="ec-base-latency" type="number" min="0" value="1200"></div>
          <div><label for="ec-cand-latency">Candidate latency ms</label><input id="ec-cand-latency" type="number" min="0" value="1100"></div>
          <div><label for="ec-base-cost">Baseline cost units</label><input id="ec-base-cost" type="number" min="0" step=".01" value=".8"></div>
          <div><label for="ec-cand-cost">Candidate cost units</label><input id="ec-cand-cost" type="number" min="0" step=".01" value=".75"></div>
        </div>
        <label for="ec-experiment-select">Experiment to attach evaluation to</label>
        <select id="ec-experiment-select"><option value="">No saved experiment selected</option></select>
        <button id="ec-assess" type="button">Evaluate candidate</button>
        <button id="ec-save-assessment" class="secondary" type="button" disabled>Save evaluation</button>
        <pre id="ec-assessment">Waiting for evaluation metrics.</pre>
      </article>
      <article class="ec-panel">
        <h3>04 · Human review & continuous learning</h3>
        <p>Only an eligible experiment can be reviewed. “Approve” means approved for a staged test, not deployed to production.</p>
        <button id="ec-refresh-experiments" class="secondary" type="button">Refresh experiment ledger</button>
        <div id="ec-experiment-list" aria-live="polite" class="ec-small">Experiment ledger requires the reviewed Supabase migration.</div>
        <label for="ec-review-select">Select eligible experiment</label>
        <select id="ec-review-select"><option value="">No eligible experiment</option></select>
        <button id="ec-review-approve" type="button">Approve for staged test</button>
        <button id="ec-review-reject" class="secondary" type="button">Reject candidate</button>
      </article>
      <article class="ec-panel">
        <h3>05 · Knowledge graph</h3>
        <p>Save admin-reviewed knowledge nodes with source provenance, then connect them with typed relationships.</p>
        <label for="ec-node-label">Node label</label><input id="ec-node-label" maxlength="160" placeholder="e.g. Evolution Engine">
        <label for="ec-node-type">Node type</label><input id="ec-node-type" maxlength="40" value="concept">
        <label for="ec-node-description">Description</label><textarea id="ec-node-description" maxlength="1200" placeholder="What does this knowledge node represent?"></textarea>
        <label for="ec-node-url">Source URL (HTTPS only)</label><input id="ec-node-url" type="url" maxlength="500" placeholder="https://…">
        <button id="ec-add-node" type="button">Add knowledge node</button>
        <div class="ec-row">
          <div><label for="ec-edge-source">From node</label><select id="ec-edge-source"></select></div>
          <div><label for="ec-edge-target">To node</label><select id="ec-edge-target"></select></div>
        </div>
        <label for="ec-edge-type">Relationship</label><input id="ec-edge-type" maxlength="60" placeholder="supports / depends_on">
        <button id="ec-add-edge" class="secondary" type="button">Connect nodes</button>
        <label for="ec-graph-start">Explore from node</label><select id="ec-graph-start"></select>
        <button id="ec-graph-refresh" class="secondary" type="button">Refresh graph</button>
        <button id="ec-graph-traverse" class="secondary" type="button">Explore connections</button>
        <div id="ec-graph-list" class="ec-small">Knowledge graph needs the reviewed Supabase migration.</div>
      </article>
      <article class="ec-panel">
        <h3>06 · Hybrid reasoning boundary</h3>
        <p>Symbolic rules remain authoritative for permissions and release boundaries. Model text is always untrusted explanatory material.</p>
        <pre id="ec-hybrid">Policy boundary: model output cannot grant permissions, approve changes, or deploy code.</pre>
        <p class="ec-small">Verified facts must carry an external source and review status. Unverified proposals remain drafts.</p>
      </article>
    </div>
    <div id="ec-status" class="ec-status" role="status">Sign in through Admin Login to use the Evolution Engine.</div>
  `;
  anchor.after(section);

  const $ = id => section.querySelector("#" + id);
  const API = "https://nexus-kaf-ai.kumarchotu36553.workers.dev/api/chat";
  let adminUser = null, proposalDraft = "", optimization = null, assessment = null;
  let experiments = [], graph = { nodes: [], edges: [] };

  function status(message) { $("ec-status").textContent = message; }
  function access(message) { $("ec-access").textContent = message; }
  function number(id) {
    const value = Number($(id).value);
    if (!Number.isFinite(value) || value < 0) throw new TypeError("Enter valid non-negative metric values.");
    return value;
  }
  async function requireAdmin() {
    const client = window.nexusSupabaseClient;
    if (!client) throw new Error("Supabase client is not ready. Refresh and sign in again.");
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) throw new Error("Sign in through Admin Login first.");
    const check = await client.from("nexus_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (check.error || !check.data) throw new Error("NEXUS admin access is required.");
    adminUser = data.user;
    access("Authenticated NEXUS admin session verified.");
    return client;
  }
  function showError(prefix, error) {
    const message = error?.message || String(error);
    status(prefix + ": " + message + (message.includes("nexus_") ? " · Apply the reviewed evolution migration before using cloud storage." : ""));
  }
  async function refreshExperiments() {
    const client = await requireAdmin();
    experiments = await listExperiments(client);
    const select = $("ec-experiment-select"), review = $("ec-review-select");
    select.replaceChildren(); review.replaceChildren();
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = "No saved experiment selected"; select.append(empty);
    const reviewEmpty = document.createElement("option"); reviewEmpty.value = ""; reviewEmpty.textContent = "No eligible experiment"; review.append(reviewEmpty);
    experiments.forEach(item => {
      const option = document.createElement("option"); option.value = item.id; option.textContent = item.name + " · " + item.status; select.append(option);
      if (item.status === "eligible_for_review") { const reviewOption = document.createElement("option"); reviewOption.value = item.id; reviewOption.textContent = item.name; review.append(reviewOption); }
    });
    const list = $("ec-experiment-list"); list.replaceChildren();
    if (!experiments.length) list.textContent = "No experiments saved yet.";
    experiments.forEach(item => {
      const row = document.createElement("div"); row.className = "ec-node";
      row.textContent = item.name + " — " + item.status + " — baseline " + (item.baseline_score ?? "n/a") + " / candidate " + (item.candidate_score ?? "n/a");
      list.append(row);
    });
  }
  async function refreshGraph() {
    const client = await requireAdmin();
    graph = await listKnowledgeGraph(client);
    const selects = ["ec-edge-source", "ec-edge-target", "ec-graph-start"].map($);
    selects.forEach(select => {
      select.replaceChildren();
      graph.nodes.forEach(node => { const option = document.createElement("option"); option.value = node.id; option.textContent = node.label; select.append(option); });
    });
    const list = $("ec-graph-list"); list.replaceChildren();
    if (!graph.nodes.length) list.textContent = "No knowledge nodes saved yet.";
    graph.nodes.forEach(node => {
      const row = document.createElement("div"); row.className = "ec-node";
      row.textContent = node.label + " [" + node.node_type + "] · confidence " + node.confidence + (node.source_url ? " · " + node.source_url : "");
      list.append(row);
    });
    graph.edges.forEach(edge => {
      const from = graph.nodes.find(node => node.id === edge.source_node_id)?.label || "Unknown";
      const to = graph.nodes.find(node => node.id === edge.target_node_id)?.label || "Unknown";
      const row = document.createElement("div"); row.className = "ec-node"; row.textContent = from + " —" + edge.relation_type + "→ " + to; list.append(row);
    });
  }

  $("ec-generate").addEventListener("click", async () => {
    const button = $("ec-generate"), objective = $("ec-objective").value.trim();
    if (objective.length < 12) { status("Describe the objective in at least 12 characters."); return; }
    button.disabled = true; $("ec-proposal").textContent = "Generating candidate ideas…";
    try {
      await requireAdmin();
      const generated = await requestGenerativeProposals({
        endpoint: API, objective,
        constraints: $("ec-constraints").value.split("\n").map(line => line.trim()).filter(Boolean)
      });
      proposalDraft = generated.draft;
      const hybrid = combineHybridReasoning({
        facts: [], ruleFindings: [{ severity: "warn", detail: "Model-generated proposals are unverified." }],
        modelDraft: generated.draft
      });
      $("ec-proposal").textContent = generated.draft;
      $("ec-hybrid").textContent = "Decision: " + hybrid.decision + "\nTrust: " + hybrid.modelDraftTrust + "\nProduction authorization: " + hybrid.productionAuthorization + "\nHuman review required: " + hybrid.humanReviewRequired;
      $("ec-save-proposal").disabled = false;
      status("Proposal generated. It is unverified and has not changed the platform.");
    } catch (error) { showError("Generation failed", error); $("ec-proposal").textContent = error.message; }
    finally { button.disabled = false; }
  });

  $("ec-save-proposal").addEventListener("click", async () => {
    try {
      const client = await requireAdmin();
      const saved = await saveExperiment(client, {
        name: "Generative proposal · " + new Date().toLocaleDateString(),
        objective: $("ec-objective").value.trim(),
        parameters: { source: "existing_workers_ai_inference", type: "generative_proposal" },
        notes: proposalDraft
      });
      await refreshExperiments();
      status("Proposal saved as experiment " + saved.id + " · status proposed.");
    } catch (error) { showError("Save failed", error); }
  });

  $("ec-optimize").addEventListener("click", () => {
    try {
      const targetA = Number($("ec-target-temperature").value), targetB = Number($("ec-target-context").value);
      if (!Number.isFinite(targetA) || targetA < 0 || targetA > 2 || !Number.isFinite(targetB) || targetB < 0 || targetB > 4) throw new RangeError("Targets must stay inside the displayed search bounds.");
      optimization = evolve({
        searchSpace: { temperature: { min: 0, max: 2 }, contextWeight: { min: 0, max: 4 } },
        fitness: ({ temperature, contextWeight }) => -((temperature - targetA) ** 2) - ((contextWeight - targetB) ** 2),
        populationSize: 32, generations: 45, seed: 20261102
      });
      $("ec-optimization").textContent = JSON.stringify(optimization, null, 2);
      $("ec-save-optimization").disabled = false;
      status("Genetic search completed locally. Candidate settings are experimental only.");
    } catch (error) { showError("Optimization failed", error); }
  });

  $("ec-save-optimization").addEventListener("click", async () => {
    try {
      const client = await requireAdmin();
      const saved = await saveExperiment(client, {
        name: "Genetic search · " + new Date().toLocaleDateString(),
        objective: "Optimize bounded demo settings against an explicit target fitness function.",
        parameters: optimization,
        candidateScore: optimization.bestFitness,
        notes: "Seeded local experiment; no production configuration changed."
      });
      await refreshExperiments();
      $("ec-experiment-select").value = saved.id;
      status("Genetic experiment saved as proposed.");
    } catch (error) { showError("Save failed", error); }
  });

  $("ec-assess").addEventListener("click", () => {
    try {
      assessment = assessCandidate({
        baseline: { correctness: number("ec-base-correct"), safety: number("ec-base-safety"), latencyMs: number("ec-base-latency"), costUnits: number("ec-base-cost") },
        candidate: { correctness: number("ec-cand-correct"), safety: number("ec-cand-safety"), latencyMs: number("ec-cand-latency"), costUnits: number("ec-cand-cost") }
      });
      $("ec-assessment").textContent = JSON.stringify(assessment, null, 2);
      $("ec-save-assessment").disabled = false;
      status(assessment.status === "eligible_for_review" ? "All gates passed. This candidate is eligible for human review only." : "Candidate failed one or more quality gates.");
    } catch (error) { showError("Assessment failed", error); }
  });

  $("ec-save-assessment").addEventListener("click", async () => {
    try {
      const client = await requireAdmin();
      const experimentId = $("ec-experiment-select").value || null;
      const saved = await saveEvaluation(client, {
        experimentId,
        suiteVersion: "manual-metrics-v1",
        metrics: assessment,
        passed: assessment.status === "eligible_for_review",
        summary: "Deterministic gates: " + assessment.checks.filter(x => x.passed).length + "/" + assessment.checks.length + " passed."
      });
      if (assessment.status === "eligible_for_review" && experimentId) await markExperimentEligible(client, experimentId, assessment.weightedScore);
      await refreshExperiments();
      status("Evaluation saved (" + saved.id + "). " + (experimentId && assessment.status === "eligible_for_review" ? "Experiment moved to eligible_for_review." : "No experiment status changed."));
    } catch (error) { showError("Save failed", error); }
  });

  async function decideReview(decision) {
    try {
      const client = await requireAdmin(), id = $("ec-review-select").value;
      if (!id) throw new Error("Select an eligible experiment first.");
      const message = decision === "approved"
        ? "Approve this candidate for a staged test only? This will NOT deploy it."
        : "Reject this candidate?";
      if (!window.confirm(message)) return;
      await reviewExperiment(client, id, decision);
      await refreshExperiments();
      status("Human review recorded: " + decision + ". No deployment occurred.");
    } catch (error) { showError("Review failed", error); }
  }
  $("ec-review-approve").addEventListener("click", () => decideReview("approved"));
  $("ec-review-reject").addEventListener("click", () => decideReview("rejected"));
  $("ec-refresh-experiments").addEventListener("click", async () => { try { await refreshExperiments(); status("Experiment ledger refreshed."); } catch (error) { showError("Ledger unavailable", error); } });

  $("ec-add-node").addEventListener("click", async () => {
    try {
      const node = createKnowledgeNode({
        label: $("ec-node-label").value, nodeType: $("ec-node-type").value,
        description: $("ec-node-description").value, sourceUrl: $("ec-node-url").value || null,
        confidence: 0.5
      });
      const client = await requireAdmin();
      await saveKnowledgeNode(client, node);
      $("ec-node-label").value = ""; $("ec-node-description").value = ""; $("ec-node-url").value = "";
      await refreshGraph(); status("Knowledge node saved with source provenance.");
    } catch (error) { showError("Node save failed", error); }
  });
  $("ec-add-edge").addEventListener("click", async () => {
    try {
      const edge = createKnowledgeEdge({
        sourceId: $("ec-edge-source").value, targetId: $("ec-edge-target").value,
        relationType: $("ec-edge-type").value, confidence: 0.5
      }, new Set(graph.nodes.map(node => node.id)));
      const client = await requireAdmin();
      await saveKnowledgeEdge(client, edge);
      await refreshGraph(); status("Knowledge relationship saved.");
    } catch (error) { showError("Edge save failed", error); }
  });
  $("ec-graph-refresh").addEventListener("click", async () => { try { await refreshGraph(); status("Knowledge graph refreshed."); } catch (error) { showError("Graph unavailable", error); } });
  $("ec-graph-traverse").addEventListener("click", () => {
    try {
      const found = traverseKnowledgeGraph({ nodes: graph.nodes, edges: graph.edges, startId: $("ec-graph-start").value, maxDepth: 2, maxNodes: 30 });
      const list = $("ec-graph-list"); list.replaceChildren();
      found.forEach(node => { const row = document.createElement("div"); row.className = "ec-node"; row.textContent = node.label + " — " + node.description; list.append(row); });
      status("Graph traversal returned " + found.length + " node(s).");
    } catch (error) { showError("Traversal failed", error); }
  });

  async function refreshAll() {
    try {
      await requireAdmin();
      status("Admin access verified. Local tools are ready; cloud tables require the reviewed migration.");
      try { await refreshExperiments(); } catch (error) { $("ec-experiment-list").textContent = "Experiment ledger not available yet: " + error.message; }
      try { await refreshGraph(); } catch (error) { $("ec-graph-list").textContent = "Knowledge graph not available yet: " + error.message; }
    } catch (error) { adminUser = null; access(error.message); status("Sign in through Admin Login to unlock this workspace."); }
  }
  refreshAll();
  if (window.nexusSupabaseClient?.auth?.onAuthStateChange) {
    window.nexusSupabaseClient.auth.onAuthStateChange(() => { Promise.resolve().then(refreshAll); });
  }
})();
