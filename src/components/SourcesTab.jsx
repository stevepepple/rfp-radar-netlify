import React from 'react';
import { Chip } from './Chip';
import { SOURCES, TIER_STYLE } from '../constants';

export function SourcesTab() {
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
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#103b51", textDecoration: "none" }}>{s.name}</a>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{s.type}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 18, padding: "13px 14px", background: "#F8FAFF", border: "1px solid #DBEAFE", borderRadius: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#1E40AF", marginBottom: 8 }}>Cal eProcure UNSPSC codes</div>
        {[["80101500","Management consulting"],["80101501","Organizational development"],["80111600","Public relations"],["80161600","Training programs"],["93141702","Community programs"],["80141602","Facilitation services"]].map(([code, label]) => (
          <div key={code} style={{ fontSize: 12, color: "#103b51", padding: "2px 0" }}>
            <span style={{ fontFamily: "monospace", color: "#ef525f", marginRight: 8 }}>{code}</span>{label}
          </div>
        ))}
      </div>
    </div>
  );
}
