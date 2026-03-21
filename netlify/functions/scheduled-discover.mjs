// netlify/functions/scheduled-discover.mjs
// Runs on a cron schedule to prefetch RFP discovery results.
// Stores results in Netlify Blobs so the client loads instantly.

import { getStore } from "@netlify/blobs";

export default async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured — skipping scheduled discovery");
    return;
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Focused prompt — fewer keywords than interactive discovery to fit 30s limit
  const prompt = `Today is ${today}. You are an RFP research assistant for CivicMakers, a California public sector design consultancy.

CivicMakers' four service areas:
1. Service Design & Evaluation — user research, service blueprints, program evaluation
2. Strategic Planning — co-created plans, collective visioning, implementation toolkits
3. Community & Stakeholder Engagement — outreach campaigns, facilitation, consensus building
4. Training & Capacity Building — human-centered design training, applied learning programs

Search for current California RFPs, RFQs, and consulting solicitations open or closing soon. Check:
- caleprocure.ca.gov
- procurement.opengov.com
- www.grants.ca.gov
- County and city procurement portals in the Bay Area

Use keywords: "community engagement consultant RFP California", "strategic planning consultant RFP California", "human-centered design consulting RFP".

Return 8–10 best matches as a JSON array. Each object must have exactly:
{
  "id": "unique-slug",
  "title": "full title as listed",
  "agency": "issuing agency",
  "url": "direct URL or null",
  "deadline": "deadline as listed or null",
  "description": "2-3 sentence scope summary",
  "relevanceScore": <integer 1-10>,
  "relevanceReason": "1-2 sentences on why this fits CivicMakers specifically",
  "serviceArea": "Service Design & Evaluation | Strategic Planning | Community & Stakeholder Engagement | Training & Capacity Building",
  "budget": "budget if stated or null",
  "postedDate": "date posted or null",
  "source": "portal name"
}

FINAL output: ONLY the raw JSON array. No markdown fences, no explanation. Start with [ and end with ].`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools:      [{ type: "web_search_20250305", name: "web_search" }],
        system:     "You are an expert RFP researcher for a California public sector consultancy. After all web searches, output ONLY a valid JSON array — no markdown fences, no explanation. Start with [ and end with ].",
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    const data = await anthropicRes.json();

    if (data.error) {
      console.error("Anthropic API error:", data.error.message);
      return;
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    const store = getStore("rfp-cache");
    await store.setJSON("results", { results: text, cachedAt: new Date().toISOString() });

    console.log("Scheduled discovery complete — results cached to Blobs");
  } catch (err) {
    console.error("Scheduled discovery error:", err);
  }
};

export const config = {
  schedule: "0 16 * * 1-5",  // Weekdays at 4pm UTC (8am PST / 9am PDT)
};
