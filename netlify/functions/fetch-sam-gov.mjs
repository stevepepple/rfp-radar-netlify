// netlify/functions/fetch-sam-gov.mjs
// Directly queries the SAM.gov Opportunities API for open solicitations.
// Requires SAM_GOV_API_KEY env var (free at sam.gov → Profile → Request API Key).
// Rate limit: 10 requests/day for non-federal accounts.
// Profile-aware: pass ?profile=<id> to use that client's state / NAICS /
// keyword config (lives in src/profiles.js). Defaults to CivicMakers.

import { PROFILES, DEFAULT_PROFILE } from "../../src/profiles.js";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ results: [], skipped: "SAM_GOV_API_KEY not configured" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profileId = new URL(req.url).searchParams.get("profile") || DEFAULT_PROFILE;
  const profile = PROFILES[profileId] || PROFILES[DEFAULT_PROFILE];
  const q = profile.apiQuery || {};
  const samState = q.samState ?? null;
  const samNaics = q.samNaics || [];
  const relevantKeywords = q.samKeywords || [];

  try {
    // Search last 30 days of posted opportunities.
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const baseParams = () => {
      const p = new URLSearchParams({
        api_key: apiKey,
        postedFrom: fmt(thirtyDaysAgo),
        postedTo: fmt(now),
        ptype: "p,r,s,o,k", // presolicitation, sources sought, special notice, solicitation, combined
        limit: "50",
        offset: "0",
      });
      if (samState) p.set("state", samState);
      return p;
    };

    // Without NAICS, a single keyword-filtered call (CivicMakers behavior).
    // With NAICS, one call per code so national feeds surface relevant work
    // server-side — kept short to respect the 10/day SAM rate limit.
    const naicsToQuery = samNaics.length ? samNaics : [null];

    const opps = [];
    for (const ncode of naicsToQuery) {
      const params = baseParams();
      if (ncode) params.set("ncode", ncode);

      const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
      if (!res.ok) {
        const errText = await res.text();
        console.error("SAM.gov API error:", res.status, errText);
        continue;
      }
      const data = await res.json();
      opps.push(...(data.opportunitiesData || []));
    }

    const seen = new Set();
    const results = opps
      .filter(opp => {
        const text = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
        return relevantKeywords.length === 0 || relevantKeywords.some(kw => text.includes(kw));
      })
      .filter(opp => {
        if (seen.has(opp.noticeId)) return false;
        seen.add(opp.noticeId);
        return true;
      })
      .map(opp => ({
        id: `sam-gov-${opp.noticeId}`,
        title: opp.title || "Untitled",
        agency: opp.department || opp.subtier || "Federal Agency",
        url: opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`,
        deadline: opp.responseDeadLine || null,
        description: opp.description
          ? opp.description.replace(/<[^>]*>/g, "").slice(0, 300)
          : "See SAM.gov for full details.",
        postedDate: opp.postedDate || null,
        budget: null,
        source: "SAM.gov",
        relevanceScore: null,
        relevanceReason: null,
        serviceArea: null,
      }));

    return new Response(JSON.stringify({ results: results.slice(0, 25) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SAM.gov fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/fetch-sam-gov",
};
