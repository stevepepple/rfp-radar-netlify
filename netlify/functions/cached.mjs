// netlify/functions/cached.mjs
// Returns prefetched discovery results from Netlify Blobs.
// Sub-100ms response — no Anthropic API call.

import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const store = getStore("rfp-cache");
    const cached = await store.get("results", { type: "json" });

    if (!cached) {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Blob read error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/cached",
};
