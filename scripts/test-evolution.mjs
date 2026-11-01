import assert from "node:assert/strict";
import { evolve } from "../evolution/engine.mjs";

const options = {
  searchSpace: { temperature: { min: 0, max: 2 }, contextWeight: { min: 0, max: 4 } },
  fitness: ({ temperature, contextWeight }) =>
    -((temperature - 0.7) ** 2) - ((contextWeight - 2.4) ** 2),
  populationSize: 40,
  generations: 60,
  seed: 123
};
const first = evolve(options);
const second = evolve(options);

assert.deepEqual(first, second, "same seed and inputs must be reproducible");
assert.ok(first.bestFitness > -0.2, "optimizer should approach the known target");
assert.ok(first.best.temperature >= 0 && first.best.temperature <= 2);
assert.ok(first.best.contextWeight >= 0 && first.best.contextWeight <= 4);
assert.equal(first.evaluations, 40 * 61);
assert.equal(first.history.length, 61);

assert.throws(() => evolve({ ...options, searchSpace: { x: { min: 2, max: 1 } } }),
  /finite min\/max bounds/);
assert.throws(() => evolve({ ...options, fitness: () => Number.NaN }), /finite number/);

console.log("PASS Evolution Engine: deterministic, bounded, validated optimization");
