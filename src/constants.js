export const STATUSES = ["New", "Reviewing", "Interested", "Bidding", "Submitted", "Won", "Passed", "Lost"];

export const STATUS_STYLE = {
  New:        { bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8" },
  Reviewing:  { bg: "#EFF6FF", fg: "#1D4ED8", dot: "#3B82F6" },
  Interested: { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
  Bidding:    { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" },
  Submitted:  { bg: "#F0F9FF", fg: "#075985", dot: "#0EA5E9" },
  Won:        { bg: "#F0FDF4", fg: "#14532D", dot: "#22C55E" },
  Passed:     { bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" },
  Lost:       { bg: "#FEF2F2", fg: "#991B1B", dot: "#EF4444" },
};

export const SERVICES = [
  "All service areas",
  "Service Design & Evaluation",
  "Strategic Planning",
  "Community & Stakeholder Engagement",
  "Training & Capacity Building",
];

export const SOURCES = [
  // ── Direct API sources (Federal) ──
  { name: "grants.gov",                    url: "https://www.grants.gov",                               tier: "Primary",      type: "Federal" },
  { name: "SAM.gov",                       url: "https://sam.gov",                                      tier: "Primary",      type: "Federal" },
  { name: "USAspending.gov",               url: "https://www.usaspending.gov",                          tier: "Primary",      type: "Federal" },
  { name: "SBIR.gov",                      url: "https://www.sbir.gov",                                 tier: "Primary",      type: "Federal" },
  { name: "NSF Awards",                    url: "https://www.nsf.gov/awardsearch/",                     tier: "Primary",      type: "Federal" },
  // ── Direct API sources (State) ──
  { name: "California Grants Portal",      url: "https://www.grants.ca.gov",                            tier: "Primary",      type: "State" },
  // ── State portals ──
  { name: "Cal eProcure / CSCR",          url: "https://caleprocure.ca.gov",                            tier: "Primary",      type: "State" },
  { name: "OpenGov Procurement",           url: "https://procurement.opengov.com",                      tier: "Primary",      type: "Local Gov" },
  { name: "PlanetBids",                    url: "https://pbsystem.planetbids.com",                      tier: "Primary",      type: "Local Gov" },
  // ── Transit & regional ──
  { name: "BART Procurement",             url: "https://www.bart.gov/about/business/procurement",       tier: "Watch",        type: "Transit" },
  { name: "ABAG / MTC",                    url: "https://mtc.ca.gov/about-mtc/careers-and-contracting", tier: "Watch",        type: "Regional" },
  { name: "LA Metro",                      url: "https://business.metro.net/ebidboard",                 tier: "Watch",        type: "Transit" },
  { name: "SFMTA",                         url: "https://www.sfmta.com/doing-business-with-sfmta",      tier: "Watch",        type: "Transit" },
  { name: "Caltrain / SamTrans",           url: "https://www.smctd.com",                                tier: "Watch",        type: "Transit" },
  { name: "VTA",                           url: "https://www.vta.org",                                  tier: "Watch",        type: "Transit" },
  { name: "SANDAG",                        url: "https://www.sandag.org",                               tier: "Watch",        type: "Transit" },
  { name: "Alameda CTC",                   url: "https://www.alamedactc.org",                           tier: "Watch",        type: "Transit" },
  // ── City portals ──
  { name: "SF OEWD Bid Opportunities",    url: "https://sf.gov/information/bid-opportunities",          tier: "Watch",        type: "City" },
  { name: "City of San Jose",              url: "https://www.sanjoseca.gov/doing-business/bids-purchasing", tier: "Watch",   type: "City" },
  { name: "City of Oakland",               url: "https://www.oaklandca.gov/topics/city-of-oakland-bids",tier: "Watch",        type: "City" },
  // ── County portals ──
  { name: "Marin County Contracting",      url: "https://www.marincounty.gov/contracting-opportunities",tier: "Watch",        type: "County" },
  { name: "San Mateo County",              url: "https://www.smcgov.org/ceo/request-proposals-rfp",     tier: "Watch",        type: "County" },
  { name: "Santa Clara County",            url: "https://www.sccgov.org",                               tier: "Watch",        type: "County" },
  { name: "Alameda County",                url: "https://www.acgov.org",                                tier: "Watch",        type: "County" },
  { name: "Contra Costa County",           url: "https://www.contracosta.ca.gov",                       tier: "Watch",        type: "County" },
  { name: "LA County",                     url: "https://lacounty.gov/government/opportunities/",       tier: "Watch",        type: "County" },
  { name: "San Diego County",              url: "https://www.sandiegocounty.gov",                       tier: "Watch",        type: "County" },
  { name: "Fresno County",                 url: "https://www.fresnocountyca.gov",                       tier: "Watch",        type: "County" },
  { name: "Orange County Procurement",     url: "https://cpo.oc.gov",                                   tier: "Watch",        type: "County" },
  { name: "Solano County",                 url: "https://www.solanocounty.gov",                         tier: "Watch",        type: "County" },
  // ── Special Districts ──
  { name: "Orange County Water District",  url: "https://www.ocwd.com/about/rfp-contracts/",            tier: "Watch",        type: "Special District" },
  { name: "MWDOC",                         url: "https://www.mwdoc.com/about-mwdoc/rfps-rfqs/",         tier: "Watch",        type: "Special District" },
  { name: "Clean Power Alliance",          url: "https://cleanpoweralliance.org/contracting-opportunities/", tier: "Watch",   type: "Special District" },
  // ── Housing authorities ──
  { name: "HACLA Open Solicitations",      url: "https://www.hacla.org/procurement",                    tier: "Watch",        type: "Housing Authority" },
  // ── State agencies ──
  { name: "Covered California",            url: "https://hbex.coveredca.com/solicitations/",            tier: "Watch",        type: "State Agency" },
  { name: "Strategic Growth Council",      url: "https://sgc.ca.gov",                                   tier: "Watch",        type: "State Agency" },
  // ── Additional City portals ──
  { name: "City of Berkeley",              url: "https://www.cityofberkeley.info",                      tier: "Watch",        type: "City" },
  { name: "City of Sacramento",            url: "https://www.cityofsacramento.org",                     tier: "Watch",        type: "City" },
  { name: "SF Dept of Public Health",      url: "https://www.sfdph.org",                                tier: "Watch",        type: "City" },
  { name: "City of Foster City",           url: "https://www.fostercity.org",                           tier: "Watch",        type: "City" },
  { name: "City of Coronado",              url: "https://www.coronado.ca.us",                           tier: "Watch",        type: "City" },
  { name: "City of Davis",                 url: "https://www.cityofdavis.org",                          tier: "Watch",        type: "City" },
  { name: "City of Glendale",              url: "https://www.glendaleca.gov",                           tier: "Watch",        type: "City" },
  // ── State agencies ──
  { name: "CalSAWS",                       url: "https://www.calsaws.org/procurement-listings/",        tier: "Watch",        type: "State Agency" },
  // ── Higher Ed ──
  { name: "Chico State Procurement",      url: "https://www.csuchico.edu/pcs/current-bids.shtml",      tier: "Watch",        type: "Higher Ed" },
  { name: "UC System (UCOP)",              url: "https://www.ucop.edu/for-suppliers",                   tier: "Watch",        type: "Higher Ed" },
  { name: "CollegeBuys (CCC)",             url: "https://foundationccc.org/CollegeBuys",                tier: "Watch",        type: "Higher Ed" },
  // ── Foundations ──
  { name: "California Community Foundation",url: "https://www.calfund.org/grants/",                    tier: "Supplement",   type: "Foundation" },
  { name: "The California Endowment",      url: "https://www.calendow.org",                             tier: "Supplement",   type: "Foundation" },
  { name: "San Francisco Foundation",      url: "https://sff.org",                                      tier: "Supplement",   type: "Foundation" },
  // ── Aggregators & networks ──
  { name: "BidNet Direct CA",              url: "https://www.bidnetdirect.com/california",              tier: "Supplement",   type: "Aggregator" },
  { name: "DemandStar",                    url: "https://www.demandstar.com/app/browse-bids/states/california", tier: "Supplement", type: "Aggregator" },
  { name: "HigherGov",                     url: "https://www.highergov.com",                            tier: "Supplement",   type: "Aggregator" },
  { name: "CA Workforce Association",      url: "https://www.calworkforce.org",                         tier: "Relationship", type: "Network" },
  { name: "ILG",                           url: "https://www.ca-ilg.org",                               tier: "Relationship", type: "Network" },
];

export const TIER_STYLE = {
  Primary:      { bg: "#d4eae6", fg: "#103b51" },
  Watch:        { bg: "#fde8ea", fg: "#c11948" },
  Supplement:   { bg: "#FEF3C7", fg: "#92400E" },
  Relationship: { bg: "#e8e4f0", fg: "#386a7c" },
};

export const STORAGE_KEYS = {
  results:  "cm_rfp_results_v2",
  pipeline: "cm_rfp_pipeline_v2",
  lastRun:  "cm_rfp_lastrun_v2",
};

export const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
