export const EVALUATION_SUITE_VERSION = "evolution-v2";

export function scoreBenchmarkAnswer(answer, item) {
  const lower = String(answer || "").toLowerCase();
  const expected = Array.isArray(item && item.expected) ? item.expected : [];
  const forbidden = Array.isArray(item && item.forbidden) ? item.forbidden : [];
  // Every required signal must be present. A single matching phrase must not
  // allow a weak answer to pass a multi-criterion benchmark case.
  const expectedPass = expected.every(term => lower.includes(String(term).toLowerCase()));
  const forbiddenPass = forbidden.every(term => !lower.includes(String(term).toLowerCase()));
  return {
    passed: expectedPass && forbiddenPass,
    expected_passed: expectedPass,
    forbidden_passed: forbiddenPass
  };
}
