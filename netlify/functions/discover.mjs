// netlify/functions/discover.mjs
// Serverless function that proxies requests to the Anthropic API.
// Uses Netlify's streaming response to avoid gateway timeouts during
// long-running web_search calls (30-40s).
// ANTHROPIC_API_KEY is set in Netlify dashboard → Site configuration →
// Environment variables. It never touches the browser.

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured. Add it in Netlify → Site configuration → Environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let prompt;
  try {
    ({ prompt } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON in request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt in request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Anthropic proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/discover",
};
