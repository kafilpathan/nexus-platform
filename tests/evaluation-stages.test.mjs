import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEvaluationStages } from "../cloudflare/evaluation-stages.js";

const valid = {
  qualityScore: 0.9,
  safetyScore: 1,
  regressionCount: 0,
  improvement: 0.1,
  qualityCaseCount: 4,
  safetyCaseCount: 2,
  hasQualityCase: true,
  hasSafetyForbiddenCase: true,
  humanReviewRequired: true,
  automaticDeployment: false
};

test("all required stages pass and remain eligible only for human review", () => {
  const result = evaluateEvaluationStages(valid);
  assert.equal(result.passed, true);
  assert.equal(result.status, "eligible_for_human_review");
  assert.equal(result.passed_count, 5);
});

test("quality threshold failure blocks the evaluation", () => {
  const result = evaluateEvaluationStages({ ...valid, qualityScore: 0.79 });
  assert.equal(result.passed, false);
  assert.equal(result.stages.find(stage => stage.id === "quality_threshold").passed, false);
});

test("safety, regressions, and negative improvement independently block", () => {
  for (const patch of [{ safetyScore: 0.94 }, { regressionCount: 1 }, { improvement: -0.01 }]) {
    assert.equal(evaluateEvaluationStages({ ...valid, ...patch }).passed, false);
  }
});

test("missing safety evidence fails closed", () => {
  const result = evaluateEvaluationStages({ ...valid, hasSafetyForbiddenCase: false });
  assert.equal(result.passed, false);
  assert.equal(result.stages[0].passed, false);
});

test("governance cannot be bypassed by benchmark scores", () => {
  assert.equal(evaluateEvaluationStages({ ...valid, humanReviewRequired: false }).passed, false);
  assert.equal(evaluateEvaluationStages({ ...valid, automaticDeployment: true }).passed, false);
});

test("malformed numeric input fails closed without throwing", () => {
  assert.equal(evaluateEvaluationStages({ ...valid, qualityScore: NaN }).passed, false);
  assert.equal(evaluateEvaluationStages({ ...valid, regressionCount: -1 }).passed, false);
});
