import assert from "node:assert/strict";
import {
  listExperiments, saveExperiment, markExperimentEligible, reviewExperiment
} from "../nexus_netlify_ready/evolution/supabase-store.mjs";

function makeClient({ user = { id: "admin-1" }, isAdmin = true } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const query = { table, operation: "select", filters: [], payload: null };
      const chain = {
        select(columns) { query.columns = columns; return chain; },
        eq(column, value) { query.filters.push([column, value]); return chain; },
        order(column, options) { query.order = [column, options]; return chain; },
        limit(value) { query.limit = value; return chain; },
        insert(payload) { query.operation = "insert"; query.payload = payload; return chain; },
        update(payload) { query.operation = "update"; query.payload = payload; return chain; },
        maybeSingle: async () => table === "nexus_admins"
          ? { data: isAdmin ? { user_id: user?.id } : null, error: null }
          : { data: null, error: null },
        single: async () => { calls.push({ ...query }); return { data: { id: "record-1", ...query.payload }, error: null }; },
        then(resolve, reject) {
          calls.push({ ...query });
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
      };
      return chain;
    }
  };
  return { client, calls };
}

{
  const { client, calls } = makeClient({ user: null });
  await assert.rejects(() => listExperiments(client), /Sign in with a NEXUS admin/);
  assert.equal(calls.length, 0, "unauthenticated requests must not query tables");
}

{
  const { client, calls } = makeClient({ isAdmin: false });
  await assert.rejects(() => listExperiments(client), /NEXUS admin access is required/);
  assert.equal(calls.length, 0, "non-admin requests must not query experiment tables");
}

{
  const { client, calls } = makeClient();
  const saved = await saveExperiment(client, {
    name: "  Safe optimizer  ",
    objective: " Test a bounded candidate in a sandbox. ",
    parameters: { seed: 7 },
    candidateScore: 4.2
  });
  assert.equal(saved.name, "Safe optimizer");
  assert.equal(saved.created_by, "admin-1");
  assert.equal(saved.status, "proposed", "new experiments must never start approved");
  assert.equal(calls[0].table, "nexus_experiments");
  assert.equal(calls[0].operation, "insert");
}

{
  const { client, calls } = makeClient();
  await assert.rejects(() => saveExperiment(client, { name: "", objective: "" }), /required/);
  assert.equal(calls.length, 0, "invalid experiments must not be written");
}

{
  const { client, calls } = makeClient();
  await assert.rejects(() => markExperimentEligible(client, "exp-1", Number.NaN), /finite/);
  assert.equal(calls.length, 0, "invalid scores must not update experiment status");
  const saved = await markExperimentEligible(client, "exp-1", 91.5);
  assert.equal(saved.status, "eligible_for_review");
  assert.deepEqual(calls[0].filters, [["id", "exp-1"]]);
}

{
  const { client, calls } = makeClient();
  await assert.rejects(() => reviewExperiment(client, "exp-1", "deployed"), /decision must be approved or rejected/);
  assert.equal(calls.length, 0, "unsupported review decisions must never write");
  const reviewed = await reviewExperiment(client, "exp-1", "approved");
  assert.equal(reviewed.status, "approved");
  assert.equal(reviewed.reviewed_by, "admin-1");
  assert.deepEqual(calls[0].filters, [["id", "exp-1"], ["status", "eligible_for_review"]]);
}

console.log("PASS Supabase store: authentication, admin gate, experiment validation, eligibility and human review");
