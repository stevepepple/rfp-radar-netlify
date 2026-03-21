// netlify/functions/fetch-ca-grants.mjs
// Directly queries the California Grants Portal via the data.ca.gov CKAN API.
// No authentication required. Returns normalized RFP objects.

const RESOURCE_ID = "111c8c88-21f6-453c-ae2c-b4785a0624f5";
const CKAN_API = "https://data.ca.gov/api/3/action/datastore_search_sql";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // SQL query for open grants related to CivicMakers service areas
    const sql = `
      SELECT *
      FROM "${RESOURCE_ID}"
      WHERE (
        "grantTitle" ILIKE '%community%'
        OR "grantTitle" ILIKE '%engagement%'
        OR "grantTitle" ILIKE '%planning%'
        OR "grantTitle" ILIKE '%equity%'
        OR "grantTitle" ILIKE '%design%'
        OR "grantTitle" ILIKE '%training%'
        OR "grantTitle" ILIKE '%capacity%'
        OR "grantTitle" ILIKE '%evaluation%'
        OR "grantTitle" ILIKE '%stakeholder%'
        OR "description" ILIKE '%community engagement%'
        OR "description" ILIKE '%strategic planning%'
        OR "description" ILIKE '%capacity building%'
      )
      AND "status" = 'Active'
      ORDER BY "openDate" DESC
      LIMIT 20
    `.trim();

    const url = `${CKAN_API}?sql=${encodeURIComponent(sql)}`;
    const res = await fetch(url);

    if (!res.ok) {
      // Fallback: try simpler datastore_search if SQL endpoint fails
      const fallbackUrl = `https://data.ca.gov/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=30&sort=openDate desc`;
      const fallbackRes = await fetch(fallbackUrl);

      if (!fallbackRes.ok) {
        console.error("CA Grants API error:", fallbackRes.status);
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const fallbackData = await fallbackRes.json();
      const records = fallbackData.result?.records || [];
      return new Response(JSON.stringify({ results: normalizeRecords(records) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const records = data.result?.records || [];

    return new Response(JSON.stringify({ results: normalizeRecords(records) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CA Grants fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

function normalizeRecords(records) {
  return records
    .filter(r => {
      // Filter for consulting/services relevant to CivicMakers
      const text = `${r.grantTitle || ""} ${r.description || ""}`.toLowerCase();
      const keywords = ["engagement", "planning", "design", "equity", "training", "capacity", "evaluation", "stakeholder", "community", "facilitation"];
      return keywords.some(kw => text.includes(kw));
    })
    .map((r, i) => ({
      id: `ca-grants-${r._id || r.grantTitle?.slice(0, 30).replace(/\s+/g, "-") || `unknown-${i}`}`,
      title: r.grantTitle || "Untitled",
      agency: r.grantorName || r.agencyName || "California State Agency",
      url: r.applicationLink || r.grantLink || null,
      deadline: r.closeDate || r.deadline || null,
      description: r.description
        ? r.description.replace(/<[^>]*>/g, "").slice(0, 300)
        : "See grants.ca.gov for full details.",
      postedDate: r.openDate || null,
      budget: r.totalEstimatedFunding
        ? `$${Number(r.totalEstimatedFunding).toLocaleString()}`
        : r.awardAmountMax
          ? `Up to $${Number(r.awardAmountMax).toLocaleString()}`
          : null,
      source: "CA Grants Portal",
      relevanceScore: null,
      relevanceReason: null,
      serviceArea: null,
    }))
    .slice(0, 15);
}

export const config = {
  path: "/.netlify/functions/fetch-ca-grants",
};
