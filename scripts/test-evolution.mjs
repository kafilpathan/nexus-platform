import assert from "node:assert/strict";
import { evolve } from "../evolution/engine.mjs";
import { assessCandidate } from "../nexus_netlify_ready/evolution/assessor.mjs";
import { createKnowledgeNode, createKnowledgeEdge, traverseKnowledgeGraph } from "../nexus_netlify_ready/evolution/knowledge-graph.mjs";
import { validateCandidateProposal, combineHybridReasoning } from "../nexus_netlify_ready/evolution/hybrid-reasoner.mjs";
import { buildProposalPrompt, requestGenerativeProposals } from "../nexus_netlify_ready/evolution/generative-proposals.mjs";

const options = {
  searchSpace: { temperature: { min: 0, max: 2 }, contextWeight: { min: 0, max: 4 } },
  fitness: ({ temperature, contextWeight }) => -((temperature - 0.7) ** 2) - ((contextWeight - 2.4) ** 2),
  populationSize: 40, generations: 60, seed: 123
};
const first = evolve(options);
assert.deepEqual(first, evolve(options), "same seed and inputs must be reproducible");
assert.ok(first.bestFitness > -0.2);
assert.equal(first.evaluations, 40 * 61);
assert.throws(() => evolve({ ...options, searchSpace: { x: { min: 2, max: 1 } } }), /finite min\/max bounds/);
assert.throws(() => evolve({ ...options, fitness: () => Number.NaN }), /finite number/);

const assessment = assessCandidate({
  baseline: { correctness: 90, safety: 99, latencyMs: 1200, costUnits: 0.8 },
  candidate: { correctness: 92, safety: 99, latencyMs: 1100, costUnits: 0.75 }
});
assert.equal(assessment.status, "eligible_for_review");
assert.equal(assessment.approvalRequired, true);
assert.equal(assessCandidate({
  baseline: { correctness: 90, safety: 99, latencyMs: 1200, costUnits: 0.8 },
  candidate: { correctness: 91, safety: 80, latencyMs: 1100, costUnits: 0.75 }
}).status, "rejected_by_gates");

const n1 = createKnowledgeNode({ id: "a", label: "Memory Core", nodeType: "module", description: "User-scoped memory", sourceUrl: "https://example.org/memory" });
const n2 = createKnowledgeNode({ id: "b", label: "Evolution Engine", nodeType: "module", description: "Bounded optimizer" });
const edge = createKnowledgeEdge({ sourceId: "a", targetId: "b", relationType: "supports" }, new Set(["a", "b"]));
assert.equal(edge.relationType, "supports");
assert.throws(() => createKnowledgeEdge({ sourceId: "a", targetId: "x", relationType: "depends_on" }, new Set(["a", "b"])), /Both edge endpoints/);
assert.throws(() => createKnowledgeNode({ label: "bad", nodeType: "source", description: "bad", sourceUrl: "http://example.org" }), /HTTPS/);
const traversed = traverseKnowledgeGraph({
  nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
  edges: [{ source_node_id: "a", target_node_id: "b" }],
  startId: "a"
});
assert.deepEqual(traversed.map(node => node.id), ["a", "b"]);

assert.equal(validateCandidateProposal({ title: "Try a cache", rationale: "Measure latency first." }).status, "draft_only");
assert.equal(validateCandidateProposal({ action: "deploy_production", title: "Deploy", rationale: "Model suggested it." }).status, "blocked");
const hybrid = combineHybridReasoning({ facts: [{ text: "guess", verified: false }], ruleFindings: [{ severity: "block" }], modelDraft: "draft" });
assert.equal(hybrid.decision, "blocked");
assert.equal(hybrid.productionAuthorization, false);

const prompt = buildProposalPrompt({ objective: "Improve answer consistency across test cases." });
assert.match(prompt, /Return JSON/);
assert.match(prompt, /not GAN\/VAE training|proposal generator/i);
const generated = await requestGenerativeProposals({
  endpoint: "https://example.org/api/chat",
  objective: "Improve answer consistency across test cases.",
  fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.useMemory, false);
    return { ok: true, json: async () => ({ success: true, reply: "Draft proposal" }) };
  }
});
assert.equal(generated.trust, "unverified_model_output");

console.log("PASS Evolution Engine: optimizer, assessor, graph, hybrid rules, and proposal adapter");
