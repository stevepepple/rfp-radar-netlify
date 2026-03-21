# 📡 RFP Radar

Internal CivicMakers tool for discovering and tracking California RFPs, RFQs, and grant-funded consulting solicitations.

## What it does

- **AI-powered discovery** — searches 20+ California procurement portals and foundations using live web search via Claude
- **Relevance scoring** — each opportunity scored 1–10 with a rationale tied to CivicMakers' service areas
- **Pipeline tracker** — 8-stage pursuit pipeline (New → Reviewing → Interested → Bidding → Submitted → Won / Passed / Lost)
- **Manual entry** — add opportunities you find yourself
- **CSV export** — export the full pipeline for sharing
- **Persistent storage** — saved to localStorage; nothing lost on refresh

## Tech stack

- React + Vite (frontend)
- Netlify Functions (serverless API proxy — keeps the Anthropic key server-side)
- Claude Sonnet 4 + web search tool (discovery engine)
- localStorage (persistence)

---

## Local development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/rfp-radar.git
cd rfp-radar
npm install
```

### 2. Install the Netlify CLI

```bash
npm install -g netlify-cli
```

### 3. Add your API key

```bash
cp .env.example .env.local
# Edit .env.local and set:
# ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Start the dev server

```bash
netlify dev
```

Opens at **http://localhost:8888** — Netlify's dev server runs Vite and the serverless functions together, so `/.netlify/functions/discover` works locally exactly as it does in production.

> **Why `netlify dev` instead of `npm run dev`?**
> `npm run dev` runs Vite only — the function route doesn't exist and the discovery button will 404. `netlify dev` wires everything together.

---

## Deploy to Netlify

### Option A — Netlify dashboard (easiest)

1. Push the repo to GitHub
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
3. Select the GitHub repo — build settings are picked up from `netlify.toml` automatically
4. Click **Deploy site**

**Then add the API key:**

- Site → **Site configuration → Environment variables → Add a variable**
- Key: `ANTHROPIC_API_KEY` · Value: your Anthropic key
- Save — Netlify redeploys automatically

### Option B — Netlify CLI

```bash
netlify login
netlify init
netlify env:set ANTHROPIC_API_KEY sk-ant-...
netlify deploy --prod
```

### Subsequent deploys

Once the GitHub repo is linked, every push to `main` deploys automatically — no manual steps.

---

## Project structure

```
rfp-radar/
├── netlify/
│   └── functions/
│       └── discover.js    # Serverless function — Anthropic API proxy
├── src/
│   ├── App.jsx             # Main dashboard
│   ├── main.jsx            # React entry point
│   └── index.css           # Global reset
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
├── netlify.toml            # Build + functions config
├── .env.example
└── README.md
```

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Netlify dashboard → Environment variables | Your Anthropic API key. Never commit to git. |

For local dev, set in `.env.local` (already gitignored).

---

## Weekly workflow

1. Open the dashboard Friday morning
2. **Run Discovery** — optionally filter by service area first
3. Wait ~30 seconds for live results
4. Expand cards, read match rationales, click through to RFPs
5. **+ Add to Pipeline** on anything worth pursuing
6. In **Pipeline** tab, advance stages and add notes
7. **Export CSV** to share with the team

---

*CivicMakers internal tool — not for public distribution.*
