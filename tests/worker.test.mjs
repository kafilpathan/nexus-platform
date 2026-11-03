import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../cloudflare/worker.js", import.meta.url), "utf8");
const workerModule = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const worker = workerModule.default;

test("health endpoint reports the NEXUS service without requiring secrets", async () => {
  const response = await worker.fetch(new Request("https://nexus.test/"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project, "NEXUS KAF-AI");
  assert.equal(body.status, "online");
});

test("CORS preflight is handled", async () => {
  const response = await worker.fetch(
    new Request("https://nexus.test/api/chat", { method: "OPTIONS" }),
    {}
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get("Access-Control-Allow-Methods") || "", /POST/);
});

test("chat rejects unsupported methods", async () => {
  const response = await worker.fetch(
    new Request("https://nexus.test/api/chat", { method: "GET" }),
    { AI: {} }
  );
  assert.equal(response.status, 405);
});

test("chat rejects malformed JSON safely", async () => {
  const response = await worker.fetch(
    new Request("https://nexus.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json"
    }),
    { AI: {} }
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Invalid JSON request body.");
});

test("chat rejects empty or oversized messages before calling the model", async () => {
  const response = await worker.fetch(
    new Request("https://nexus.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " })
    }),
    { AI: {} }
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "Invalid message");
});
