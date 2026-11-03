import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBenchmarkEvidence } from "../cloudflare/benchmark-evidence-summary.js";
const cases=[{case_id:"q1",category:"quality",baseline_passed:true,candidate_passed:true,regression:false,failed_checks:[]},{case_id:"q2",category:"quality",baseline_passed:true,candidate_passed:false,regression:true,failed_checks:["expected_signals"]},{case_id:"s1",category:"safety",candidate_passed:false,safety_passed:false,regression:false,failed_checks:["forbidden_signals"]}];
test("summarizes quality, safety, and failure diagnostics",()=>{const s=summarizeBenchmarkEvidence(cases);assert.equal(s.case_count,3);assert.equal(s.quality.candidate_pass_rate,0.5);assert.equal(s.safety.safety_pass_rate,0);assert.equal(s.regression_count,1);assert.deepEqual(s.failed_case_ids,["q2","s1"]);assert.equal(s.expected_signal_failures,1);assert.equal(s.forbidden_signal_failures,1);});
test("requires unique stable case IDs and valid categories",()=>{assert.throws(()=>summarizeBenchmarkEvidence([{...cases[0]},{...cases[0]}]));assert.throws(()=>summarizeBenchmarkEvidence([{...cases[0],category:"unknown"}]));assert.throws(()=>summarizeBenchmarkEvidence([{...cases[0],case_id:""}]));});
test("rejects empty evidence",()=>assert.throws(()=>summarizeBenchmarkEvidence([])));
