// netlify/functions/fetch-grants-gov.mjs
// Directly queries the grants.gov REST API for open opportunities.
// No authentication required. Returns normalized RFP objects.

const KEYWORDS = [
  "community engagement",
  "strategic planning",
  "human-centered design",
  "stakeholder engagement",
  "capacity building",
  "service design",
  "equity assessment",
  "program evaluation",
  "facilitation",
  "public participation",
];

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Search grants.gov for California consulting opportunities
    const results = [];

    // Query a few keywords (grants.gov search2 API)
    for (const keyword of KEYWORDS.slice(0, 6)) {
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
        // Filter for California or national scope
        const desc = (opp.synopsis || "").toLowerCase();
        const title = (opp.title || "").toLowerCase();
        const combined = `${title} ${desc}`;

        if (
          combined.includes("california") ||
          combined.includes("nationwide") ||
          combined.includes("national") ||
          !opp.synopsis // include if no description to filter on
        ) {
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
