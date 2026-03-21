import React from 'react';

export function StatCard({ label, value, accent = "#103b51" }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 56 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{label}</div>
    </div>
  );
}
