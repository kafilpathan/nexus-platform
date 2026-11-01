/**
 * NEXUS KAF-AI Evolution Engine v1
 *
 * A deterministic, bounded genetic optimizer for sandboxed numeric settings.
 * It does not train neural-network weights or change production configuration.
 */

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function makeRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalizeSpace(searchSpace) {
  assert(searchSpace && typeof searchSpace === "object" && !Array.isArray(searchSpace),
    "searchSpace must be an object of numeric bounds.");
  const entries = Object.entries(searchSpace);
  assert(entries.length > 0, "searchSpace must contain at least one parameter.");
  for (const [key, bounds] of entries) {
    assert(key.length > 0 && bounds && Number.isFinite(bounds.min) &&
      Number.isFinite(bounds.max) && bounds.min < bounds.max,
      "Each parameter needs finite min/max bounds with min < max.");
  }
  return entries;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreCandidate(candidate, fitness) {
  const score = fitness(Object.freeze({ ...candidate }));
  assert(Number.isFinite(score), "fitness must return a finite number.");
  return score;
}

/**
 * Run a seeded genetic search. Higher fitness is better.
 * fitness must be a trusted, deterministic local function; never eval user text.
 */
export function evolve({
  searchSpace,
  fitness,
  populationSize = 24,
  generations = 30,
  mutationRate = 0.18,
  mutationScale = 0.12,
  eliteCount = 2,
  seed = 42
}) {
  const dimensions = normalizeSpace(searchSpace);
  assert(typeof fitness === "function", "fitness must be a function.");
  assert(Number.isInteger(populationSize) && populationSize >= 4,
    "populationSize must be an integer >= 4.");
  assert(Number.isInteger(generations) && generations >= 1 && generations <= 500,
    "generations must be an integer from 1 to 500.");
  assert(Number.isFinite(mutationRate) && mutationRate >= 0 && mutationRate <= 1,
    "mutationRate must be between 0 and 1.");
  assert(Number.isFinite(mutationScale) && mutationScale > 0 && mutationScale <= 1,
    "mutationScale must be > 0 and <= 1.");
  assert(Number.isInteger(eliteCount) && eliteCount >= 1 && eliteCount < populationSize,
    "eliteCount must be >= 1 and less than populationSize.");

  const random = makeRandom(seed);
  const randomCandidate = () => Object.fromEntries(dimensions.map(([key, bounds]) => [
    key, bounds.min + random() * (bounds.max - bounds.min)
  ]));
  const evaluate = population => population
    .map(params => ({ params, fitness: scoreCandidate(params, fitness) }))
    .sort((a, b) => b.fitness - a.fitness);

  const tournament = ranked => {
    const a = ranked[Math.floor(random() * ranked.length)];
    const b = ranked[Math.floor(random() * ranked.length)];
    return a.fitness >= b.fitness ? a.params : b.params;
  };
  const crossover = (a, b) => Object.fromEntries(dimensions.map(([key]) => [
    key, random() < 0.5 ? a[key] : b[key]
  ]));
  const mutate = candidate => {
    for (const [key, bounds] of dimensions) {
      if (random() < mutationRate) {
        const span = bounds.max - bounds.min;
        const offset = (random() * 2 - 1) * span * mutationScale;
        candidate[key] = clamp(candidate[key] + offset, bounds.min, bounds.max);
      }
    }
    return candidate;
  };

  let ranked = evaluate(Array.from({ length: populationSize }, randomCandidate));
  const history = [{ generation: 0, bestFitness: ranked[0].fitness }];
  for (let generation = 1; generation <= generations; generation++) {
    const next = ranked.slice(0, eliteCount).map(item => ({ ...item.params }));
    while (next.length < populationSize) {
      next.push(mutate(crossover(tournament(ranked), tournament(ranked))));
    }
    ranked = evaluate(next);
    history.push({ generation, bestFitness: ranked[0].fitness });
  }

  return Object.freeze({
    best: Object.freeze({ ...ranked[0].params }),
    bestFitness: ranked[0].fitness,
    generations,
    evaluations: populationSize * (generations + 1),
    history: Object.freeze(history.map(item => Object.freeze(item)))
  });
}
