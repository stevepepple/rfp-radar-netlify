// netlify/functions/scheduled-discover.mjs
// Runs on a cron schedule to prefetch RFP discovery results.
// Hybrid approach: direct API queries first, then caches to Blobs.
// Skips LLM web_search (too slow for 30s scheduled function limit).
// LLM scoring is included since it's fast (~5s, no web_search).

import { getStore } from "@netlify/blobs";

// Inline fetch helpers (can't import from other functions)
async function fetchGrantsGov() {
  const keywords = ["community engagement", "strategic planning", "capacity building"];
  const results = [];
  for (const keyword of keywords) {
    try {
      const res = await fetch("https://apply07.grants.gov/grantsws/rest/opportunities/search/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, oppStatuses: "posted", rows: 10, sortBy: "openDate|desc" }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const opp of (data.oppHits || [])) {
        results.push({
          id: `grants-gov-${opp.id || opp.oppNumber}`,
          title: opp.title || "Untitled",
          agency: opp.agency || "Federal Agency",
          url: opp.oppNumber ? `https://www.grants.gov/search-results-detail/${opp.oppNumber}` : null,
          deadline: opp.closeDate || null,
          description: (opp.synopsis || "").slice(0, 300) || "See grants.gov for details.",
          postedDate: opp.openDate || null,
          budget: opp.awardCeiling ? `$${Number(opp.awardCeiling).toLocaleString()}` : null,
          source: "grants.gov",
        });
      }
    } catch { /* continue */ }
  }
  const seen = new Set();
  return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 10);
}

async function fetchCaGrants() {
  try {
    const url = `https://data.ca.gov/api/3/action/datastore_search?resource_id=111c8c88-21f6-453c-ae2c-b4785a0624f5&limit=20&sort=openDate desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const keywords = ["engagement", "planning", "design", "equity", "training", "capacity", "community"];
    return (data.result?.records || [])
      .filter(r => {
        const text = `${r.grantTitle || ""} ${r.description || ""}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      })
      .map((r, i) => ({
        id: `ca-grants-${r._id || r.grantTitle?.replace(/\s+/g, "-").slice(0, 40) || `unknown-${i}`}`,
        title: r.grantTitle || "Untitled",
        agency: r.grantorName || "California State Agency",
        url: r.applicationLink || null,
        deadline: r.closeDate || null,
        description: (r.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        postedDate: r.openDate || null,
        budget: r.totalEstimatedFunding ? `$${Number(r.totalEstimatedFunding).toLocaleString()}` : null,
        source: "CA Grants Portal",
      }))
      .slice(0, 10);
  } catch { return []; }
}

