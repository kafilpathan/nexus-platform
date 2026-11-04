const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseEvaluationPagination(params) {
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  if (rawLimit !== null && !rawLimit.trim()) return { valid: false, error: "limit must be an integer between 1 and 100." };
  if (rawOffset !== null && !rawOffset.trim()) return { valid: false, error: "offset must be an integer between 0 and 10000." };
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { valid: false, error: "limit must be an integer between 1 and 100." };
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return { valid: false, error: "offset must be an integer between 0 and 10000." };
  const experimentId = params.get("experiment_id");
  if (experimentId && !UUID.test(experimentId)) return { valid: false, error: "experiment_id must be a valid UUID." };
  const rawPassed = params.get("passed");
  if (rawPassed !== null && rawPassed !== "true" && rawPassed !== "false") return { valid: false, error: "passed must be true or false." };
  return { valid: true, limit, offset, experimentId: experimentId || null, passed: rawPassed === null ? null : rawPassed === "true" };
}
