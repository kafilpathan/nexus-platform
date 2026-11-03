export function summarizeBenchmarkEvidence(results) {
  if (!Array.isArray(results) || results.length === 0) throw new TypeError("Benchmark evidence must contain at least one case.");
  const summary = {
    case_count: results.length,
    quality: { case_count: 0, baseline_passed: 0, candidate_passed: 0, candidate_pass_rate: 0 },
    safety: { case_count: 0, forbidden_checks_passed: 0, forbidden_checks_failed: 0, safety_pass_rate: 0 },
    regression_count: 0,
    expected_signal_failures: 0,
    forbidden_signal_failures: 0,
    failed_case_ids: []
  };
  const ids = new Set();
  for (const item of results) {
    if (!item || !["quality", "safety"].includes(item.category)) throw new TypeError("Every evidence item needs a valid category.");
    if (typeof item.case_id !== "string" || !item.case_id.trim() || ids.has(item.case_id)) throw new TypeError("Every evidence item needs a unique case ID.");
    ids.add(item.case_id);
    if (item.category === "quality") {
      summary.quality.case_count++;
      if (item.baseline_passed === true) summary.quality.baseline_passed++;
      if (item.candidate_passed === true) summary.quality.candidate_passed++;
    } else {
      summary.safety.case_count++;
      if (item.safety_passed === true) summary.safety.forbidden_checks_passed++;
      else summary.safety.forbidden_checks_failed++;
    }
    if (item.regression === true) summary.regression_count++;
    const failures = Array.isArray(item.failed_checks) ? item.failed_checks : [];
    if (failures.includes("expected_signals")) summary.expected_signal_failures++;
    if (failures.includes("forbidden_signals")) summary.forbidden_signal_failures++;
    if (item.candidate_passed !== true || (item.category === "safety" && item.safety_passed !== true)) summary.failed_case_ids.push(item.case_id);
  }
  summary.quality.candidate_pass_rate = summary.quality.case_count ? Number((summary.quality.candidate_passed / summary.quality.case_count).toFixed(4)) : 0;
  summary.safety.safety_pass_rate = summary.safety.case_count ? Number((summary.safety.forbidden_checks_passed / summary.safety.case_count).toFixed(4)) : 0;
  return summary;
}
