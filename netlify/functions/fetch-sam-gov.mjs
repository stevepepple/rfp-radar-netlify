// netlify/functions/fetch-sam-gov.mjs
// Directly queries the SAM.gov Opportunities API for open solicitations.
// Requires SAM_GOV_API_KEY env var (free at sam.gov → Profile → Request API Key).
// Rate limit: 10 requests/day for non-federal accounts.

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

  try {
    // Search last 30 days of posted opportunities in California
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const params = new URLSearchParams({
      api_key: apiKey,
      postedFrom: fmt(thirtyDaysAgo),
      postedTo: fmt(now),
      ptype: "p,r,s,o,k",  // presolicitation, sources sought, special notice, solicitation, combined
      state: "CA",
      limit: "25",
      offset: "0",
    });

    const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);

    if (!res.ok) {
      const errText = await res.text();
      console.error("SAM.gov API error:", res.status, errText);
      return new Response(JSON.stringify({ results: [], error: `SAM.gov returned ${res.status}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const opps = data.opportunitiesData || [];

    // Filter for consulting/services relevant to CivicMakers
    const relevantKeywords = [
      "engagement", "planning", "facilitation", "design", "evaluation",
      "equity", "outreach", "training", "capacity", "stakeholder",
      "consulting", "community", "assessment", "strategy",
    ];

    const results = opps
      .filter(opp => {
        const text = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
        return relevantKeywords.some(kw => text.includes(kw));
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

    return new Response(JSON.stringify({ results: results.slice(0, 15) }), {
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
