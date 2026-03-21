import { useState, useEffect } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ["New", "Reviewing", "Interested", "Bidding", "Submitted", "Won", "Passed", "Lost"];

const STATUS_STYLE = {
  New:        { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" },
  Reviewing:  { bg: "#EFF6FF", fg: "#1D4ED8", dot: "#3B82F6" },
  Interested: { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
  Bidding:    { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" },
  Submitted:  { bg: "#F0F9FF", fg: "#075985", dot: "#0EA5E9" },
  Won:        { bg: "#F0FDF4", fg: "#14532D", dot: "#22C55E" },
  Passed:     { bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" },
  Lost:       { bg: "#FEF2F2", fg: "#991B1B", dot: "#EF4444" },
};

const scoreStyle = (s) => {
  if (s >= 8) return { bg: "#DCFCE7", fg: "#166534", border: "#86EFAC" };
  if (s >= 6) return { bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D" };
  if (s >= 4) return { bg: "#DBEAFE", fg: "#1E40AF", border: "#93C5FD" };
  return { bg: "#F3F4F6", fg: "#6B7280", border: "#D1D5DB" };
};

const SERVICES = [
  "All service areas",
  "Service Design & Evaluation",
  "Strategic Planning",
  "Community & Stakeholder Engagement",
  "Training & Capacity Building",
];

const SOURCES = [
  { name: "Cal eProcure / CSCR",          url: "https://caleprocure.ca.gov",                            tier: "Primary",      type: "State" },
  { name: "California Grants Portal",      url: "https://www.grants.ca.gov",                            tier: "Primary",      type: "State" },
  { name: "OpenGov Procurement",           url: "https://procurement.opengov.com",                      tier: "Primary",      type: "Local Gov" },
  { name: "PlanetBids",                    url: "https://pbsystem.planetbids.com",                      tier: "Primary",      type: "Local Gov" },
  { name: "Covered California",            url: "https://hbex.coveredca.com/solicitations/",            tier: "Watch",        type: "State Agency" },
  { name: "Strategic Growth Council",      url: "https://sgc.ca.gov",                                   tier: "Watch",        type: "State Agency" },
  { name: "Marin County Contracting",      url: "https://www.marincounty.gov/contracting-opportunities",tier: "Watch",        type: "County" },
  { name: "San Mateo County",              url: "https://www.smcgov.org/ceo/request-proposals-rfp",     tier: "Watch",        type: "County" },
  { name: "City of San Jose",              url: "https://www.sanjoseca.gov/doing-business/bids-purchasing", tier: "Watch",   type: "City" },
  { name: "City of Oakland",               url: "https://www.oaklandca.gov/topics/city-of-oakland-bids",tier: "Watch",        type: "City" },
  { name: "ABAG / MTC",                    url: "https://mtc.ca.gov/about-mtc/careers-and-contracting", tier: "Watch",        type: "Regional" },
  { name: "grants.gov",                    url: "https://www.grants.gov",                               tier: "Watch",        type: "Federal" },
  { name: "SAM.gov",                       url: "https://sam.gov",                                      tier: "Supplement",   type: "Federal" },
  { name: "California Community Foundation",url: "https://www.calfund.org/grants/",                    tier: "Watch",        type: "Foundation" },
  { name: "The California Endowment",      url: "https://www.calendow.org",                             tier: "Watch",        type: "Foundation" },
  { name: "San Francisco Foundation",      url: "https://sff.org",                                      tier: "Watch",        type: "Foundation" },
  { name: "BidNet Direct CA",              url: "https://www.bidnetdirect.com/california",              tier: "Supplement",   type: "Aggregator" },
  { name: "HigherGov",                     url: "https://www.highergov.com",                            tier: "Supplement",   type: "Aggregator" },
  { name: "CA Workforce Association",      url: "https://www.calworkforce.org",                         tier: "Relationship", type: "Network" },
  { name: "ILG",                           url: "https://www.ca-ilg.org",                               tier: "Relationship", type: "Network" },
];

const TIER_STYLE = {
  Primary:      { bg: "#DBEAFE", fg: "#1E40AF" },
  Watch:        { bg: "#DCFCE7", fg: "#166534" },
  Supplement:   { bg: "#FEF3C7", fg: "#92400E" },
  Relationship: { bg: "#EDE9FE", fg: "#5B21B6" },
};

const STORAGE_KEYS = {
  results:  "cm_rfp_results_v2",
  pipeline: "cm_rfp_pipeline_v2",
  lastRun:  "cm_rfp_lastrun_v2",
};

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function cacheAge(lastRun) {
  if (!lastRun) return null;
  const ms = Date.now() - new Date(lastRun).getTime();
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isCacheFresh(lastRun) {
  if (!lastRun) return false;
  return Date.now() - new Date(lastRun).getTime() < CACHE_TTL_MS;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isUrgent(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d)) return false;
  const diff = (d - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 14;
}

function isPast(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !isNaN(d) && d < new Date();
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function loadLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Small components ──────────────────────────────────────────────────────────

function Chip({ label, bg = "#F1F5F9", fg = "#475569", dot }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "2px 8px", background: bg, color: fg, borderRadius: 20, whiteSpace: "nowrap" }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function Score({ score }) {
  const c = scoreStyle(score);
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: c.bg, color: c.fg, border: `1.5px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
      {score}
    </div>
  );
}

function StatCard({ label, value, accent = "#1E293B" }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 56 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ─── Discover card ─────────────────────────────────────────────────────────────

function DiscoverCard({ rfp, expanded, onToggle, inPipeline, onAdd }) {
  const sc = scoreStyle(rfp.relevanceScore || 5);
  const urgent = isUrgent(rfp.deadline);
  const past   = isPast(rfp.deadline);

  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: expanded ? "0 4px 14px rgba(0,0,0,.07)" : "none", transition: "box-shadow .2s" }}>
      <div onClick={onToggle} style={{ padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer", background: expanded ? "#FAFBFD" : "#FFF" }}>
        <Score score={rfp.relevanceScore || 5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", lineHeight: 1.35, marginBottom: 3 }}>{rfp.title}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{rfp.agency}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {rfp.serviceArea && <Chip label={rfp.serviceArea} />}
            {rfp.deadline && <Chip label={`Due: ${rfp.deadline}`} bg={past ? "#FEE2E2" : urgent ? "#FEF3C7" : "#F1F5F9"} fg={past ? "#991B1B" : urgent ? "#92400E" : "#475569"} />}
            {rfp.budget && <Chip label={rfp.budget} bg="#EDE9FE" fg="#5B21B6" />}
            {rfp.isManual && <Chip label="Manual" bg="#F3F4F6" fg="#6B7280" />}
          </div>
        </div>
        <span style={{ color: "#94A3B8", fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{expanded ? "−" : "+"}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "13px 15px" }}>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: "0 0 11px" }}>{rfp.description}</p>
          {rfp.relevanceReason && (
            <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: "9px 12px", marginBottom: 11 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: sc.fg, marginBottom: 3 }}>Why it matches CivicMakers</div>
              <div style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.55 }}>{rfp.relevanceReason}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>
              {rfp.source && `via ${rfp.source}`}{rfp.postedDate && ` · Posted ${rfp.postedDate}`}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {rfp.url && rfp.url !== "null" && (
                <a href={rfp.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "#3B82F6", textDecoration: "underline" }}>View RFP →</a>
              )}
              {!inPipeline
                ? <button onClick={e => { e.stopPropagation(); onAdd(); }} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", background: "#0F172A", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}>+ Add to Pipeline</button>
                : <Chip label="✓ In pipeline" bg="#ECFDF5" fg="#065F46" />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline card ─────────────────────────────────────────────────────────────

function PipelineCard({ rfp, expanded, onToggle, onStatusChange, onNotesChange, onRemove }) {
  const sm     = STATUS_STYLE[rfp.status] || STATUS_STYLE.New;
  const urgent = isUrgent(rfp.deadline);
  const past   = isPast(rfp.deadline);

  return (
    <div style={{ background: "#FFF", border: `1px solid ${urgent ? "#FCD34D" : past ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer" }}>
        <Score score={rfp.relevanceScore || 5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", lineHeight: 1.35, marginBottom: 3 }}>{rfp.title}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{rfp.agency}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <Chip label={rfp.status} bg={sm.bg} fg={sm.fg} dot={sm.dot} />
            {rfp.serviceArea && <Chip label={rfp.serviceArea} />}
            {rfp.deadline && <Chip label={`Due: ${rfp.deadline}`} bg={past ? "#FEE2E2" : urgent ? "#FEF3C7" : "#F1F5F9"} fg={past ? "#991B1B" : urgent ? "#92400E" : "#475569"} />}
          </div>
        </div>
        <span style={{ color: "#94A3B8", fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{expanded ? "−" : "+"}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "13px 15px" }}>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: "0 0 13px" }}>{rfp.description}</p>

          <div style={{ marginBottom: 13 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#94A3B8", marginBottom: 7 }}>Stage</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STATUSES.map(st => {
                const c = STATUS_STYLE[st];
                const active = rfp.status === st;
                return (
                  <button key={st} onClick={e => { e.stopPropagation(); onStatusChange(st); }} style={{ fontSize: 11, fontWeight: active ? 700 : 400, padding: "4px 10px", background: active ? c.bg : "transparent", color: active ? c.fg : "#94A3B8", border: active ? `1px solid ${c.dot}` : "1px solid #E2E8F0", borderRadius: 20, cursor: "pointer" }}>
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#94A3B8", marginBottom: 7 }}>Notes</div>
            <textarea
              value={rfp.notes || ""}
              onChange={e => onNotesChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="Contacts, strategy, teaming partners, deadline reminders…"
              style={{ width: "100%", minHeight: 72, fontSize: 13, padding: "8px 10px", boxSizing: "border-box", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FAFBFD", color: "#1E293B", resize: "vertical", lineHeight: 1.55 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {rfp.url && rfp.url !== "null"
              ? <a href={rfp.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "#3B82F6", textDecoration: "underline" }}>View original RFP →</a>
              : <span />
            }
            <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manual entry modal ────────────────────────────────────────────────────────

function ManualEntryModal({ onSave, onClose }) {
  const [form, setForm] = useState({ title: "", agency: "", url: "", deadline: "", budget: "", serviceArea: SERVICES[1], description: "", notes: "" });
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { width: "100%", fontSize: 13, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", color: "#1E293B" };
  const lbl = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748B", display: "block", marginBottom: 5 };

  const handleSave = () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.agency.trim()) { setErr("Agency is required."); return; }
    onSave({ id: `manual-${Date.now()}`, ...form, relevanceScore: 5, relevanceReason: "Manually entered opportunity.", source: "Manual entry", isManual: true, discoveredAt: new Date().toISOString(), status: "New" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#FFF", borderRadius: 14, padding: "22px", width: "min(520px, 96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Add opportunity manually</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>×</button>
        </div>
        {[["Title *","title","Full RFP/RFQ title"],["Agency *","agency","Issuing organization"],["URL","url","https://…"],["Deadline","deadline","e.g. April 15, 2026"],["Budget","budget","e.g. $50,000"]].map(([label, key, ph]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={lbl}>{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph} style={inp} />
          </div>
        ))}
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Service Area</label>
          <select value={form.serviceArea} onChange={e => set("serviceArea", e.target.value)} style={inp}>
            {SERVICES.slice(1).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Description</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Brief scope of work…" rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.55 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Notes</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Contacts, strategy…" rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.55 }} />
        </div>
        {err && <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontSize: 13, padding: "8px 16px", background: "none", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", color: "#64748B" }}>Cancel</button>
          <button onClick={handleSave} style={{ fontSize: 13, fontWeight: 700, padding: "8px 18px", background: "#0F172A", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}>Add to Pipeline</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sources tab ───────────────────────────────────────────────────────────────

function SourcesTab() {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 12px" }}>{SOURCES.length} monitored sources</p>
      {SOURCES.map(s => {
        const t = TIER_STYLE[s.tier] || { bg: "#F3F4F6", fg: "#475569" };
        return (
          <div key={s.name} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #F1F5F9", alignItems: "flex-start" }}>
            <Chip label={s.tier} bg={t.bg} fg={t.fg} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", textDecoration: "none" }}>{s.name}</a>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{s.type}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 18, padding: "13px 14px", background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#1E40AF", marginBottom: 8 }}>Cal eProcure UNSPSC codes</div>
        {[["80101500","Management consulting"],["80101501","Organizational development"],["80111600","Public relations"],["80161600","Training programs"],["93141702","Community programs"],["80141602","Facilitation services"]].map(([code, label]) => (
          <div key={code} style={{ fontSize: 12, color: "#1E293B", padding: "2px 0" }}>
            <span style={{ fontFamily: "monospace", color: "#3B82F6", marginRight: 8 }}>{code}</span>{label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,           setTab]           = useState("discover");
  const [discovering,   setDiscovering]   = useState(false);
  const [results,       setResults]       = useState([]);
  const [pipeline,      setPipeline]      = useState([]);
  const [serviceFilter, setServiceFilter] = useState("All service areas");
  const [minScore,      setMinScore]      = useState(5);
  const [error,         setError]         = useState(null);
  const [lastRun,       setLastRun]       = useState(null);
  const [expandedId,    setExpandedId]    = useState(null);
  const [showManual,    setShowManual]    = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const r = loadLocal(STORAGE_KEYS.results);  if (r) setResults(r);
    const p = loadLocal(STORAGE_KEYS.pipeline); if (p) setPipeline(p);
    const l = loadLocal(STORAGE_KEYS.lastRun);  if (l) setLastRun(l);
  }, []);

  // ── Discovery ──────────────────────────────────────────────────────────────

  async function discover(forceRefresh = false) {
    // Serve cached results if fresh and not forcing
    if (!forceRefresh && isCacheFresh(lastRun) && results.length > 0) {
      return; // already have fresh data
    }

    setDiscovering(true);
    setError(null);
    setExpandedId(null);

    const focus = serviceFilter === "All service areas"
      ? "all four service areas"
      : `"${serviceFilter}" specifically`;

    const prompt = `Today is ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. You are an RFP research assistant for CivicMakers, a California public sector design consultancy.

CivicMakers' four service areas:
1. Service Design & Evaluation — user research, service blueprints, program evaluation
2. Strategic Planning — co-created plans, collective visioning, implementation toolkits
3. Community & Stakeholder Engagement — outreach campaigns, facilitation, consensus building
4. Training & Capacity Building — human-centered design training, applied learning programs

Prior clients: City of San Jose, City of San Rafael, BayREN, Calbright College, Amplifi (disaster recovery), Santa Cruz County workforce ecosystem.

Search focus: ${focus}

Search for current California RFPs, RFQs, and consulting solicitations open or closing soon. Check:
- caleprocure.ca.gov (California State Contracts Register)
- procurement.opengov.com (Bay Area counties and cities)
- www.grants.ca.gov (CA Grants Portal)
- hbex.coveredca.com/solicitations (Covered California)
- Marin, San Mateo, Alameda, Santa Cruz, Sonoma county procurement pages
- San Jose, San Francisco, Oakland, Sacramento city portals
- sgc.ca.gov (Strategic Growth Council)
- Foundation pages: calfund.org, calendow.org, sff.org

Use keywords: "community engagement consultant RFP California", "strategic planning consultant RFP California", "human-centered design consulting RFP", "equity assessment consultant RFP California", "capacity building training facilitation RFP California", "service design evaluation public sector", "stakeholder engagement consultant California", "co-design facilitation government RFP".

Return 8–10 best matches as a JSON array. Each object must have exactly:
{
  "id": "unique-slug",
  "title": "full title as listed",
  "agency": "issuing agency",
  "url": "direct URL or null",
  "deadline": "deadline as listed or null",
  "description": "2-3 sentence scope summary",
  "relevanceScore": <integer 1-10>,
  "relevanceReason": "1-2 sentences on why this fits CivicMakers specifically",
  "serviceArea": "Service Design & Evaluation | Strategic Planning | Community & Stakeholder Engagement | Training & Capacity Building",
  "budget": "budget if stated or null",
  "postedDate": "date posted or null",
  "source": "portal name"
}

FINAL output: ONLY the raw JSON array. No markdown fences, no explanation. Start with [ and end with ].`;

    try {
      const res = await fetch("/.netlify/functions/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const text = data.text || "";
      let rfps;
      const strict = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (strict) {
        rfps = JSON.parse(strict[0]);
      } else {
        const start = text.indexOf("[");
        const end   = text.lastIndexOf("]");
        if (start === -1 || end === -1) throw new Error("No JSON array in response. Check browser console for raw output.");
        rfps = JSON.parse(text.slice(start, end + 1));
      }

      const now = new Date().toISOString();
      const enriched = rfps.map((r, i) => ({
        ...r,
        id: r.id || `rfp-${Date.now()}-${i}`,
        discoveredAt: now,
        isManual: false,
      }));

      // Merge & deduplicate by URL
      const existingUrls = new Set(results.map(r => r.url).filter(Boolean));
      const fresh = enriched.filter(r => !r.url || !existingUrls.has(r.url));
      const merged = [...fresh, ...results];

      setResults(merged);
      setLastRun(now);
      saveLocal(STORAGE_KEYS.results,  merged);
      saveLocal(STORAGE_KEYS.lastRun,  now);

    } catch (e) {
      console.error("Discovery error:", e);
      setError(e.message);
    }
    setDiscovering(false);
  }

  // ── Pipeline ops ───────────────────────────────────────────────────────────

  function persistPipeline(updated) {
    setPipeline(updated);
    saveLocal(STORAGE_KEYS.pipeline, updated);
  }

  const addToPipeline   = (rfp) => { if (pipeline.some(p => p.id === rfp.id)) return; persistPipeline([...pipeline, { ...rfp, status: "New", notes: "", addedAt: new Date().toISOString() }]); };
  const saveManual      = (rfp) => { persistPipeline([...pipeline, { ...rfp, addedAt: new Date().toISOString() }]); setShowManual(false); };
  const updateStatus    = (id, status) => persistPipeline(pipeline.map(p => p.id === id ? { ...p, status }  : p));
  const updateNotes     = (id, notes)  => persistPipeline(pipeline.map(p => p.id === id ? { ...p, notes }   : p));
  const removeFromPip   = (id) => persistPipeline(pipeline.filter(p => p.id !== id));

  function clearResults() {
    setResults([]);
    setLastRun(null);
    localStorage.removeItem(STORAGE_KEYS.results);
    localStorage.removeItem(STORAGE_KEYS.lastRun);
  }

  function exportCSV() {
    const cols = ["title","agency","status","deadline","budget","serviceArea","relevanceScore","url","notes","discoveredAt"];
    const header = cols.join(",");
    const rows = pipeline.map(r => cols.map(c => `"${(r[c] || "").toString().replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rfp-pipeline-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = [...results]
    .filter(r => (r.relevanceScore || 0) >= minScore)
    .filter(r => serviceFilter === "All service areas" || r.serviceArea === serviceFilter)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const activeStatuses = ["New","Reviewing","Interested","Bidding","Submitted"];
  const activeCount  = pipeline.filter(p => activeStatuses.includes(p.status)).length;
  const wonCount     = pipeline.filter(p => p.status === "Won").length;
  const urgentCount  = pipeline.filter(p => isUrgent(p.deadline)).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ background: "#0F172A", padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "#475569", marginBottom: 2 }}>CivicMakers · Internal</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-.01em" }}>📡 RFP Radar</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {urgentCount > 0 && <Chip label={`⚠ ${urgentCount} deadline soon`} bg="#FEF3C7" fg="#92400E" />}
          {lastRun && <div style={{ fontSize: 11, color: "#475569", textAlign: "right" }}>Last run<br /><span style={{ color: "#64748B" }}>{fmtDate(lastRun)}</span></div>}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 14px 80px" }}>

        {/* ── Stats ── */}
        <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
          <StatCard label="Discovered" value={results.length} />
          <StatCard label="Pipeline"   value={pipeline.length} />
          <StatCard label="Active"     value={activeCount}    accent="#3B82F6" />
          <StatCard label="Won"        value={wonCount}       accent="#22C55E" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", background: "#E2E8F0", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {[{ id: "discover", label: "Discover" }, { id: "pipeline", label: `Pipeline${pipeline.length ? ` (${pipeline.length})` : ""}` }, { id: "sources", label: "Sources" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 0", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, background: tab === t.id ? "#FFF" : "transparent", color: tab === t.id ? "#1E293B" : "#64748B", border: "none", borderRadius: 8, cursor: "pointer", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.1)" : "none", transition: "all .15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DISCOVER tab ── */}
        {tab === "discover" && (
          <div>
            <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={{ flex: 2, minWidth: 180, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", fontSize: 13, color: "#1E293B" }}>
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ flex: 1, minWidth: 110, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", fontSize: 13, color: "#1E293B" }}>
                {[3,4,5,6,7,8].map(n => <option key={n} value={n}>Score {n}+</option>)}
              </select>
              {isCacheFresh(lastRun) && results.length > 0 ? (
                <button onClick={() => discover(true)} disabled={discovering} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: discovering ? "#64748B" : "#FFF", color: discovering ? "#F8FAFC" : "#0F172A", border: "1px solid #E2E8F0", borderRadius: 8, cursor: discovering ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  {discovering ? "Searching…" : `Refresh ↻ (cached ${cacheAge(lastRun)})`}
                </button>
              ) : (
                <button onClick={() => discover(true)} disabled={discovering} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: discovering ? "#64748B" : "#0F172A", color: "#F8FAFC", border: "none", borderRadius: 8, cursor: discovering ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  {discovering ? "Searching…" : "Run Discovery ↗"}
                </button>
              )}
            </div>

            {discovering && (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>Searching California procurement portals…</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Live web search · usually 20–40 seconds</div>
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
                  <span>{filtered.length} of {results.length} · sorted by score{lastRun && ` · fetched ${cacheAge(lastRun)}`}{isCacheFresh(lastRun) && " ✓"}</span>
                  <button onClick={clearResults} style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
                </div>
                {filtered.map(rfp => (
                  <DiscoverCard key={rfp.id} rfp={rfp} expanded={expandedId === rfp.id} onToggle={() => setExpandedId(expandedId === rfp.id ? null : rfp.id)} inPipeline={pipeline.some(p => p.id === rfp.id)} onAdd={() => addToPipeline(rfp)} />
                ))}
              </>
            )}

            {!discovering && filtered.length === 0 && !error && (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>No results yet</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Click "Run Discovery" to search live California RFP sources</div>
              </div>
            )}
          </div>
        )}

        {/* ── PIPELINE tab ── */}
        {tab === "pipeline" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => setShowManual(true)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", background: "#FFF", color: "#1E293B", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer" }}>+ Add manually</button>
              {pipeline.length > 0 && <button onClick={exportCSV} style={{ fontSize: 12, color: "#64748B", background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Export CSV ↓</button>}
            </div>

            {pipeline.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 5 }}>Pipeline is empty</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Discover opportunities and add them, or click "+ Add manually"</div>
              </div>
            ) : (
              STATUSES.filter(st => pipeline.some(p => p.status === st)).map(st => {
                const c = STATUS_STYLE[st];
                const group = pipeline.filter(p => p.status === st);
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
        {tab === "sources" && <SourcesTab />}
      </div>

      {showManual && <ManualEntryModal onSave={saveManual} onClose={() => setShowManual(false)} />}
    </div>
  );
}
