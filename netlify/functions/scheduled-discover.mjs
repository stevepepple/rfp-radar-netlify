// netlify/functions/scheduled-discover.mjs
// Runs on a cron schedule to prefetch RFP discovery results.
// Hybrid approach: direct API queries first, then caches to Blobs.
// Skips LLM web_search (too slow for 30s scheduled function limit).
// LLM scoring is included since it's fast (~5s, no web_search).

import { getStore } from "@netlify/blobs";

// Inline fetch helpers (can't import from other functions)
async function fetchGrantsGov() {
  const keywords = ["community engagement", "strategic planning", "capacity building", "stakeholder engagement", "equity assessment", "program evaluation", "service design", "facilitation", "public participation"];
  const results = [];
  for (const keyword of keywords) {
    try {
      const res = await fetch("https://apply07.grants.gov/grantsws/rest/opportunities/search/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, oppStatuses: "posted", rows: 20, sortBy: "openDate|desc" }),
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
  return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 30);
}

async function fetchCaGrants() {
  try {
    const url = `https://data.ca.gov/api/3/action/datastore_search?resource_id=111c8c88-21f6-453c-ae2c-b4785a0624f5&limit=50&sort=openDate desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const keywords = ["engagement", "planning", "design", "equity", "training", "capacity", "community", "evaluation", "stakeholder", "facilitation", "outreach"];
    return (data.result?.records || [])
      .filter(r => {
        const title = r.Title || r.grantTitle || "";
        const desc = r.Description || r.description || "";
        const purpose = r.Purpose || "";
        const text = `${title} ${desc} ${purpose}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      })
      .map((r, i) => ({
        id: `ca-grants-${r._id || r.PortalID || (r.Title || r.grantTitle || "").replace(/\s+/g, "-").slice(0, 40) || `unknown-${i}`}`,
        title: r.Title || r.grantTitle || "Untitled",
        agency: r.AgencyDept || r.grantorName || "California State Agency",
        url: r.GrantURL || r.AgencyURL || r.applicationLink || null,
        deadline: r.ApplicationDeadline || r.closeDate || null,
        description: (r.Description || r.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        postedDate: r.OpenDate || r.openDate || null,
        budget: r.EstAvailFunds || (r.totalEstimatedFunding ? `$${Number(r.totalEstimatedFunding).toLocaleString()}` : null),
        source: "CA Grants Portal",
      }))
      .slice(0, 25);
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
      ptype: "p,r,s,o,k", state: "CA", limit: "50",
    });
    const res = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const kws = ["engagement", "planning", "design", "equity", "training", "capacity", "consulting", "community", "facilitation", "evaluation", "stakeholder", "outreach", "assessment", "strategy", "technical assistance"];
    return (data.opportunitiesData || [])
      .filter(o => { const t = `${o.title || ""} ${o.description || ""}`.toLowerCase(); return kws.some(k => t.includes(k)); })
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
      .slice(0, 25);
  } catch { return []; }
}

async function fetchUSAspending() {
  try {
    const naicsCodes = [
      "541611", "541612", "541618", "541620", "541690",
      "541720", "541910", "611430", "541199",
    ];
    const now = new Date();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const body = {
      filters: {
        time_period: [{ start_date: fmt(sixtyDaysAgo), end_date: fmt(now) }],
        place_of_performance_locations: [{ country: "USA", state: "CA" }],
        naics_codes: naicsCodes,
        award_type_codes: ["A", "B", "C", "D"],
      },
      fields: [
        "Award ID", "Recipient Name", "Description", "Award Amount",
        "Awarding Agency", "Awarding Sub Agency", "Start Date", "End Date",
        "generated_internal_id",
      ],
      page: 1, limit: 50, sort: "Start Date", order: "desc",
    };

    const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const kws = ["engagement", "planning", "facilitation", "design", "evaluation", "equity", "outreach", "training", "capacity", "stakeholder", "consulting", "community", "assessment", "strategy", "technical assistance"];

    const results = [];
    for (const a of (data.results || [])) {
      const desc = (a["Description"] || "").toLowerCase();
      if (!kws.some(k => desc.includes(k))) continue;
      const iid = a["generated_internal_id"] || "";
      results.push({
        id: `usaspending-${a["Award ID"] || iid}`,
        title: (a["Description"] || "Untitled").slice(0, 200),
        agency: a["Awarding Sub Agency"] || a["Awarding Agency"] || "Federal Agency",
        url: iid ? `https://www.usaspending.gov/award/${iid}` : "https://www.usaspending.gov",
        deadline: a["End Date"] || null,
        description: (a["Description"] || "See USAspending.gov for details.").slice(0, 300),
        postedDate: a["Start Date"] || null,
        budget: a["Award Amount"] ? `$${Number(a["Award Amount"]).toLocaleString()}` : null,
        source: "USAspending.gov",
      });
    }
    const seen = new Set();
    return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 25);
  } catch (err) { console.error("USAspending error:", err); return []; }
}

