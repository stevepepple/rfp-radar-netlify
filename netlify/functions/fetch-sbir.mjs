// netlify/functions/fetch-sbir.mjs
// Queries the SBIR.gov Topic API for open solicitations.
// No authentication required. Free public API.
// Docs: https://www.sbir.gov/api

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch open solicitations from SBIR.gov
    const res = await fetch("https://www.sbir.gov/api/solicitations.json?keyword=community+engagement+planning+evaluation&open=1&rows=30");

    if (!res.ok) {
      // Fallback: try the topics endpoint
      const topicsRes = await fetch("https://www.sbir.gov/api/topics.json?keyword=community+planning+engagement&open=1&rows=30");
      if (!topicsRes.ok) {
        console.error("SBIR.gov API error:", topicsRes.status);
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const topicsData = await topicsRes.json();
      return new Response(JSON.stringify({ results: normalizeTopics(topicsData) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const solicitations = Array.isArray(data) ? data : (data.results || data.solicitations || []);

    const keywords = [
      "engagement", "planning", "design", "evaluation", "equity",
      "community", "training", "capacity", "stakeholder", "outreach",
      "facilitation", "assessment", "public health", "social",
    ];

    const results = [];
    for (const sol of solicitations) {
      const title = sol.solicitation_title || sol.title || "";
      const desc = sol.description || sol.abstract || "";
      const text = `${title} ${desc}`.toLowerCase();
      const isRelevant = keywords.some(kw => text.includes(kw));
      if (!isRelevant) continue;

      results.push({
        id: `sbir-${sol.solicitation_id || sol.topic_number || sol.id || Date.now()}`,
        title: title || "Untitled SBIR Solicitation",
        agency: sol.agency || sol.branch || "Federal Agency (SBIR)",
        url: sol.solicitation_url || sol.url || `https://www.sbir.gov/node/${sol.id || ""}`,
        deadline: sol.close_date || sol.deadline || null,
        description: (desc || "See SBIR.gov for details.").replace(/<[^>]*>/g, "").slice(0, 300),
        postedDate: sol.open_date || sol.release_date || null,
        budget: sol.award_ceiling
          ? `$${Number(sol.award_ceiling).toLocaleString()}`
          : sol.phase === "Phase I" ? "Up to $275,000"
          : sol.phase === "Phase II" ? "Up to $1,000,000"
          : null,
        source: "SBIR.gov",
        relevanceScore: null,
        relevanceReason: null,
        serviceArea: null,
      });
    }

    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return new Response(JSON.stringify({ results: unique.slice(0, 15) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SBIR.gov fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

function normalizeTopics(data) {
  const topics = Array.isArray(data) ? data : (data.results || data.topics || []);
  return topics.slice(0, 15).map(t => ({
    id: `sbir-topic-${t.topic_number || t.id || Date.now()}`,
    title: t.topic_title || t.title || "Untitled SBIR Topic",
    agency: t.agency || t.branch || "Federal Agency (SBIR)",
    url: t.url || t.solicitation_url || "https://www.sbir.gov",
    deadline: t.close_date || null,
    description: (t.description || t.abstract || "See SBIR.gov for details.").replace(/<[^>]*>/g, "").slice(0, 300),
    postedDate: t.open_date || null,
    budget: null,
    source: "SBIR.gov",
    relevanceScore: null,
    relevanceReason: null,
    serviceArea: null,
  }));
}

export const config = {
  path: "/.netlify/functions/fetch-sbir",
};