async function fetchSamGov() {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) return [];
  try {
    const now = new Date();
    const ago = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    const params = new URLSearchParams({
      api_key: apiKey, postedFrom: fmt(ago), postedTo: fmt(now),
      ptype: "p,r,s,o,k", state: "CA", limit: "20",
    });
    const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const kws = ["engagement", "planning", "design", "equity", "training", "capacity", "consulting", "community"];
    return (data.opportunitiesData || [])
      .filter(o => { const t = `${o.title || ""}`.toLowerCase(); return kws.some(k => t.includes(k)); })
      .map(o => ({
        id: `sam-gov-${o.noticeId}`,
        title: o.title || "Untitled",
        agency: o.department || "Federal Agency",
        url: o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`,
        deadline: o.responseDeadLine || null,
        description: (o.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        postedDate: o.postedDate || null,
        budget: null,
        source: "SAM.gov",
      }))
      .slice(0, 10);
  } catch { return []; }
}

async function fetchExternalScraper() {
  const scraperUrl = process.env.EXTERNAL_SCRAPER_URL || "https://api.vibemap.com/v0.3/scrape";
  const apiKey = process.env.SCRAPE_API_KEY || "YCdPyIza7gpVA4UAJIuKrMUKV9BVwuP-7yfgPY_Ycg8";
  if (!apiKey) return [];

  const targetUrls = [
    "https://caleprocure.ca.gov",
    "https://procurement.opengov.com",
    "https://pbsystem.planetbids.com",
    "https://www.bart.gov/about/business/procurement",
    "https://mtc.ca.gov/about-mtc/careers-and-contracting",
    "https://sf.gov/information/bid-opportunities",
    "https://www.sanjoseca.gov/doing-business/bids-purchasing",
    "https://www.oaklandca.gov/topics/city-of-oakland-bids",
    "https://www.marincounty.gov/contracting-opportunities",
    "https://www.smcgov.org/ceo/request-proposals-rfp",
    "https://www.ocwd.com/about/rfp-contracts/",
    "https://www.mwdoc.com/about-mwdoc/rfps-rfqs/",
    "https://www.hacla.org/procurement",
    "https://hbex.coveredca.com/solicitations/",
    "https://sgc.ca.gov",
    "https://www.csuchico.edu/pcs/current-bids.shtml"
  ];

  try {
    const res = await fetch(scraperUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Api-Key " + apiKey
      },
      body: JSON.stringify({
        urls: targetUrls,
        profile: "procurement"
      })
    });
    
    if (!res.ok) {
      console.error("External scraper returned:", res.status);
      return [];
    }
    
    const json = await res.json();
    const finalRecords = [];
    for (const r of (json.results || [])) {
      if (r.success && Array.isArray(r.data)) {
        for (const item of r.data) {
          finalRecords.push({
            id: `scrape-${(item.title || "").replace(/[^a-z0-9]/gi, "").slice(0, 20)}-${Date.now()}`,
            title: item.title || "Untitled",
            agency: item.agency || "Unknown Agency",
            url: item.url || r.url,
            deadline: item.deadline || null,
            description: (item.description || "").slice(0, 300),
            postedDate: null,
            budget: item.budget_range || null,
            source: "External Scraper / " + new URL(r.url).hostname
          });
        }
      } else if (!r.success) {
        console.warn(`Scrape failed for ${r.url}:`, r.error);
      }
    }
    return finalRecords;
  } catch (err) {
    console.error("External scraper error:", err);
    return [];
  }
}

export default async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    // Fetch from all direct APIs in parallel
    const [grantsGov, caGrants, samGov, externalScraped] = await Promise.all([
      fetchGrantsGov(),
      fetchCaGrants(),
      fetchSamGov(),
      fetchExternalScraper()
    ]);

    const allResults = [...grantsGov, ...caGrants, ...samGov, ...externalScraped];
    console.log(`Scheduled: fetched ${allResults.length} raw opportunities from APIs & scraper`);

    // Score with LLM if available (fast, no web_search)
    let finalResults = allResults;
    if (apiKey && allResults.length > 0) {
      try {
        const summaries = allResults.map((o, i) =>
          `[${i}] "${o.title}" — ${o.agency} — ${o.description?.slice(0, 100) || "No description"}`
        ).join("\n");

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            system: "Output ONLY valid JSON arrays. No markdown fences.",
            messages: [{ role: "user", content: `Score these RFP opportunities for CivicMakers (CA public sector design consultancy). For each, provide relevanceScore (1-10), relevanceReason (1 sentence), serviceArea (Service Design & Evaluation | Strategic Planning | Community & Stakeholder Engagement | Training & Capacity Building).\n\n${summaries}\n\nReturn: [{"index":0,"relevanceScore":7,"relevanceReason":"...","serviceArea":"..."},...]` }],
          }),
        });
        const data = await res.json();
        const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
        const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          const scores = JSON.parse(match[0]);
          finalResults = allResults.map((opp, i) => {
            const s = scores.find(x => x.index === i) || {};
            return { ...opp, relevanceScore: s.relevanceScore ?? 5, relevanceReason: s.relevanceReason ?? "", serviceArea: s.serviceArea ?? "Community & Stakeholder Engagement" };
          });
        }
      } catch (scoreErr) {
        console.error("Scheduled scoring error (non-fatal):", scoreErr);
      }
    }

    // Cache to Blobs
    const store = getStore("rfp-cache");
    await store.setJSON("results", {
      results: JSON.stringify(finalResults),
      cachedAt: new Date().toISOString(),
    });

    console.log(`Scheduled discovery complete — ${finalResults.length} results cached to Blobs`);
  } catch (err) {
    console.error("Scheduled discovery error:", err);
  }
};

export const config = {
  schedule: "0 16 * * 1-5",  // Weekdays at 4pm UTC (8am PST / 9am PDT)
};
