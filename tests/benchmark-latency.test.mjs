import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBenchmarkLatency } from "../cloudflare/benchmark-latency.js";
const cases=[{baseline_latency_ms:10,candidate_latency_ms:12},{baseline_latency_ms:20,candidate_latency_ms:18},{baseline_latency_ms:30,candidate_latency_ms:25}];
test("summarizes baseline and candidate latency distributions",()=>{const s=summarizeBenchmarkLatency(cases);assert.equal(s.case_count,3);assert.equal(s.baseline.mean_ms,20);assert.equal(s.candidate.mean_ms,18.33);assert.equal(s.mean_delta_ms,-1.67);assert.equal(s.candidate.min_ms,12);assert.equal(s.candidate.max_ms,25);});
test("handles zero baseline mean without division by zero",()=>{const s=summarizeBenchmarkLatency([{baseline_latency_ms:0,candidate_latency_ms:5}]);assert.equal(s.mean_change_percent,null);});
test("rejects empty and invalid latency evidence",()=>{assert.throws(()=>summarizeBenchmarkLatency([]));assert.throws(()=>summarizeBenchmarkLatency([{baseline_latency_ms:-1,candidate_latency_ms:2}]));assert.throws(()=>summarizeBenchmarkLatency([{baseline_latency_ms:1,candidate_latency_ms:Infinity}]));});
