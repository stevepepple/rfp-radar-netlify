import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // In local dev, run `netlify dev` (not `npm run dev`) — Netlify's
    // dev server runs on port 8888 and proxies Vite + functions together.
    port: 5173,
  },
});
