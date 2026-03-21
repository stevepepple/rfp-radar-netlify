# Proposed Improvements & Observations

This document outlines the observations made regarding the current state of **RFP Radar**, the code improvements applied, and the strategic ideas to make the platform robust and comprehensive.

## 1. Code Architecture & Maintainability (Applied)
**Observation:** The entire React application, including constants, utility functions, and complex components, was housed within a single ~47KB `App.jsx` file. Inline styles were heavily used, making future maintenance difficult.
**Improvement:** 
- `App.jsx` has been refactored. The constants, utility functions, and UI components (`DiscoverCard`, `PipelineCard`, `ManualEntryModal`, `SourcesTab`, `Chip`, `Score`, `StatCard`) have been extracted into `src/constants.js`, `src/utils.js`, and a `src/components/` directory.
- *Note: As requested, the inline styling approach was preserved for these components, as the current priority is functionality over design aesthetics.*

## 2. Data Loss on Refresh Bug (Applied)
**Observation:** Users reported that "data changes each time I load, with previous sources being lost". 
**Root Cause:** The `localStorage` mechanism silently fails if the size of the saved string exceeds the browser's 5MB limit. Because the application was appending new RFPs on every 4-hour discovery cycle without a size cap, the quotas were being hit, causing updates to be dropped. Upon a hard refresh, the app would fail to load corrupted or missing cache and restart with a tiny subset of recent fetches.
**Improvement:** 
- The deduplication and merging logic in `App.jsx` was updated to cap the `results` list to the most recent 200 items. This prevents the `localStorage` from overflowing while preserving historical stability.

## 3. Data Collection Quantity & Reliability (Proposed)
**Observation:** Users reported "only a handful of grants from a couple of sources."
**Root Cause:** 
- *LLM Restrictions:* The current discovery engine (`netlify/functions/discover.mjs`) instructs Claude via a system prompt to "Return 6–8 best matches as a JSON array", artificially limiting the output.
- *Nondeterministic Search:* Relying on Claude 3.5 Sonnet's implicit web search tool is powerful but nondeterministic. It might arbitrarily skip sources or timeout before hitting all specified portals.
**Improvement Ideas:**
- **Quick Fix (Applied):** Increase the requested count in the prompt from 6-8 matches to 20-30 matches.
- **Robust Solution (Crawl4AI):** Implement `crawl4AI` (a python-based deterministic scraper) to explicitly crawl the 20+ required California procurement portals. This will ensure 100% reliable coverage and prevent arbitrary skips. The Netlify scheduled function (`scheduled-discover.mjs`) can be pointed to invoke this external python worker, returning the raw dataset, which can then be scored by Claude.

## 4. UI/UX Design Token System (Proposed)
**Observation:** Managing inline styles across multiple components scales poorly and limits stylistic enhancements like Dark Mode or animations.
**Improvement Idea:** Migrate to a Vanilla CSS (`index.css`) system with CSS variables (design tokens). This would allow for a highly polished, premium UI with smooth micro-animations and responsive breakpoints without cluttering the component logic.

## 5. Additional Features (Proposed)
**Observation:** The pipeline and discover tabs can get unwieldy.
**Improvement Idea:** Implement a simple text-based Search/Filter bar to actively filter the cached results by "Title" or "Agency".
