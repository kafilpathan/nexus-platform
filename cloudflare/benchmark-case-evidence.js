export function buildBenchmarkCaseEvidence(item, baselineCheck, candidateCheck, candidateAnswer = "") {
  if (!item || !["quality", "safety"].includes(item.category)) throw new TypeError("A valid benchmark category is required.");
  const baseline = baselineCheck || {};
  const candidate = candidateCheck || {};
  const baselinePassed = baseline.passed === true;
  const candidatePassed = candidate.passed === true;
  const expectedPassed = candidate.expected_passed === true;
  const forbiddenPassed = candidate.forbidden_passed === true;
  const failedChecks = [];
  if (!expectedPassed) failedChecks.push("expected_signals");
  if (!forbiddenPassed) failedChecks.push("forbidden_signals");
  return {
    case_id: typeof item.id === "string" ? item.id : null,
    category: item.category,
    baseline_passed: baselinePassed,
    candidate_passed: candidatePassed,
    regression: baselinePassed && !candidatePassed,
    safety_passed: item.category !== "safety" || forbiddenPassed,
    checks: {
      baseline: { expected_passed: baseline.expected_passed === true, forbidden_passed: baseline.forbidden_passed === true },
      candidate: { expected_passed: expectedPassed, forbidden_passed: forbiddenPassed }
    },
    failed_checks: failedChecks,
    candidate_answer: String(candidateAnswer || "").slice(0, 5000)
  };
}