async function fetchSBIR() {
  try {
    const res = await fetch("https://www.sbir.gov/api/solicitations.json?keyword=community+engagement+planning+evaluation&open=1&rows=30");
    if (!res.ok) return [];
    const data = await res.json();
    const solicitations = Array.isArray(data) ? data : (data.results || data.solicitations || []);

    const kws = ["engagement", "planning", "design", "evaluation", "equity", "community", "training", "capacity", "stakeholder", "outreach", "facilitation", "social"];
    const results = [];
    for (const sol of solicitations) {
      const title = sol.solicitation_title || sol.title || "";
      const desc = sol.description || sol.abstract || "";
      const text = `${title} ${desc}`.toLowerCase();
      if (!kws.some(k => text.includes(k))) continue;
      results.push({
        id: `sbir-${sol.solicitation_id || sol.topic_number || sol.id || Date.now()}`,
        title: title || "Untitled SBIR Solicitation",
        agency: sol.agency || sol.branch || "Federal Agency (SBIR)",
        url: sol.solicitation_url || sol.url || `https://www.sbir.gov/node/${sol.id || ""}`,
        deadline: sol.close_date || sol.deadline || null,
        description: (desc || "See SBIR.gov for details.").replace(/<[^>]*>/g, "").slice(0, 300),
        postedDate: sol.open_date || sol.release_date || null,
        budget: sol.award_ceiling ? `$${Number(sol.award_ceiling).toLocaleString()}`
          : sol.phase === "Phase I" ? "Up to $275,000" : sol.phase === "Phase II" ? "Up to $1,000,000" : null,
        source: "SBIR.gov",
      });
    }
    const seen = new Set();
    return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 15);
  } catch (err) { console.error("SBIR error:", err); return []; }
}

async function fetchNSF() {
  try {
    const keywords = ["community engagement", "stakeholder engagement", "capacity building"];
    const now = new Date();
    const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const fmtD = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    const results = [];

    for (const keyword of keywords) {
      try {
        const params = new URLSearchParams({
          keyword, dateStart: fmtD(sixMonthsAgo), dateEnd: fmtD(now),
          printFields: "id,title,agency,fundsObligatedAmt,startDate,expDate,abstractText,fundProgramName,perfStateCode",
          offset: "1", rpp: "15",
        });
        const res = await fetch(`https://api.nsf.gov/services/v1/awards.json?${params}`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const award of (data.response?.award || [])) {
          const perfState = award.perfStateCode || "";
          const text = `${award.title || ""} ${award.abstractText || ""}`.toLowerCase();
          const isCA = perfState === "CA" || text.includes("california");
          const isNational = text.includes("national") || text.includes("nationwide");
          if (!isCA && !isNational && perfState) continue;
          results.push({
            id: `nsf-${award.id}`,
            title: award.title || "Untitled NSF Award",
            agency: `NSF — ${award.fundProgramName || "Research Program"}`,
            url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${award.id}`,
            deadline: award.expDate || null,
            description: (award.abstractText || "See NSF.gov for details.").replace(/<[^>]*>/g, "").slice(0, 300),
            postedDate: award.startDate || null,
            budget: award.fundsObligatedAmt ? `$${Number(award.fundsObligatedAmt).toLocaleString()}` : null,
            source: "NSF",
          });
        }
      } catch { /* continue */ }
    }
    const seen = new Set();
    return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 20);
  } catch (err) { console.error("NSF error:", err); return []; }
}

async function fetchExternalScraper() {
  const scraperUrl = process.env.EXTERNAL_SCRAPER_URL || "https://api.vibemap.com/v0.3/scrape";
  const apiKey = process.env.SCRAPE_API_KEY || "Jk95FHNt.ODSi0b0lgiVz7jCvHqEqO6D0zJOZSoGU";
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
    "https://www.csuchico.edu/pcs/current-bids.shtml",
    "https://www.calfund.org/nonprofits/open-grants/",
    "https://www.calendow.org/opportunities/",
    "https://sff.org/nonprofits/",
    "https://calworkforce.org/rfps/",
    "https://www.ca-ilg.org/rfps",
    "https://www.bidnetdirect.com/california",
    "https://www.publicpurchase.com",
    "https://www.bidsync.com",
    "https://www.sfmta.com/doing-business-with-sfmta/contracts-and-bids",
    "https://business.metro.net/ebidboard",
    "https://www.smctd.com/doing-business/procurement/bids-and-contracts",
    "https://www.vta.org/business-center/procurement/doing-business-vta",
    "https://www.sandag.org/doing-business/contracting-opportunities",
    "https://www.alamedactc.org/doing-business/contracting-opportunities",
    // Additional sources for broader coverage
    "https://www.demandstar.com/app/browse-bids/states/california",
    "https://www.calsaws.org/procurement-listings/",
    "https://cleanpoweralliance.org/contracting-opportunities/",
    "https://www.sccgov.org/sites/scc/Pages/Doing-Business-with-the-County.aspx",
    "https://www.acgov.org/gsa/purchasing/bid_content/contractopportunities.jsp",
    "https://www.contracosta.ca.gov/6495/Bids-Proposals",
    "https://www.cityofberkeley.info/Finance/Purchasing/Bids_Current_and_Awarded.aspx",
    "https://www.cityofsacramento.org/Finance/Procurement/Bids-and-Contracts",
    "https://www.sfdph.org/dph/comupg/aboutdph/insideDept/ofcContracting/RFPs.asp",
    "https://lacounty.gov/government/opportunities/",
    "https://www.sandiegocounty.gov/content/sdc/purchasing/solicitations.html",
    "https://www.fresnocountyca.gov/Departments/Internal-Services/Purchasing/Bids",
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
    const [grantsGov, caGrants, samGov, usaSpending, sbir, nsf, externalScraped] = await Promise.all([
      fetchGrantsGov(),
      fetchCaGrants(),
      fetchSamGov(),
      fetchUSAspending(),
      fetchSBIR(),
      fetchNSF(),
      fetchExternalScraper()
    ]);

    const allResults = [...grantsGov, ...caGrants, ...samGov, ...usaSpending, ...sbir, ...nsf, ...externalScraped];
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
