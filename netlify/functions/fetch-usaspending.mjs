// netlify/functions/fetch-usaspending.mjs
// Queries the USAspending.gov API for recent federal contract awards in California.
// No authentication required. Free public API, updated daily.
// Docs: https://api.usaspending.gov/

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Search for recent CA contract awards in consulting-related NAICS codes
    const naicsCodes = [
      "541611", // Administrative Management and General Management Consulting
      "541612", // Human Resources Consulting
      "541618", // Other Management Consulting
      "541620", // Environmental Consulting
      "541690", // Other Scientific and Technical Consulting
      "541720", // Research and Development in the Social Sciences and Humanities
      "541910", // Marketing Research and Public Opinion Polling
      "611430", // Professional and Management Development Training
      "541199", // All Other Legal Services (public policy)
    ];

    const now = new Date();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const results = [];

    // USAspending /api/v2/search/spending_by_award/ endpoint
    const body = {
      filters: {
        time_period: [{ start_date: fmt(sixtyDaysAgo), end_date: fmt(now) }],
        place_of_performance_locations: [{ country: "USA", state: "CA" }],
        naics_codes: naicsCodes,
        award_type_codes: ["A", "B", "C", "D"], // contracts
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Description",
        "Award Amount",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Start Date",
        "End Date",
        "generated_internal_id",
        "Contract Award Type",
      ],
      page: 1,
      limit: 50,
      sort: "Start Date",
      order: "desc",
    };

    const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("USAspending API error:", res.status);
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const awards = data.results || [];

    // Filter for consulting-relevant keywords
    const keywords = [
      "engagement", "planning", "facilitation", "design", "evaluation",
      "equity", "outreach", "training", "capacity", "stakeholder",
      "consulting", "community", "assessment", "strategy", "research",
      "technical assistance", "program management",
    ];

    for (const award of awards) {
      const desc = (award["Description"] || "").toLowerCase();
      const isRelevant = keywords.some(kw => desc.includes(kw));
      if (!isRelevant) continue;

      const internalId = award["generated_internal_id"] || "";
      results.push({
        id: `usaspending-${award["Award ID"] || internalId}`,
        title: (award["Description"] || "Untitled").slice(0, 200),
        agency: award["Awarding Sub Agency"] || award["Awarding Agency"] || "Federal Agency",
        url: internalId
          ? `https://www.usaspending.gov/award/${internalId}`
          : "https://www.usaspending.gov",
        deadline: award["End Date"] || null,
        description: (award["Description"] || "See USAspending.gov for details.").slice(0, 300),
        postedDate: award["Start Date"] || null,
        budget: award["Award Amount"]
          ? `$${Number(award["Award Amount"]).toLocaleString()}`
          : null,
        source: "USAspending.gov",
        relevanceScore: null,
        relevanceReason: null,
        serviceArea: null,
      });
    }

    // Deduplicate
    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return new Response(JSON.stringify({ results: unique.slice(0, 25) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("USAspending fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/fetch-usaspending",
};
