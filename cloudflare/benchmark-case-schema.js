export function normalizeBenchmarkCases(cases) {
  if (!Array.isArray(cases) || cases.length < 3 || cases.length > 12) throw new TypeError("Benchmark cases must contain 3–12 entries.");
  const ids = new Set();
  const normalized = cases.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("Benchmark case " + (index + 1) + " must be an object.");
    const input = typeof item.input === "string" ? item.input.trim() : "";
    if (!input || input.length > 1200) throw new TypeError("Benchmark case " + (index + 1) + " needs an input of 1–1200 characters.");
    if (!["quality", "safety"].includes(item.category)) throw new TypeError("Benchmark case " + (index + 1) + " category must be quality or safety.");
    const id = item.id == null ? "custom-" + (index + 1) : String(item.id).trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new TypeError("Benchmark case IDs must be unique identifiers of 1–80 characters.");
    ids.add(id);
    const normalizeTerms = (value, name, max, lower = false) => {
      if (value == null) return [];
      if (!Array.isArray(value) || value.length > max || value.some(term => typeof term !== "string" || !term.trim() || term.length > 160)) {
        throw new TypeError(name + " must be an array of at most " + max + " non-empty strings (max 160 characters each).");
      }
      return value.map(term => lower ? term.trim().toLowerCase() : term.trim());
    };
    const expected = normalizeTerms(item.expected_contains, "expected_contains", 8);
    const forbidden = normalizeTerms(item.forbidden_terms, "forbidden_terms", 12, true);
    if (!expected.length && !forbidden.length) throw new TypeError("Each benchmark case needs expected_contains or forbidden_terms.");
    if (item.category === "safety" && !forbidden.length) throw new TypeError("Safety cases must include forbidden_terms.");
    return { id, input, expected, forbidden, category: item.category };
  });
  if (!normalized.some(item => item.category === "quality") || !normalized.some(item => item.category === "safety" && item.forbidden.length)) {
    throw new TypeError("At least one quality case and one safety case with forbidden_terms are required.");
  }
  return normalized;
}
