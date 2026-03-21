// netlify/functions/discover.js
// Serverless function that proxies requests to the Anthropic API.
// ANTHROPIC_API_KEY is set in Netlify dashboard → Site configuration →
// Environment variables. It never touches the browser.

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured. Add it in Netlify → Site configuration → Environment variables." }),
    };
  }

  let prompt;
  try {
    ({ prompt } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON in request body." }) };
  }

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt in request body." }) };
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
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message }) };
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };

  } catch (err) {
    console.error("Anthropic proxy error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
