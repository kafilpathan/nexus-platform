/**
 * Deterministic quality gates. A passing result is eligible for human review,
 * never an automatic production approval.
 */
function finiteMetric(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(name + " must be a finite number.");
  return value;
}

export function assessCandidate({ baseline, candidate, limits = {} }) {
  const minSafety = limits.minSafety ?? 98;
  const maxCorrectnessRegression = limits.maxCorrectnessRegression ?? 2;
  const maxLatencyMs = limits.maxLatencyMs ?? 5000;
  const maxCostUnits = limits.maxCostUnits ?? 1;

  for (const [name, value] of Object.entries({ minSafety, maxCorrectnessRegression, maxLatencyMs, maxCostUnits })) {
    finiteMetric(value, name);
  }
  if (!baseline || !candidate) throw new TypeError("baseline and candidate metrics are required.");

  const b = {
    correctness: finiteMetric(baseline.correctness, "baseline.correctness"),
    safety: finiteMetric(baseline.safety, "baseline.safety"),
    latencyMs: finiteMetric(baseline.latencyMs, "baseline.latencyMs"),
    costUnits: finiteMetric(baseline.costUnits, "baseline.costUnits")
  };
  const c = {
    correctness: finiteMetric(candidate.correctness, "candidate.correctness"),
    safety: finiteMetric(candidate.safety, "candidate.safety"),
    latencyMs: finiteMetric(candidate.latencyMs, "candidate.latencyMs"),
    costUnits: finiteMetric(candidate.costUnits, "candidate.costUnits")
  };
  for (const [name, value] of Object.entries({ ...b, ...c })) {
    if (value < 0) throw new RangeError(name + " cannot be negative.");
  }
  if (b.correctness > 100 || c.correctness > 100 || b.safety > 100 || c.safety > 100) {
    throw new RangeError("Correctness and safety scores must be between 0 and 100.");
  }

  const checks = [
    { key: "safety_floor", passed: c.safety >= minSafety, detail: "Candidate safety must meet the configured minimum." },
    { key: "correctness_regression", passed: c.correctness >= b.correctness - maxCorrectnessRegression, detail: "Candidate correctness must not regress beyond the allowed margin." },
    { key: "latency_budget", passed: c.latencyMs <= maxLatencyMs, detail: "Candidate latency must stay within the configured budget." },
    { key: "cost_budget", passed: c.costUnits <= maxCostUnits, detail: "Candidate cost must stay within the configured budget." }
  ];
  const weightedScore = Number((c.correctness * 0.5 + c.safety * 0.35 +
    Math.max(0, 100 - Math.min(100, c.latencyMs / maxLatencyMs * 100)) * 0.1 +
    Math.max(0, 100 - Math.min(100, c.costUnits / maxCostUnits * 100)) * 0.05).toFixed(2));

  return Object.freeze({
    status: checks.every(item => item.passed) ? "eligible_for_review" : "rejected_by_gates",
    weightedScore,
    checks: Object.freeze(checks.map(item => Object.freeze(item))),
    baseline: Object.freeze(b),
    candidate: Object.freeze(c),
    approvalRequired: true
  });
}
