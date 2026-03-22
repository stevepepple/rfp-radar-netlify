import React, { useState } from 'react';
import { SERVICES } from '../constants';

export function ManualEntryModal({ onSave, onClose }) {
  const [form, setForm] = useState({ title: "", agency: "", url: "", deadline: "", budget: "", serviceArea: SERVICES[1], description: "", notes: "" });
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { width: "100%", fontSize: 13, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FFF", color: "#103b51" };
  const lbl = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#64748B", display: "block", marginBottom: 5 };

  const handleSave = () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.agency.trim()) { setErr("Agency is required."); return; }
    onSave({ id: `manual-${Date.now()}`, ...form, relevanceScore: 5, relevanceReason: "Manually entered opportunity.", source: "Manual entry", isManual: true, discoveredAt: new Date().toISOString(), status: "New" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entry-modal-title"
        style={{ background: "#FFF", borderRadius: 14, padding: "22px", width: "min(520px, 96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span id="manual-entry-modal-title" style={{ fontSize: 16, fontWeight: 700, color: "#103b51" }}>Add opportunity manually</span>
          <button onClick={onClose} aria-label="Close dialog" style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>×</button>
        </div>
        {[["Title *","title","Full RFP/RFQ title"],["Agency *","agency","Issuing organization"],["URL","url","https://…"],["Deadline","deadline",""],["Budget","budget","e.g. $50,000"]].map(([label, key, ph]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={lbl}>{label}</label>
            {key === "deadline" ? (
              <input
                type="date"
                value={form.deadline || ""}
                onChange={e => set("deadline", e.target.value)}
                style={inp}
              />
            ) : (
              <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph} style={inp} />
            )}
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
          <button onClick={handleSave} style={{ fontSize: 13, fontWeight: 700, padding: "8px 18px", background: "#103b51", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}>Add to Pipeline</button>
        </div>
      </div>
    </div>
  );
}
