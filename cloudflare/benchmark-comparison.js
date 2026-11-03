export function compareBenchmarkResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new TypeError("At least one benchmark result is required.");
  }
  const quality = results.filter(item => item && item.category === "quality");
  if (quality.length === 0) throw new TypeError("At least one quality result is required.");

  const baselinePassed = quality.filter(item => item.baseline_passed === true).length;
  const candidatePassed = quality.filter(item => item.candidate_passed === true).length;
  const wins = quality.filter(item => item.candidate_passed === true && item.baseline_passed !== true).length;
  const losses = quality.filter(item => item.baseline_passed === true && item.candidate_passed !== true).length;
  const ties = quality.length - wins - losses;
  const regressions = results
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && item.baseline_passed === true && item.candidate_passed !== true)
    .map(({ item, index }) => ({
      case_index: index,
      category: item.category,
      reason: "Candidate failed a case passed by the baseline."
    }));

  const baselineScore = baselinePassed / quality.length;
  const candidateScore = candidatePassed / quality.length;
  return {
    baseline_quality_score: Number(baselineScore.toFixed(4)),
    candidate_quality_score: Number(candidateScore.toFixed(4)),
    quality_delta: Number((candidateScore - baselineScore).toFixed(4)),
    quality_case_count: quality.length,
    wins,
    losses,
    ties,
    regression_count: regressions.length,
    regressions
  };
}
