(() => {
  "use strict";
  if (document.getElementById("nexus-evidence-ledger")) return;

  const anchor = document.getElementById("nexus-intelligence");
  if (!anchor) return;

  const style = document.createElement("style");
  style.textContent = `
    #nexus-evidence-ledger{margin:56px auto;padding:0 20px;max-width:1160px;color:#f4f7ff}
    #nexus-evidence-ledger .nel-shell{border:1px solid rgba(116,240,227,.24);border-radius:22px;padding:clamp(18px,3vw,30px);background:linear-gradient(145deg,rgba(116,240,227,.07),rgba(255,255,255,.015))}
    #nexus-evidence-ledger .nel-kicker{color:#74f0e3;font-size:.76rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
    #nexus-evidence-ledger h2{font-size:clamp(2rem,4vw,3rem);line-height:1.1;letter-spacing:-.04em;margin:10px 0}
    #nexus-evidence-ledger .nel-lead,#nexus-evidence-ledger .nel-muted{color:#a9b3c8}
    #nexus-evidence-ledger .nel-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}
    #nexus-evidence-ledger .nel-panel{background:#080d19;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;min-width:0}
    #nexus-evidence-ledger label{display:block;font-weight:700;margin:12px 0 6px}
    #nexus-evidence-ledger input,#nexus-evidence-ledger textarea,#nexus-evidence-ledger select{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #303b54;border-radius:10px;background:#101626;color:#f4f7ff;font:inherit}
    #nexus-evidence-ledger textarea{resize:vertical}
    #nexus-evidence-ledger button{border:1px solid rgba(116,240,227,.35);border-radius:10px;padding:10px 14px;background:#74f0e3;color:#07131a;font-weight:800;cursor:pointer;margin:12px 8px 0 0}
    #nexus-evidence-ledger button:disabled{opacity:.55;cursor:wait}
    #nexus-evidence-ledger .nel-secondary{background:#182438;color:#eaf1ff;border-color:#34445e}
    #nexus-evidence-ledger .nel-status{margin-top:12px;color:#a9b3c8;font-size:.88rem;overflow-wrap:anywhere}
    #nexus-evidence-ledger .nel-entry{border:1px solid rgba(255,255,255,.12);border-radius:13px;padding:14px;margin-top:10px;background:#ffffff05}
    #nexus-evidence-ledger .nel-entry h4{margin:0 0 7px;overflow-wrap:anywhere}
    #nexus-evidence-ledger .nel-entry p{white-space:pre-wrap;overflow-wrap:anywhere;color:#c1cadd;margin:7px 0}
    #nexus-evidence-ledger .nel-meta{font-size:.78rem;color:#8e9bb3}
    #nexus-evidence-ledger a{color:#74f0e3;overflow-wrap:anywhere}
    #nexus-evidence-ledger .nel-empty{padding:14px;border:1px dashed #34445e;border-radius:12px;color:#a9b3c8}
    @media(max-width:760px){#nexus-evidence-ledger .nel-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "nexus-evidence-ledger";
  section.innerHTML = `
    <div class="nel-shell">
      <div class="nel-kicker">NEXUS · evidence & decision layer</div>
      <h2>Make ideas answer to evidence.</h2>
      <p class="nel-lead">Record what we believe, what supports it, what remains uncertain, and what decision follows. This creates an auditable trail alongside Memory Core and Solution Evolution.</p>
      <div class="nel-grid">
        <form class="nel-panel" id="nel-form">
          <h3>Record an evidence item</h3>
          <label for="nel-title">Short title</label>
          <input id="nel-title" maxlength="90" required placeholder="e.g. Students waste less food with smaller portions">
          <label for="nel-claim">Claim or hypothesis</label>
          <textarea id="nel-claim" rows="3" maxlength="1200" required placeholder="What do we think may be true?"></textarea>
          <label for="nel-source">Source URL (optional)</label>
          <input id="nel-source" type="url" maxlength="500" placeholder="https://example.org/research">
          <label for="nel-notes">Evidence, limitations, or counterpoints</label>
          <textarea id="nel-notes" rows="4" maxlength="1800" placeholder="What does the source show? What does it not prove?"></textarea>
          <label for="nel-confidence">Current confidence</label>
          <select id="nel-confidence"><option value="1">1 / Very low</option><option value="2">2 / Low</option><option value="3" selected>3 / Uncertain</option><option value="4">4 / High</option><option value="5">5 / Very high</option></select>
          <label for="nel-status">Review status</label>
          <select id="nel-status"><option>Unverified</option><option>Needs more evidence</option><option>Supported</option><option>Disputed</option></select>
          <button type="submit" id="nel-save">Save to Evidence Ledger</button>
          <button type="button" class="nel-secondary" id="nel-refresh">Refresh ledger</button>
          <div class="nel-status" id="nel-form-status" role="status" aria-live="polite">Sign in through Admin Login to use your private ledger.</div>
        </form>
        <div class="nel-panel">
          <h3>Your evidence history</h3>
          <p class="nel-muted">Only records belonging to your authenticated NEXUS admin account are shown. Entries are stored in the existing private Memory Core table; no new database table or paid AI request is required.</p>
          <div id="nel-list" aria-live="polite"><div class="nel-empty">Sign in, then refresh to load your evidence records.</div></div>
        </div>
      </div>
      <p class="nel-muted" style="font-size:.8rem;margin:16px 0 0">Important: confidence is a human-entered assessment, not an AI fact-check. Always inspect original sources before relying on a claim.</p>
    </div>
  `;

  anchor.insertAdjacentElement("afterend", section);
  const nav = document.querySelector(".navlinks");
  if (nav && !nav.querySelector('a[href="#nexus-evidence-ledger"]')) {
    const link = document.createElement("a");
    link.href = "#nexus-evidence-ledger";
    link.textContent = "Evidence Ledger";
    nav.appendChild(link);
  }

  const $ = id => document.getElementById(id);
  const status = text => { $("nel-form-status").textContent = text; };
  const prefix = "Evidence: ";

  function parseRecord(row) {
    try {
      const value = JSON.parse(row.memory_value);
      if (!value || value.kind !== "nexus-evidence-v1") return null;
      return value;
    } catch (_) { return null; }
  }

  async function getAdminClient() {
    const db = window.nexusSupabaseClient;
    if (!db) throw new Error("Supabase client is unavailable. Open Admin Login and sign in first.");
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Please sign in through Admin Login first.");
    const { data: admin, error: adminError } = await db.from("nexus_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) throw new Error("This account is not authorised to use the private NEXUS workspace.");
    return { db, user };
  }

  function renderEntries(rows) {
    const list = $("nel-list");
    list.replaceChildren();
    const entries = rows.filter(row => typeof row.memory_key === "string" && row.memory_key.startsWith(prefix))
      .map(row => ({ row, record: parseRecord(row) })).filter(item => item.record);
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "nel-empty";
      empty.textContent = "No evidence records yet. Add your first hypothesis on the left.";
      list.appendChild(empty);
      return;
    }
    entries.forEach(({ row, record }) => {
      const card = document.createElement("article");
      card.className = "nel-entry";
      const title = document.createElement("h4");
      title.textContent = record.title || row.memory_key.slice(prefix.length);
      const meta = document.createElement("div");
      meta.className = "nel-meta";
      meta.textContent = "Status: " + record.reviewStatus + " · Confidence: " + record.confidence + "/5 · Updated: " + new Date(row.updated_at).toLocaleString();
      const claim = document.createElement("p");
      claim.textContent = record.claim;
      const notes = document.createElement("p");
      notes.textContent = record.notes || "No evidence notes added.";
      card.append(title, meta, claim, notes);
      if (record.sourceUrl) {
        const source = document.createElement("a");
        source.href = record.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Open source ↗";
        card.appendChild(source);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "nel-secondary";
      remove.textContent = "Delete record";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete this evidence record?")) return;
        remove.disabled = true;
        try {
          const { db, user } = await getAdminClient();
          const { error } = await db.from("nexus_memory").delete().eq("id", row.id).eq("owner_id", user.id);
          if (error) throw error;
          await loadEntries();
        } catch (error) {
          status(error.message || "Could not delete this record.");
          remove.disabled = false;
        }
      });
      card.appendChild(remove);
      list.appendChild(card);
    });
  }

  async function loadEntries() {
    status("Checking private NEXUS access…");
    try {
      const { db, user } = await getAdminClient();
      const { data, error } = await db.from("nexus_memory")
        .select("id,owner_id,memory_key,memory_value,category,updated_at")
        .eq("owner_id", user.id).eq("category", "lesson")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      renderEntries(data || []);
      status("Loaded " + (data || []).filter(row => row.memory_key.startsWith(prefix) && parseRecord(row)).length + " private evidence record(s).");
    } catch (error) {
      status(error.message || "Could not load the Evidence Ledger.");
    }
  }

  $("nel-refresh").addEventListener("click", loadEntries);
  $("nel-form").addEventListener("submit", async event => {
    event.preventDefault();
    const save = $("nel-save");
    save.disabled = true;
    status("Saving your evidence record…");
    try {
      const { db, user } = await getAdminClient();
      const title = $("nel-title").value.trim();
      const claim = $("nel-claim").value.trim();
      const rawSource = $("nel-source").value.trim();
      let sourceUrl = "";
      if (rawSource) {
        const parsed = new URL(rawSource);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Source URL must use HTTP or HTTPS.");
        sourceUrl = parsed.href;
      }
      if (!title || !claim) throw new Error("Add both a title and a claim before saving.");
      const record = {
        kind: "nexus-evidence-v1",
        title,
        claim,
        sourceUrl,
        notes: $("nel-notes").value.trim(),
        confidence: Number($("nel-confidence").value),
        reviewStatus: $("nel-status").value
      };
      const { error } = await db.from("nexus_memory").insert({
        owner_id: user.id,
        memory_key: (prefix + title).slice(0, 100),
        memory_value: JSON.stringify(record).slice(0, 4000),
        category: "lesson",
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      $("nel-form").reset();
      $("nel-confidence").value = "3";
      $("nel-status").value = "Unverified";
      status("Saved securely to your private NEXUS Evidence Ledger.");
      await loadEntries();
    } catch (error) {
      status(error.message || "Could not save this record.");
    } finally {
      save.disabled = false;
    }
  });

  $("nexusAdminOpen")?.addEventListener("click", () => setTimeout(loadEntries, 250));
  $("nexusAdminSignIn")?.addEventListener("click", () => setTimeout(loadEntries, 900));
  loadEntries();
})();