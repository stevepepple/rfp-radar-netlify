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
        "Title" ILIKE '%community%'
        OR "Title" ILIKE '%engagement%'
        OR "Title" ILIKE '%planning%'
        OR "Title" ILIKE '%equity%'
        OR "Title" ILIKE '%design%'
        OR "Title" ILIKE '%training%'
        OR "Title" ILIKE '%capacity%'
        OR "Title" ILIKE '%evaluation%'
        OR "Title" ILIKE '%stakeholder%'
        OR "Description" ILIKE '%community engagement%'
        OR "Description" ILIKE '%strategic planning%'
        OR "Description" ILIKE '%capacity building%'
        OR "Purpose" ILIKE '%engagement%'
        OR "Purpose" ILIKE '%planning%'
      )
      AND "Status" = 'active'
      ORDER BY "OpenDate" DESC
      LIMIT 100
    `.trim();

    const url = `${CKAN_API}?sql=${encodeURIComponent(sql)}`;
    const res = await fetch(url);

    if (!res.ok) {
      // Fallback: try simpler datastore_search if SQL endpoint fails
      const fallbackUrl = `https://data.ca.gov/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=100&sort=openDate desc`;
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
      const title = r.Title || r.grantTitle || "";
      const desc = r.Description || r.description || "";
      const purpose = r.Purpose || "";
      const text = `${title} ${desc} ${purpose}`.toLowerCase();
      const keywords = ["engagement", "planning", "design", "equity", "training", "capacity", "evaluation", "stakeholder", "community", "facilitation", "outreach"];
      return keywords.some(kw => text.includes(kw));
    })
    .map((r, i) => ({
      id: `ca-grants-${r._id || r.PortalID || (r.Title || r.grantTitle || "").slice(0, 30).replace(/\s+/g, "-") || `unknown-${i}`}`,
      title: r.Title || r.grantTitle || "Untitled",
      agency: r.AgencyDept || r.grantorName || r.agencyName || "California State Agency",
      url: r.GrantURL || r.AgencyURL || r.applicationLink || r.grantLink || null,
      deadline: r.ApplicationDeadline || r.closeDate || r.deadline || null,
      description: (r.Description || r.description)
        ? (r.Description || r.description).replace(/<[^>]*>/g, "").slice(0, 300)
        : "See grants.ca.gov for full details.",
      postedDate: r.OpenDate || r.openDate || null,
      budget: r.EstAvailFunds
        || (r.totalEstimatedFunding ? `$${Number(r.totalEstimatedFunding).toLocaleString()}` : null)
        || (r.awardAmountMax ? `Up to $${Number(r.awardAmountMax).toLocaleString()}` : null),
      source: "CA Grants Portal",
      relevanceScore: null,
      relevanceReason: null,
      serviceArea: null,
    }))
    .slice(0, 100);
}

export const config = {
  path: "/.netlify/functions/fetch-ca-grants",
};
