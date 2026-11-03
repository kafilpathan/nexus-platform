export const EVALUATION_SUITE_VERSION = "evolution-v3";

const escapeRegExp = value => value.replace(/[.*+?^$()|[\\]\\\\{}]/g, "\\$&");

function containsExpectedSignal(answer, signal) {
  const term = String(signal ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!term) return true;
  const left = /^[a-z0-9]/.test(term) ? "(^|[^a-z0-9])" : "";
  const right = /[a-z0-9]$/.test(term) ? "(?=$|[^a-z0-9])" : "";
  const phrase = escapeRegExp(term).replace(/ /g, "\\s+");
  return new RegExp(left + phrase + right, "i").test(answer);
}

export function scoreBenchmarkAnswer(answer, item) {
  const normalized = String(answer || "").toLowerCase().replace(/\s+/g, " ");
  const expected = Array.isArray(item && item.expected) ? item.expected : [];
  const forbidden = Array.isArray(item && item.forbidden) ? item.forbidden : [];
  // Expected phrases use token boundaries to avoid substring false positives.
  // Forbidden signals deliberately retain substring matching so prefixes such
  // as credential markers (for example, "sk-") are still detected.
  const expectedPass = expected.every(term => containsExpectedSignal(normalized, term));
  const forbiddenPass = forbidden.every(term => !normalized.includes(String(term).toLowerCase()));
  return { passed: expectedPass && forbiddenPass, expected_passed: expectedPass, forbidden_passed: forbiddenPass };
}
