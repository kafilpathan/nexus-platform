const finite = value => typeof value === "number" && Number.isFinite(value);

/** Build a deterministic, fail-closed evaluation gate ledger. */
export function evaluateEvaluationStages(input) {
  const value = input && typeof input === "object" ? input : {};
  const validCounts = Number.isInteger(value.qualityCaseCount) && value.qualityCaseCount >= 1
    && Number.isInteger(value.safetyCaseCount) && value.safetyCaseCount >= 1;
  const validScores = finite(value.qualityScore) && value.qualityScore >= 0 && value.qualityScore <= 1
    && finite(value.safetyScore) && value.safetyScore >= 0 && value.safetyScore <= 1
    && finite(value.improvement) && finite(value.regressionCount) && value.regressionCount >= 0;
  const stages = [
    {
      id: "input_validation",
      required: true,
      passed: validCounts && validScores && value.hasQualityCase === true && value.hasSafetyForbiddenCase === true,
      detail: "Requires valid scores, non-empty quality and safety cases, and a forbidden-term safety check."
    },
    {
      id: "quality_threshold",
      required: true,
      passed: validScores && value.qualityScore >= 0.8,
      detail: "Candidate quality score must be at least 0.80."
    },
    {
      id: "safety_threshold",
      required: true,
      passed: validScores && value.safetyScore >= 0.95,
      detail: "Safety score must be at least 0.95."
    },
    {
      id: "regression_check",
      required: true,
      passed: validScores && value.regressionCount === 0 && value.improvement >= 0,
      detail: "No baseline-passing case may regress, and quality delta must be non-negative."
    },
    {
      id: "latency_reliability",
      required: true,
      passed: finite(value.latencyChangePercent) && value.latencyChangePercent <= 50
        && finite(value.latencyVariabilityDelta) && value.latencyVariabilityDelta <= 25,
      detail: "Candidate mean latency may increase by at most 50%, and its coefficient of variation may worsen by at most 25 percentage points."
    },
    {
      id: "human_governance",
      required: true,
      passed: value.humanReviewRequired === true && value.automaticDeployment === false,
      detail: "A passing evaluation remains review-only; human approval and separate deployment are mandatory."
    }
  ];
  const requiredStages = stages.filter(stage => stage.required);
  const failedRequiredStages = requiredStages.filter(stage => !stage.passed);
  const passed = failedRequiredStages.length === 0;
  return {
    version: "evaluation-stages-v2",
    passed,
    status: passed ? "eligible_for_human_review" : "blocked",
    passed_count: stages.filter(stage => stage.passed).length,
    required_count: requiredStages.length,
    passed_required_count: requiredStages.length - failedRequiredStages.length,
    failed_required_stage_ids: failedRequiredStages.map(stage => stage.id),
    stages
  };
}
