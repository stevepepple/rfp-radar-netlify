import { CACHE_TTL_MS } from './constants';

export function scoreStyle(s) {
  if (s >= 8) return { bg: "#DCFCE7", fg: "#166534", border: "#86EFAC" };
  if (s >= 6) return { bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D" };
  if (s >= 4) return { bg: "#DBEAFE", fg: "#1E40AF", border: "#93C5FD" };
  return { bg: "#F3F4F6", fg: "#6B7280", border: "#D1D5DB" };
}

export function cacheAge(lastRun) {
  if (!lastRun) return null;
  const ms = Date.now() - new Date(lastRun).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function isCacheFresh(lastRun) {
  if (!lastRun) return false;
  return Date.now() - new Date(lastRun).getTime() < CACHE_TTL_MS;
}

export function isUrgent(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d)) return false;
  const diff = (d - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 14;
}

export function isPast(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !isNaN(d) && d < new Date();
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function loadLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
