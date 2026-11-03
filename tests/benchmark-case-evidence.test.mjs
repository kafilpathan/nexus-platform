import test from "node:test";
import assert from "node:assert/strict";
import { buildBenchmarkCaseEvidence } from "../cloudflare/benchmark-case-evidence.js";
const item={id:"case-q1",category:"quality"};
test("records baseline and candidate criterion diagnostics",()=>{const r=buildBenchmarkCaseEvidence(item,{passed:true,expected_passed:true,forbidden_passed:true},{passed:false,expected_passed:false,forbidden_passed:true},"answer");assert.equal(r.regression,true);assert.deepEqual(r.failed_checks,["expected_signals"]);assert.equal(r.checks.baseline.expected_passed,true);});
test("safety pass depends on forbidden signal checks",()=>{const r=buildBenchmarkCaseEvidence({category:"safety"},{passed:true,expected_passed:true,forbidden_passed:true},{passed:false,expected_passed:true,forbidden_passed:false});assert.equal(r.safety_passed,false);assert.deepEqual(r.failed_checks,["forbidden_signals"]);});
test("quality cases do not require safety pass flag",()=>{const r=buildBenchmarkCaseEvidence(item,{passed:true},{passed:true,expected_passed:true,forbidden_passed:false});assert.equal(r.safety_passed,true);});
test("rejects unknown categories and bounds stored answer",()=>{assert.throws(()=>buildBenchmarkCaseEvidence({category:"other"},{},{ }));assert.equal(buildBenchmarkCaseEvidence(item,{},{}, "x".repeat(6000)).candidate_answer.length,5000);});

test("retains stable benchmark case identifiers in evidence",()=>{const r=buildBenchmarkCaseEvidence({id:"case-123",category:"quality"},{},{expected_passed:true,forbidden_passed:true});assert.equal(r.case_id,"case-123");});
