import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, "cloudflare/worker.js"), "utf8");
const html = fs.readFileSync(path.join(root, "nexus_netlify_ready/index.html"), "utf8");

function checkSyntax(source, filename) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-check-"));
  const file = path.join(dir, filename);
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "Syntax check failed\n");
    process.exitCode = 1;
  }
}

checkSyntax(worker, "worker.mjs");

const scripts = [];
let cursor = 0;
while (true) {
  const start = html.indexOf("<script", cursor);
  if (start < 0) break;
  const tagEnd = html.indexOf(">", start);
  const end = html.indexOf("</script>", tagEnd);
  if (tagEnd < 0 || end < 0) throw new Error("Malformed script element in frontend HTML.");
  const openingTag = html.slice(start, tagEnd);
  if (!openingTag.includes("src=")) scripts.push(html.slice(tagEnd + 1, end));
  cursor = end + "</script>".length;
}
if (!scripts.length) {
  console.error("No inline frontend scripts found.");
  process.exit(1);
}
scripts.forEach((source, index) => checkSyntax(source, `frontend-${index}.js`));

const required = [
  ["chat delete control", html.includes('id="kafai-delete"')],
  ["memory consent explanation", html.includes("admin account required")],
  ["memory opt-in is off by default", (() => { const match = html.match(/<input\b[^>]*id="kafai-use-memory"[^>]*>/); return !!match && !/\bchecked(?:\\s|=|>)/i.test(match[0]); })()],
  ["visible auto-save status", html.includes("Project memory saved")],
  ["narrow project memory signal", html.includes("projectSignal = /") && html.includes("memory core|cloudflare worker|supabase)")],
  ["rate-limit 429 response", worker.includes("}, 429)")],
  ["rate-limit failure 503 response", worker.includes("}, 503)")],
  ["rate-limit binding capability check", worker.includes('typeof env.PROBLEM_RATE_LIMIT.limit === "function"')]
];
const evolutionTest = spawnSync(process.execPath, [path.join(root, "scripts/test-evolution.mjs")], { encoding: "utf8" });
if (evolutionTest.status !== 0) {
  process.stderr.write(evolutionTest.stderr || evolutionTest.stdout || "Evolution Engine tests failed\\n");
  process.exitCode = 1;
} else {
  process.stdout.write(evolutionTest.stdout);
}

for (const [label, ok] of required) {
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`PASS syntax checks: Worker + ${scripts.length} inline frontend script(s)`);
