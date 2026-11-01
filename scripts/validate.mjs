import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const workerPath = path.join(root, "cloudflare/worker.js");
const htmlPath = path.join(root, "nexus_netlify_ready/index.html");
const worker = fs.readFileSync(workerPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

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

const scripts = [...html.matchAll(/<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)];
if (!scripts.length) {
  console.error("No inline frontend scripts found.");
  process.exit(1);
}
scripts.forEach((match, index) => checkSyntax(match[1], `frontend-${index}.js`));

const required = [
  ["chat delete control", html.includes('id="kafai-delete"')],
  ["memory consent explanation", html.includes("admin account required")],
  ["visible auto-save status", html.includes("Project memory saved")],
  ["narrow project memory signal", worker.length >= 0 && html.includes("/\\\\b(nexus|kaf[\\\\s-]?ai|memory core|cloudflare worker|supabase)\\\\b/i")],
  ["rate-limit 429 response", worker.includes("}, 429)")],
  ["rate-limit failure 503 response", worker.includes("}, 503)")],
  ["rate-limit binding capability check", worker.includes('typeof env.PROBLEM_RATE_LIMIT.limit === "function"')]
];
for (const [label, ok] of required) {
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`PASS syntax checks: Worker + ${scripts.length} inline frontend script(s)`);
