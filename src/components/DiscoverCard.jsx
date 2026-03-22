import React from 'react';
import { Chip } from './Chip';
import { Score } from './Score';
import { scoreStyle, isUrgent, isPast } from '../utils';

export function DiscoverCard({ rfp, expanded, onToggle, inPipeline, onAdd }) {
  const sc = scoreStyle(rfp.relevanceScore || 5);
  const urgent = isUrgent(rfp.deadline);
  const past   = isPast(rfp.deadline);

  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: expanded ? "0 4px 14px rgba(0,0,0,.07)" : "none", transition: "box-shadow .2s" }}>
      <div role="button" tabIndex={0} onClick={onToggle} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} style={{ padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer", background: expanded ? "#FAFBFD" : "#FFF" }}>
        <Score score={rfp.relevanceScore || 5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#103b51", lineHeight: 1.35, marginBottom: 3 }}>{rfp.title}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{rfp.agency}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {rfp.source && <Chip label={rfp.source} bg="#e3e1da" fg="#386a7c" />}
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
              <div style={{ fontSize: 13, color: "#103b51", lineHeight: 1.55 }}>{rfp.relevanceReason}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>
              {rfp.source && `via ${rfp.source}`}{rfp.postedDate && ` · Posted ${rfp.postedDate}`}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {rfp.url && rfp.url !== "null" && (
                <a href={rfp.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "#ef525f", textDecoration: "underline" }}>View RFP →</a>
              )}
              {!inPipeline
                ? <button onClick={e => { e.stopPropagation(); onAdd(); }} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", background: "#103b51", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}>+ Add to Pipeline</button>
                : <Chip label="✓ In pipeline" bg="#ECFDF5" fg="#065F46" />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
