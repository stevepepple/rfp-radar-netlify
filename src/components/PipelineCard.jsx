import React from 'react';
import { Chip } from './Chip';
import { Score } from './Score';
import { isUrgent, isPast } from '../utils';
import { STATUSES, STATUS_STYLE } from '../constants';

export function PipelineCard({ rfp, expanded, onToggle, onStatusChange, onNotesChange, onRemove }) {
  const sm     = STATUS_STYLE[rfp.status] || STATUS_STYLE.New;
  const urgent = isUrgent(rfp.deadline);
  const past   = isPast(rfp.deadline);

  return (
    <div style={{ background: "#FFF", border: `1px solid ${urgent ? "#FCD34D" : past ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer" }}>
        <Score score={rfp.relevanceScore || 5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#103b51", lineHeight: 1.35, marginBottom: 3 }}>{rfp.title}</div>
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
              style={{ width: "100%", minHeight: 72, fontSize: 13, padding: "8px 10px", boxSizing: "border-box", border: "1px solid #E2E8F0", borderRadius: 8, background: "#FAFBFD", color: "#103b51", resize: "vertical", lineHeight: 1.55 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {rfp.url && rfp.url !== "null"
              ? <a href={rfp.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "#ef525f", textDecoration: "underline" }}>View original RFP →</a>
              : <span />
            }
            <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}
