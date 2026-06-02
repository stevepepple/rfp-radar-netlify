// src/profiles.js
// Single source of truth for RFP Radar client profiles.
// Imported by BOTH the frontend (src/App.jsx) and the serverless
// discovery function (netlify/functions/discover.mjs). Do NOT duplicate
// scope / prompt / criteria logic anywhere else — change it here.
//
// Each profile drives:
//   - the geographic scope + role used in the LLM discovery prompt
//   - the service-area filter chips shown in the UI
//   - which direct-API endpoints the frontend queries (CivicMakers only)
//   - the system prompt sent to the Anthropic API

export const DEFAULT_PROFILE = "civicmakers";

export const PROFILES = {
  // ──────────────────────────────────────────────────────────────────────
  // CivicMakers — California civic-engagement / public-sector design RFPs.
  // This is a reconstruction of the original single-client behavior; the
  // prompt, sources, and service areas mirror the previous hardcoded logic.
  // ──────────────────────────────────────────────────────────────────────
  civicmakers: {
    id: "civicmakers",
    label: "CivicMakers",
    blurb: "California civic-engagement & public-sector design RFPs",
    org: "CivicMakers",
    role: "an RFP research assistant for CivicMakers, a California public sector design consultancy",
    systemPrompt:
      "You are an expert RFP researcher for a California public sector consultancy. After all web searches, output ONLY a valid JSON array — no markdown fences, no explanation. Start with [ and end with ].",
    // Scope description used in the search instructions.
    geography: "California",
    solicitationTypes: "RFPs, RFQs, IFBs, and consulting solicitations",
    // First entry is the "show everything" sentinel used by the UI filter.
    serviceAreas: [
      "All service areas",
      "Service Design & Evaluation",
      "Strategic Planning",
      "Community & Stakeholder Engagement",
      "Training & Capacity Building",
    ],
    // Default service area applied to direct-API results that arrive unscored.
    defaultServiceArea: "Community & Stakeholder Engagement",
    // Human-readable descriptions of each service area for the prompt.
    serviceAreaDetails: [
      "Service Design & Evaluation — user research, service blueprints, program evaluation",
      "Strategic Planning — co-created plans, collective visioning, implementation toolkits",
      "Community & Stakeholder Engagement — outreach campaigns, facilitation, consensus building",
      "Training & Capacity Building — human-centered design training, applied learning programs",
    ],
    // The frontend queries these direct-API functions first, then falls back
    // to the LLM web-search gap-fill. Vibemap has none (LLM-only).
    apiEndpoints: [
      "/.netlify/functions/fetch-grants-gov",
      "/.netlify/functions/fetch-ca-grants",
      "/.netlify/functions/fetch-sam-gov",
      "/.netlify/functions/fetch-usaspending",
      "/.netlify/functions/fetch-sbir",
      "/.netlify/functions/fetch-nsf",
    ],
    // Sources already covered by direct APIs — the LLM is told to skip them.
    excludeSources: ["grants.gov", "SAM.gov", "grants.ca.gov"],
    // Web-search sources for the LLM gap-fill.
    sources: [
      "caleprocure.ca.gov (California State Contracts Register)",
      "procurement.opengov.com (Bay Area counties and cities)",
      "hbex.coveredca.com/solicitations (Covered California)",
      "sf.gov/information/bid-opportunities (San Francisco OEWD)",
      "bart.gov/about/business/procurement (BART)",
      "ocwd.com/about/rfp-contracts (Orange County Water District)",
      "mwdoc.com/about-mwdoc/rfps-rfqs (Municipal Water District of Orange County)",
      "hacla.org/procurement (Housing Authority of City of Los Angeles)",
      "csuchico.edu/pcs/current-bids.shtml (Chico State)",
      "ucop.edu/for-suppliers (University of California System)",
      "foundationccc.org/CollegeBuys (California Community Colleges)",
      "Marin, San Mateo, Alameda, Santa Cruz, Sonoma, Solano, Orange County procurement pages",
      "San Jose, Oakland, Sacramento, Foster City, Coronado, Davis, Glendale city portals",
      "sgc.ca.gov (Strategic Growth Council)",
      "Foundation pages: calfund.org, calendow.org, sff.org",
    ],
    keywords: [
      "community engagement consultant RFP",
      "strategic planning consultant RFP",
      "human-centered design consulting RFP",
      "equity assessment consultant RFP",
      "workforce development RFP California",
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  // Vibemap — national tourism / destination-marketing (DMO) RFPs.
  // LLM web-search only; no California-specific direct APIs.
  // ──────────────────────────────────────────────────────────────────────
  vibemap: {
    id: "vibemap",
    label: "Vibemap",
    blurb: "National tourism, destination-marketing & place-branding RFPs",
    org: "Vibemap",
    role: "an RFP research assistant for Vibemap, a place-based discovery and destination-marketing technology company",
    systemPrompt:
      "You are an expert RFP researcher for a destination-marketing and place-technology company. After all web searches, output ONLY a valid JSON array — no markdown fences, no explanation. Start with [ and end with ].",
    geography: "the United States (national)",
    solicitationTypes: "RFPs, RFQs, and marketing/technology solicitations",
    serviceAreas: [
      "All service areas",
      "Destination Marketing & Tourism",
      "Place Branding & Activation",
      "Audience Data & Analytics",
      "Digital Experience & Content",
      "Events & Cultural Programming",
    ],
    defaultServiceArea: "Destination Marketing & Tourism",
    serviceAreaDetails: [
      "Destination Marketing & Tourism — DMO/CVB marketing strategy, tourism campaigns, visitor acquisition",
      "Place Branding & Activation — destination brand identity, neighborhood/district activation, placemaking",
      "Audience Data & Analytics — visitor data, location intelligence, audience insights, dashboards",
      "Digital Experience & Content — websites, interactive maps, mobile apps, content and storytelling",
      "Events & Cultural Programming — event marketing, cultural programming, experience design",
    ],
    apiEndpoints: [], // LLM web-search only
    excludeSources: [],
    sources: [
      "State tourism / travel office RFP pages (e.g. Visit California, Travel Oregon, Texas Tourism)",
      "Destination marketing organization (DMO) and convention & visitors bureau (CVB) procurement pages",
      "City and regional tourism / economic-development department RFP portals nationwide",
      "Business improvement district (BID) and Main Street program solicitations",
      "Chambers of commerce and visitor-center marketing RFPs",
      "bidnetdirect.com, demandstar.com, findrfp.com, rfpdb.com (filtered to tourism / marketing)",
      "Destinations International and state travel-association job/RFP boards",
      "Arts, culture, and parks-and-recreation agency placemaking solicitations",
    ],
    keywords: [
      "destination marketing RFP",
      "tourism marketing agency RFP",
      "DMO website redesign RFP",
      "visitor experience RFP",
      "wayfinding placemaking RFP",
      "place branding RFP",
      "tourism data analytics RFP",
      "CVB marketing services RFP",
    ],
  },
};

// Returns the allowed serviceArea values (chips minus the "All …" sentinel).
function realServiceAreas(profile) {
  return profile.serviceAreas.filter((s) => !/^all /i.test(s));
}

// Builds the full LLM discovery user-prompt for a profile.
// Centralized so the frontend and serverless function never diverge.
export function getDiscoveryPrompt(profileId) {
  const profile = PROFILES[profileId] || PROFILES[DEFAULT_PROFILE];
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const serviceAreaList = profile.serviceAreaDetails
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n");

  const excludeNote =
    profile.excludeSources && profile.excludeSources.length
      ? `\n\nIMPORTANT: Do NOT search ${profile.excludeSources.join(
          ", "
        )} — those are already covered by direct API queries.`
      : "";

  const allowedAreas = realServiceAreas(profile).join(" | ");

  return `Today is ${today}. You are ${profile.role}.

${profile.org}'s service areas:
${serviceAreaList}

Search focus: all service areas${excludeNote}

Search for current ${profile.geography} ${profile.solicitationTypes} on these sources:
${profile.sources.map((s) => `- ${s}`).join("\n")}

Use keywords: ${profile.keywords.map((k) => `"${k}"`).join(", ")}.

Return 20-30 best matches as a JSON array. Each object must have exactly:
{
  "id": "unique-slug",
  "title": "full title as listed",
  "agency": "issuing agency or organization",
  "url": "direct URL or null",
  "deadline": "deadline as listed or null",
  "description": "2-3 sentence scope summary",
  "relevanceScore": <integer 1-10>,
  "fitScore": <integer 1-10, how well this fits ${profile.org}>,
  "relevanceReason": "1-2 sentences on why this fits ${profile.org}",
  "serviceArea": "one of: ${allowedAreas}",
  "budget": "budget if stated or null",
  "postedDate": "date posted or null",
  "source": "portal or organization name"
}

ONLY the raw JSON array. No markdown fences, no explanation. Start with [ and end with ].`;
}
