// netlify/functions/fetch-nsf.mjs
// Queries the NSF Award Search API for recent awards related to
// community engagement, planning, and evaluation.
// No authentication required. Free public API.
// Docs: https://www.nsf.gov/digital/developer

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const keywords = [
      "community engagement",
      "stakeholder engagement",
      "capacity building",
      "program evaluation",
      "civic participation",
      "public participation",
    ];

    const now = new Date();
    const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const fmtDate = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const results = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const params = new URLSearchParams({
          keyword: keyword,
          dateStart: fmtDate(sixMonthsAgo),
          dateEnd: fmtDate(now),
          printFields: "id,title,agency,fundsObligatedAmt,startDate,expDate,abstractText,fundProgramName,piFirstName,piLastName,perfCity,perfStateCode",
          offset: "1",
          rpp: "15",
        });

        const res = await fetch(`https://api.nsf.gov/services/v1/awards.json?${params}`);
        if (!res.ok) continue;

        const data = await res.json();
        const awards = data.response?.award || [];

        for (const award of awards) {
          const perfState = award.perfStateCode || "";
          const abstract = award.abstractText || "";
          const title = award.title || "";
          const text = `${title} ${abstract}`.toLowerCase();

          // Focus on California or nationally relevant awards
          const isCA = perfState === "CA" || text.includes("california");
          const isNational = text.includes("national") || text.includes("nationwide");
          if (!isCA && !isNational && perfState) continue;

          results.push({
            id: `nsf-${award.id}`,
            title: title || "Untitled NSF Award",
            agency: `NSF — ${award.fundProgramName || "Research Program"}`,
            url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${award.id}`,
            deadline: award.expDate || null,
            description: abstract
              ? abstract.replace(/<[^>]*>/g, "").slice(0, 300)
              : "See NSF.gov for full details.",
            postedDate: award.startDate || null,
            budget: award.fundsObligatedAmt
              ? `$${Number(award.fundsObligatedAmt).toLocaleString()}`
              : null,
            source: "NSF",
            relevanceScore: null,
            relevanceReason: null,
            serviceArea: null,
          });
        }
      } catch { /* continue to next keyword */ }
    }

    // Deduplicate
    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return new Response(JSON.stringify({ results: unique.slice(0, 20) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("NSF fetch error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/fetch-nsf",
};
