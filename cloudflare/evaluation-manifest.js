export const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableSerialize(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createEvaluationManifest({ baselinePrompt, candidatePrompt, cases, suiteVersion, modelId = MODEL_ID, createdAt = new Date().toISOString() }) {
  const normalizedCases = cases.map(item => ({
    input: item.input,
    expected: [...item.expected],
    forbidden: [...item.forbidden],
    category: item.category
  }));
  const [baselinePromptHash, candidatePromptHash, casesHash] = await Promise.all([
    sha256Hex(baselinePrompt),
    sha256Hex(candidatePrompt),
    sha256Hex(normalizedCases)
  ]);
  return {
    manifest_version: "evaluation-manifest-v1",
    suite_version: suiteVersion,
    model_id: modelId,
    created_at: createdAt,
    baseline_prompt_sha256: baselinePromptHash,
    candidate_prompt_sha256: candidatePromptHash,
    cases_sha256: casesHash,
    case_count: normalizedCases.length,
    cases: normalizedCases
  };
}
