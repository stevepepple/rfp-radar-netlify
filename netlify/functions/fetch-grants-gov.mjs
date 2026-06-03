// netlify/functions/fetch-grants-gov.mjs
// Directly queries the grants.gov REST API for open opportunities.
// No authentication required. Returns normalized RFP objects.
// Profile-aware: pass ?profile=<id> to use that client's keywords / geo
// filter (config lives in src/profiles.js). Defaults to CivicMakers.

import { PROFILES, DEFAULT_PROFILE } from "../../src/profiles.js";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profileId = new URL(req.url).searchParams.get("profile") || DEFAULT_PROFILE;
  const profile = PROFILES[profileId] || PROFILES[DEFAULT_PROFILE];
  const q = profile.apiQuery || {};
  const keywords = (q.grantsKeywords || []).slice(0, q.grantsKeywordLimit || 6);
  const geoTerms = q.grantsGeo || [];

  try {
    const results = [];

    // Query a few keywords (grants.gov search2 API)
    for (const keyword of keywords) {
      const searchBody = {
        keyword: keyword,
        oppStatuses: "posted",
        rows: 20,
        sortBy: "openDate|desc",
      };

      const res = await fetch("https://apply07.grants.gov/grantsws/rest/opportunities/search/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
      });

      if (!res.ok) continue;
      const data = await res.json();

      const opps = data.oppHits || [];
      for (const opp of opps) {
        // Optional geographic narrowing. An empty geo list (e.g. Vibemap's
        // national scope) keeps every keyword match.
        const desc = (opp.synopsis || "").toLowerCase();
        const title = (opp.title || "").toLowerCase();
        const combined = `${title} ${desc}`;
        const geoOk =
          geoTerms.length === 0 ||
          geoTerms.some(t => combined.includes(t)) ||
          !opp.synopsis; // include if there's no description to filter on

        if (geoOk) {
          results.push({
            id: `grants-gov-${opp.id || opp.oppNumber}`,
            title: opp.title || "Untitled",
            agency: opp.agency || opp.agencyCode || "Federal Agency",
            url: opp.oppNumber
              ? `https://www.grants.gov/search-results-detail/${opp.oppNumber}`
              : null,
            deadline: opp.closeDate || null,
            description: opp.synopsis
              ? opp.synopsis.slice(0, 300)
              : "See grants.gov for full details.",
            postedDate: opp.openDate || null,
            budget: opp.awardCeiling
              ? `$${Number(opp.awardCeiling).toLocaleString()}`
              : null,
            source: "grants.gov",
            // These will be filled by the scoring function
            relevanceScore: null,
            relevanceReason: null,
            serviceArea: null,
          });
        }
      }
    }

    // Deduplicate by ID
    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return new Response(JSON.stringify({ results: unique.slice(0, 30) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("grants.gov fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200, // return empty results, not 500 — don't block the pipeline
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/fetch-grants-gov",
};
