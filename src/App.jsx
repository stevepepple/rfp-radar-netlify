import React, { useState, useEffect, useRef } from "react";
import { STATUSES, STATUS_STYLE, STORAGE_KEYS } from './constants';
import { PROFILES, DEFAULT_PROFILE } from './profiles';
import { cacheAge, isCacheFresh, loadLocal, saveLocal, isUrgent, fmtDate } from './utils';

import { Chip } from './components/Chip';
import { StatCard } from './components/StatCard';
import { DiscoverCard } from './components/DiscoverCard';
import { PipelineCard } from './components/PipelineCard';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SourcesTab } from './components/SourcesTab';

// Tag legacy (untagged) localStorage items with the default profile so
// nothing is lost when migrating to the multi-client model.
function migrateItems(items) {
  return Array.isArray(items)
    ? items.map(it => (it && it.profileId) ? it : { ...it, profileId: DEFAULT_PROFILE })
    : items;
}
// lastRun was an ISO string (single client); it's now a { profileId: iso } map.
function migrateLastRun(l) {
  return typeof l === "string" ? { [DEFAULT_PROFILE]: l } : (l || {});
}

export default function App() {
  const [tab,           setTab]           = useState("discover");
  const [activeProfile, setActiveProfile] = useState(DEFAULT_PROFILE);
  const [discovering,   setDiscovering]   = useState(false);
  const [results,       setResults]       = useState([]);
  const [pipeline,      setPipeline]      = useState([]);
  const [serviceFilter, setServiceFilter] = useState("All service areas");
  const [minScore,      setMinScore]      = useState(5);
  const [error,         setError]         = useState(null);
  const [lastRun,       setLastRun]       = useState({}); // { profileId: ISO }
  const [expandedId,    setExpandedId]    = useState(null);
  const [showManual,    setShowManual]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const discoverRef = useRef(null);
  const didMountRef = useRef(false);

  const profile = PROFILES[activeProfile] || PROFILES[DEFAULT_PROFILE];
  const lastRunAt = lastRun?.[activeProfile] || null;

  // Items belonging to the active client only.
  const profileResults  = results.filter(r => (r.profileId || DEFAULT_PROFILE) === activeProfile);
  const profilePipeline = pipeline.filter(p => (p.profileId || DEFAULT_PROFILE) === activeProfile);

  function switchProfile(id) {
    if (id === activeProfile || !PROFILES[id]) return;
    setActiveProfile(id);
    saveLocal(STORAGE_KEYS.activeProfile, id);
    setExpandedId(null);
    // Reset the service-area filter if it doesn't exist in the new profile.
    if (!PROFILES[id].serviceAreas.includes(serviceFilter)) {
      setServiceFilter("All service areas");
    }
  }

  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;

    const ap = loadLocal(STORAGE_KEYS.activeProfile);
    if (ap && PROFILES[ap]) setActiveProfile(ap);

    const r = loadLocal(STORAGE_KEYS.results);
    if (r) { const m = migrateItems(r); setResults(m); saveLocal(STORAGE_KEYS.results, m); }
    const p = loadLocal(STORAGE_KEYS.pipeline);
    if (p) { const m = migrateItems(p); setPipeline(m); saveLocal(STORAGE_KEYS.pipeline, m); }
    const lRaw = loadLocal(STORAGE_KEYS.lastRun);
    const l = migrateLastRun(lRaw);
    if (lRaw) { setLastRun(l); saveLocal(STORAGE_KEYS.lastRun, l); }

    // The scheduled prefetch only covers the default profile (CivicMakers).
    const defaultLastRun = l[DEFAULT_PROFILE] || null;
    const hasLocalResults = r && r.length > 0;
    const localCacheFresh = hasLocalResults && isCacheFresh(defaultLastRun);

    if (localCacheFresh) return;

    fetch("/.netlify/functions/cached")
      .then(res => {
        if (res.status === 204 || !res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (!data || !data.results) {
          if (!hasLocalResults) discoverRef.current();
          return;
        }

        let rfps;
        try {
          if (typeof data.results === "string") {
            const text = data.results;
            const strict = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
            rfps = strict ? JSON.parse(strict[0]) : JSON.parse(text);
          } else if (Array.isArray(data.results)) {
            rfps = data.results;
          } else {
            if (!hasLocalResults) discoverRef.current();
            return;
          }
        } catch {
          if (!hasLocalResults) discoverRef.current();
          return;
        }

        const enriched = rfps.map((r, i) => ({
          ...r,
          id: r.id || `rfp-${Date.now()}-${i}`,
          relevanceScore: r.relevanceScore ?? r.fitScore,
          discoveredAt: data.cachedAt,
          isManual: false,
          profileId: DEFAULT_PROFILE, // scheduled prefetch is CivicMakers
        }));

        setResults(prev => {
          const merged = mergeResults(enriched, prev);
          if (merged === prev) return prev;
          saveLocal(STORAGE_KEYS.results, merged);
          return merged;
        });

        setLastRun(prev => {
          const cur = prev?.[DEFAULT_PROFILE];
          if (!cur || new Date(data.cachedAt) > new Date(cur)) {
            const next = { ...prev, [DEFAULT_PROFILE]: data.cachedAt };
            saveLocal(STORAGE_KEYS.lastRun, next);
            return next;
          }
          return prev;
        });
      })
      .catch(() => {
        if (!hasLocalResults) discoverRef.current();
      });
  }, []);

  function parseRfpJson(text) {
    const strict = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (strict) return JSON.parse(strict[0]);
    const start = text.indexOf("[");
    const end   = text.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  }

  function mergeResults(newItems, prev) {
    const existingUrls = new Set(prev.map(r => r.url).filter(Boolean));
    const existingIds  = new Set(prev.map(r => r.id));
    const fresh = newItems.filter(r =>
      (!r.url || !existingUrls.has(r.url)) && !existingIds.has(r.id)
    );
    // Keep max latest 200 items to prevent localStorage quotas
    return fresh.length > 0 ? [...fresh, ...prev].slice(0, 500) : prev;
  }

  async function discover(forceRefresh = false) {
    const pid  = activeProfile;
    const prof = PROFILES[pid] || PROFILES[DEFAULT_PROFILE];
    const profResults = results.filter(r => (r.profileId || DEFAULT_PROFILE) === pid);

    if (!forceRefresh && isCacheFresh(lastRun?.[pid]) && profResults.length > 0) {
      return;
    }

    setDiscovering(true);
    setError(null);
    setExpandedId(null);

    const now = new Date().toISOString();

    // Direct-API endpoints are profile-specific (CivicMakers only); other
    // profiles rely purely on the LLM web-search gap-fill.
    const apiEndpoints = prof.apiEndpoints || [];

    const apiPromises = apiEndpoints.map(url =>
      fetch(`${url}?profile=${pid}`).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] }))
    );

    // The discovery prompt is built server-side from src/profiles.js — we only
    // send the active profile id so the two sides never diverge.
    const gapFillPromise = fetch("/.netlify/functions/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: pid }),
    });

    try {
      const apiResults = await Promise.all(apiPromises);
      const rawApiOpps = apiResults.flatMap(r => r.results || []);

      if (rawApiOpps.length > 0) {
        const quickResults = rawApiOpps.map((r, i) => ({
          ...r,
          id: r.id || `api-${Date.now()}-${i}`,
          discoveredAt: now,
          isManual: false,
          profileId: pid,
          relevanceScore: r.relevanceScore ?? r.fitScore ?? 5,
          relevanceReason: r.relevanceReason ?? "From direct API query",
          serviceArea: r.serviceArea ?? prof.defaultServiceArea,
        }));

        setResults(prev => {
          const merged = mergeResults(quickResults, prev);
          saveLocal(STORAGE_KEYS.results, merged);
          return merged;
        });

        fetch("/.netlify/functions/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunities: rawApiOpps }),
        })
          .then(r => r.ok ? r.json() : { scored: [] })
          .then(data => {
            if (!data.scored?.length) return;
            const scored = data.scored.map((r, i) => ({
              ...r,
              id: r.id || `api-scored-${Date.now()}-${i}`,
              discoveredAt: now,
              isManual: false,
              profileId: pid,
              relevanceScore: r.relevanceScore ?? r.fitScore,
            }));
            setResults(prev => {
              const withoutOld = prev.filter(p => !scored.some(s => s.id === p.id));
              const merged = [...scored, ...withoutOld].slice(0, 500);
              saveLocal(STORAGE_KEYS.results, merged);
              return merged;
            });
          })
          .catch(err => console.error("Scoring error:", err));
      }

      gapFillPromise
        .then(async (gapFillRes) => {
          if (!gapFillRes.ok) return;
          const reader = gapFillRes.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let text = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop();
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.type === "result") text = msg.text;
              } catch { /* skip */ }
            }
          }

          if (text) {
            const rfps = parseRfpJson(text);
            if (rfps) {
              const enriched = rfps.map((r, i) => ({
                ...r,
                id: r.id || `llm-${Date.now()}-${i}`,
                discoveredAt: now,
                isManual: false,
                profileId: pid,
                relevanceScore: r.relevanceScore ?? r.fitScore,
              }));
              setResults(prev => {
                const merged = mergeResults(enriched, prev);
                saveLocal(STORAGE_KEYS.results, merged);
                return merged;
              });
            }
          }
        })
        .catch(err => console.warn("LLM gap-fill skipped:", err.message));

      setLastRun(prev => {
        const next = { ...prev, [pid]: now };
        saveLocal(STORAGE_KEYS.lastRun, next);
        return next;
      });

    } catch (e) {
      console.error("Discovery error:", e);
      setError(e.message);
    }
    setDiscovering(false);
  }

  discoverRef.current = () => discover(true);

  function persistPipeline(updated) {
    setPipeline(updated);
    saveLocal(STORAGE_KEYS.pipeline, updated);
  }

  const addToPipeline   = (rfp) => { if (pipeline.some(p => p.id === rfp.id)) return; persistPipeline([...pipeline, { ...rfp, profileId: rfp.profileId || activeProfile, status: "New", notes: "", addedAt: new Date().toISOString() }]); };
  const saveManual      = (rfp) => { persistPipeline([...pipeline, { ...rfp, profileId: activeProfile, addedAt: new Date().toISOString() }]); setShowManual(false); };
  const updateStatus    = (id, status) => persistPipeline(pipeline.map(p => p.id === id ? { ...p, status }  : p));
  const updateNotes     = (id, notes)  => persistPipeline(pipeline.map(p => p.id === id ? { ...p, notes }   : p));
  const removeFromPip   = (id) => persistPipeline(pipeline.filter(p => p.id !== id));

  function clearResults() {
    setResults(prev => {
      const kept = prev.filter(r => (r.profileId || DEFAULT_PROFILE) !== activeProfile);
      saveLocal(STORAGE_KEYS.results, kept);
      return kept;
    });
    setLastRun(prev => {
      const next = { ...prev };
      delete next[activeProfile];
      saveLocal(STORAGE_KEYS.lastRun, next);
      return next;
    });
  }

  function exportCSV() {
    const cols = ["client","title","agency","status","deadline","budget","serviceArea","relevanceScore","url","notes","discoveredAt"];
    const header = cols.join(",");
    const rows = profilePipeline.map(r => cols.map(c => {
      const v = c === "client" ? (PROFILES[r.profileId]?.label || r.profileId || "") : r[c];
      return `"${(v ?? "").toString().replace(/"/g, '""')}"`;
    }).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rfp-pipeline-${activeProfile}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const query = searchQuery.toLowerCase().trim();
  const filtered = [...profileResults]
    .filter(r => (r.relevanceScore || 0) >= minScore)
    .filter(r => serviceFilter === "All service areas" || r.serviceArea === serviceFilter)
    .filter(r => {
      if (!query) return true;
      const haystack = `${r.title || ""} ${r.agency || ""} ${r.description || ""}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const activeStatuses = ["New","Reviewing","Interested","Bidding","Submitted"];
  const activeCount  = profilePipeline.filter(p => activeStatuses.includes(p.status)).length;
  const wonCount     = profilePipeline.filter(p => p.status === "Won").length;
  const urgentCount  = profilePipeline.filter(p => isUrgent(p.deadline)).length;

  return (
    <div style={{ background: "#f4f3f0", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ background: "#103b51", padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "#94A3B8", marginBottom: 2 }}>{profile.org} · Internal</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-.01em", fontFamily: "Montserrat, Helvetica, Arial, sans-serif" }}>RFP Radar</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {urgentCount > 0 && <Chip label={`⚠ ${urgentCount} deadline soon`} bg="#FEF3C7" fg="#92400E" />}
          {lastRunAt && <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>Last run<br /><span style={{ color: "#CBD5E1" }}>{fmtDate(lastRunAt)}</span></div>}
        </div>
      </div>

      {/* ── Profile switcher ── */}
      <div style={{ background: "#0c2e3f", padding: "8px 18px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748B", marginRight: 4 }}>Client</span>
        {Object.values(PROFILES).map(p => (
          <button key={p.id} onClick={() => switchProfile(p.id)} style={{ fontSize: 12, fontWeight: activeProfile === p.id ? 700 : 500, padding: "5px 14px", background: activeProfile === p.id ? "#F1F5F9" : "transparent", color: activeProfile === p.id ? "#103b51" : "#94A3B8", border: `1px solid ${activeProfile === p.id ? "#F1F5F9" : "#2a4a5c"}`, borderRadius: 7, cursor: "pointer", transition: "all .15s" }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 14px 80px" }}>

        {/* ── Stats ── */}
        <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
          <StatCard label="Discovered" value={profileResults.length} />
          <StatCard label="Pipeline"   value={profilePipeline.length} />
          <StatCard label="Active"     value={activeCount}    accent="#ef525f" />
          <StatCard label="Won"        value={wonCount}       accent="#24a791" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", background: "#E2E8F0", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {[{ id: "discover", label: "Discover" }, { id: "pipeline", label: `Pipeline${profilePipeline.length ? ` (${profilePipeline.length})` : ""}` }, { id: "sources", label: "Sources" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 0", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, background: tab === t.id ? "#FFF" : "transparent", color: tab === t.id ? "#103b51" : "#64748B", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.1)" : "none", transition: "all .15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DISCOVER tab ── */}
        {tab === "discover" && (
          <div>
            {/* Active client context */}
            <div style={{ marginBottom: 10, padding: "9px 12px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#103b51" }}>{profile.label}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{profile.blurb}</div>
            </div>
            <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 3, minWidth: 200, position: "relative" }}>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search title, agency, description…" style={{ width: "100%", padding: "8px 30px 8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", fontSize: 13, color: "#103b51" }} />
                {searchQuery && <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#94A3B8", lineHeight: 1 }}>×</button>}
              </div>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={{ flex: 2, minWidth: 180, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", fontSize: 13, color: "#103b51" }}>
                {profile.serviceAreas.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ flex: 1, minWidth: 110, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", fontSize: 13, color: "#103b51" }}>
                {[3,4,5,6,7,8].map(n => <option key={n} value={n}>Score {n}+</option>)}
              </select>
              {isCacheFresh(lastRunAt) && profileResults.length > 0 ? (
                <button onClick={() => discover(true)} disabled={discovering} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: discovering ? "#64748B" : "#FFF", color: discovering ? "#F8FAFC" : "#103b51", border: "1px solid #E2E8F0", borderRadius: 8, cursor: discovering ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  {discovering ? "Searching…" : `Refresh ↻ (cached ${cacheAge(lastRunAt)})`}
                </button>
              ) : (
                <button onClick={() => discover(true)} disabled={discovering} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: discovering ? "#64748B" : "#103b51", color: "#F8FAFC", border: "none", borderRadius: 8, cursor: discovering ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  {discovering ? "Searching…" : "Run Discovery ↗"}
                </button>
              )}
            </div>

            {discovering && (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>Searching procurement portals for {profile.label}…</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>{profile.geography} · {profile.solicitationTypes}</div>
                {profileResults.length > 0 && <div style={{ fontSize: 12, color: "#ef525f", marginTop: 6 }}>{profileResults.length} results so far — still searching…</div>}
              </div>
            )}

            {error && !discovering && (
              <div style={{ padding: "11px 13px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#991B1B", marginBottom: 11, lineHeight: 1.55 }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {!discovering && filtered.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 9, display: "flex", justifyContent: "space-between" }}>
                  <span>{filtered.length} of {profileResults.length}{query && ` matching "${searchQuery}"`} · sorted by score{lastRunAt && ` · fetched ${cacheAge(lastRunAt)}`}{isCacheFresh(lastRunAt) && " ✓"}</span>
                  <button onClick={clearResults} style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
                </div>
                {filtered.map(rfp => (
                  <DiscoverCard key={rfp.id} rfp={rfp} clientLabel={profile.label} expanded={expandedId === rfp.id} onToggle={() => setExpandedId(expandedId === rfp.id ? null : rfp.id)} inPipeline={pipeline.some(p => p.id === rfp.id)} onAdd={() => addToPipeline(rfp)} />
                ))}
              </>
            )}

            {!discovering && filtered.length === 0 && !error && (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>No results yet</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Click "Run Discovery" to search live {profile.label} RFP sources</div>
              </div>
            )}
          </div>
        )}

        {/* ── PIPELINE tab ── */}
        {tab === "pipeline" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => setShowManual(true)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", background: "#FFF", color: "#103b51", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer" }}>+ Add manually</button>
              {profilePipeline.length > 0 && <button onClick={exportCSV} style={{ fontSize: 12, color: "#64748B", background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Export CSV ↓</button>}
            </div>

            {profilePipeline.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>Pipeline is empty</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Discover opportunities and add them, or click "+ Add manually"</div>
              </div>
            ) : (
              STATUSES.filter(st => profilePipeline.some(p => p.status === st)).map(st => {
                const c = STATUS_STYLE[st];
                const group = profilePipeline.filter(p => p.status === st);
                return (
                  <div key={st} style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748B" }}>{st} · {group.length}</span>
                    </div>
                    {group.map(rfp => (
                      <PipelineCard key={rfp.id} rfp={rfp} expanded={expandedId === rfp.id} onToggle={() => setExpandedId(expandedId === rfp.id ? null : rfp.id)} onStatusChange={s => updateStatus(rfp.id, s)} onNotesChange={n => updateNotes(rfp.id, n)} onRemove={() => removeFromPip(rfp.id)} />
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── SOURCES tab ── */}
        {tab === "sources" && <SourcesTab results={profileResults} />}
      </div>

      {showManual && <ManualEntryModal onSave={saveManual} onClose={() => setShowManual(false)} serviceAreas={profile.serviceAreas} />}
    </div>
  );
}
