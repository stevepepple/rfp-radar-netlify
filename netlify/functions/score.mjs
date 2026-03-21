// netlify/functions/score.mjs
// Takes raw API-fetched opportunities and uses Claude to score them
// for CivicMakers relevance. No web_search — fast (~5s), cheap.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let opportunities;
  try {
    ({ opportunities } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!opportunities || !opportunities.length) {
    return new Response(JSON.stringify({ scored: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build a compact summary for Claude to score
  const summaries = opportunities.map((o, i) => (
    `[${i}] "${o.title}" — ${o.agency} — ${o.description?.slice(0, 150) || "No description"}`
  )).join("\n");

  const prompt = `You are scoring RFP/grant opportunities for CivicMakers, a California public sector design consultancy.

CivicMakers' four service areas:
1. Service Design & Evaluation — user research, service blueprints, program evaluation
2. Strategic Planning — co-created plans, collective visioning, implementation toolkits
3. Community & Stakeholder Engagement — outreach campaigns, facilitation, consensus building
4. Training & Capacity Building — human-centered design training, applied learning programs

Score each opportunity below. For each, provide:
- relevanceScore: integer 1-10 (10 = perfect fit)
- relevanceReason: 1 sentence on why this fits or doesn't fit CivicMakers
- serviceArea: which of the 4 service areas is the best match

Opportunities:
${summaries}

Return a JSON array with one object per opportunity, in order:
[{"index": 0, "relevanceScore": 7, "relevanceReason": "...", "serviceArea": "..."}, ...]

ONLY output the JSON array. No markdown, no explanation.`;

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
        max_tokens: 2000,
        // No tools — no web_search. Fast and cheap.
        system:     "You are a scoring assistant. Output ONLY valid JSON arrays. No markdown fences.",
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    const data = await anthropicRes.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message, scored: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Parse scores and merge back into opportunities
    let scores;
    try {
      const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      scores = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch {
      // If parsing fails, return opportunities unscored
      return new Response(JSON.stringify({ scored: opportunities }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const scored = opportunities.map((opp, i) => {
      const score = scores.find(s => s.index === i) || {};
      return {
        ...opp,
        relevanceScore: score.relevanceScore ?? 5,
        relevanceReason: score.relevanceReason ?? "Score pending",
        serviceArea: score.serviceArea ?? "Community & Stakeholder Engagement",
      };
    });

    return new Response(JSON.stringify({ scored }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Scoring error:", err);
    return new Response(JSON.stringify({ error: err.message, scored: opportunities }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/score",
};
