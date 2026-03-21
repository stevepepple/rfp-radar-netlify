import React from 'react';
import { scoreStyle } from '../utils';

export function Score({ score }) {
  const c = scoreStyle(score);
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: c.bg, color: c.fg, border: `1.5px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
      {score}
    </div>
  );
}
