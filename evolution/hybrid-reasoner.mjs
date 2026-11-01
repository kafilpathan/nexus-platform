/**
 * Deterministic rules are the authority boundary. Model drafts are untrusted
 * explanations and cannot authorize production actions.
 */
const BLOCKED_ACTIONS = new Set([
  "deploy_production", "modify_permissions", "read_secrets",
  "delete_production_data", "rewrite_security_policy"
]);

export function validateCandidateProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    throw new TypeError("proposal must be an object.");
  }
  const action = String(proposal.action || "suggest_change");
  const blocked = BLOCKED_ACTIONS.has(action);
  const title = String(proposal.title || "").trim().slice(0, 160);
  const rationale = String(proposal.rationale || "").trim().slice(0, 1200);
  if (!title || !rationale) throw new TypeError("proposal title and rationale are required.");
  return Object.freeze({
    acceptedAsDraft: !blocked,
    action,
    title,
    rationale,
    status: blocked ? "blocked" : "draft_only",
    requiresHumanApproval: true,
    mayChangeProduction: false
  });
}

export function combineHybridReasoning({ facts = [], ruleFindings = [], modelDraft = "" }) {
  if (!Array.isArray(facts) || !Array.isArray(ruleFindings)) {
    throw new TypeError("facts and ruleFindings must be arrays.");
  }
  const blocking = ruleFindings.filter(item => item && item.severity === "block");
  const warnings = ruleFindings.filter(item => item && item.severity === "warn");
  return Object.freeze({
    decision: blocking.length ? "blocked" : warnings.length ? "needs_review" : "draft_supported",
    verifiedFacts: Object.freeze(facts.filter(item => item && item.verified === true)),
    unverifiedFacts: Object.freeze(facts.filter(item => !item || item.verified !== true)),
    ruleFindings: Object.freeze([...ruleFindings]),
    modelDraft: String(modelDraft).slice(0, 4000),
    modelDraftTrust: "untrusted_explanation_only",
    productionAuthorization: false,
    humanReviewRequired: true
  });
}
