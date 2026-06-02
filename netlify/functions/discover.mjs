// netlify/functions/discover.mjs
// Serverless function that proxies requests to the Anthropic API.
// Uses streaming to keep the connection alive during long web_search calls.
// ANTHROPIC_API_KEY is set in Netlify dashboard → Site configuration →
// Environment variables. It never touches the browser.
// Results are also cached to Netlify Blobs for prefetch.

import { getStore } from "@netlify/blobs";
import { PROFILES, DEFAULT_PROFILE, getDiscoveryPrompt } from "../../src/profiles.js";

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

  let profileId = DEFAULT_PROFILE;
  let prompt;
  try {
    const body = await req.json();
    profileId = body.profileId || DEFAULT_PROFILE;
    // A caller may still pass an explicit prompt; otherwise build it from the
    // profile config so frontend and function never diverge (src/profiles.js).
    prompt = body.prompt || getDiscoveryPrompt(profileId);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON in request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profile = PROFILES[profileId] || PROFILES[DEFAULT_PROFILE];

  // Use a ReadableStream so data flows to the client continuously,
  // preventing the edge proxy from killing the connection for inactivity.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ type: "status", message: "Searching procurement portals…" });

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
            stream:     true,
            tools:      [{ type: "web_search_20250305", name: "web_search" }],
            system:     profile.systemPrompt,
            messages:   [{ role: "user", content: prompt }],
          }),
        });

        if (!anthropicRes.ok) {
          const errBody = await anthropicRes.text();
          send({ type: "error", message: `API error ${anthropicRes.status}: ${errBody}` });
          controller.close();
          return;
        }

        // Read the SSE stream from Anthropic, collect text blocks,
        // and forward periodic keep-alive pings to the client.
        const reader = anthropicRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let textParts = [];
        let lastPing = Date.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              // Collect text deltas
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                textParts.push(event.delta.text);
              }

              // Send periodic keep-alive pings (every 5s) to prevent timeout
              if (Date.now() - lastPing > 5000) {
                send({ type: "ping" });
                lastPing = Date.now();
              }
            } catch {
              // skip unparseable lines
            }
          }
        }

        const text = textParts.join("");

        // Cache results to Netlify Blobs for prefetch
        try {
          const store = getStore("rfp-cache");
          await store.setJSON("results", { results: text, cachedAt: new Date().toISOString() });
        } catch (blobErr) {
          console.error("Blob write error (non-fatal):", blobErr);
        }

        send({ type: "result", text });
        controller.close();

      } catch (err) {
        console.error("Anthropic proxy error:", err);
        send({ type: "error", message: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

export const config = {
  path: "/.netlify/functions/discover",
};
