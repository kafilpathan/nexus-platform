export function summarizeBenchmarkLatency(results) {
  if (!Array.isArray(results) || results.length === 0) throw new TypeError("Latency evidence must contain at least one case.");
  const baseline = [];
  const candidate = [];
  for (const item of results) {
    if (!item || !Number.isFinite(item.baseline_latency_ms) || item.baseline_latency_ms < 0
      || !Number.isFinite(item.candidate_latency_ms) || item.candidate_latency_ms < 0) {
      throw new TypeError("Every case needs finite non-negative baseline and candidate latency values.");
    }
    baseline.push(item.baseline_latency_ms);
    candidate.push(item.candidate_latency_ms);
  }
  const stats = values => {
    const sorted = [...values].sort((a,b) => a-b);
    const mean = values.reduce((sum,value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum,value) => sum + ((value - mean) ** 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
    return {
      mean_ms: Number(mean.toFixed(2)),
      median_ms: Number(((sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2).toFixed(2)),
      p95_ms: Number(percentile(0.95).toFixed(2)),
      min_ms: Number(sorted[0].toFixed(2)),
      max_ms: Number(sorted[sorted.length - 1].toFixed(2)),
      stddev_ms: Number(stddev.toFixed(2)),
      coefficient_of_variation_percent: mean === 0 ? null : Number(((stddev / mean) * 100).toFixed(2))
    };
  };
  const baselineStats = stats(baseline);
  const candidateStats = stats(candidate);
  return {
    case_count: results.length,
    baseline: baselineStats,
    candidate: candidateStats,
    mean_delta_ms: Number((candidateStats.mean_ms - baselineStats.mean_ms).toFixed(2)),
    mean_change_percent: baselineStats.mean_ms === 0 ? null : Number((((candidateStats.mean_ms - baselineStats.mean_ms) / baselineStats.mean_ms) * 100).toFixed(2))
  };
}
