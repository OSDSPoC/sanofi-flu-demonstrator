# France Influenza Uptake Intelligence: Sanofi demonstrator

A static, interactive demonstrator built for a Sanofi meeting with Public Affairs colleagues from France, Italy and Spain. France is the worked market and Efluelda, Sanofi's high-dose influenza vaccine, is the product anchor.

**Status: demonstrator, public + synthetic data.** Official coverage, IQVIA, Medic'AM and HAS material are real public data. Populations, driver indexes, enhanced/Efluelda shares, cluster membership, activity logs and every 2026–27 monitoring value are synthetic. There is no live model, backend, database, map tiles or API key. The advisor shows prepared responses.

## Run it

```bash
npm install
npm run dev        # development server (http://localhost:5173)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm test           # unit tests (46)
```

Requires Node 18+ (built and tested on Node 24).

## What is in the build

| Area | Where |
|---|---|
| State contract (mode, map view, context, checkpoint, plan draft, simulation snapshot, transcript) | `src/state.tsx` |
| Metric formatting and calculations (single source for UI, advisor and print) | `src/lib/calc.ts` |
| Prepared-response selection, scoping rules, free-text intent matching | `src/lib/advisor.ts` |
| Bundled data adapters | `src/lib/data.ts`, `src/lib/history.ts`, `src/data/*.json` |
| Map (d3-geo, local GeoJSON) | `src/components/FranceMap.tsx`, `MapPanel.tsx` |
| Evidence, outcome review, drawers, print layouts | `EvidencePanel.tsx`, `Outcome.tsx`, `Drawers.tsx`, `PrintViews.tsx` |
| Local assets and their provenance | `src/assets/` and `src/assets/README.md` |
| Tests | `tests/` |

The content and numbers come from the handoff pack (`data/*.json`, copied unchanged into `src/data/`). The raw MedicAM zips and the internal reference screenshots are **not** part of this project and are not shipped.

## Presenting it

1. Opens on **Plan** / France overview / Clusters with no packages selected. **Reset demo** (header) returns to exactly this state and clears stored session data.
2. Route: Activation gap cluster, then Seine-Saint-Denis, advisor prompts, **Sources**, "Help us design an intervention", add P2 (then P1, P3 in **Intervention plan**), **Print plan / Save PDF**, **Start simulated follow-up**, +2 weeks, +6 weeks, "How did the package perform?", "What should the team change?", **Print outcome review**.
3. The Monitor tab stays unavailable until a simulation has started (clicking it opens the plan).
4. Free-text questions match a small set of deterministic keyword intents. Anything else returns the fixed fallback message.

Print opens the browser print dialog. Adding `?printpreview` to the URL shows the print layout on screen instead, which is useful for checking pagination.

## Deploying to GitHub Pages

The build uses a **relative base** (`base: './'` in `vite.config.ts`) and has no history-router routes, so `dist/` works from any project sub-path (for example `https://<org>.github.io/<repo>/`) without configuration.

Manual route:

1. `npm run build`
2. Publish the contents of `dist/` to the branch/folder GitHub Pages serves (for example the `gh-pages` branch root).
3. In the repository settings, set Pages to serve that branch/folder.

Workflow route (active): `.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main`. In the repository, set **Settings > Pages > Source** to **GitHub Actions** once.

Check a build under a nested path before publishing:

```bash
npm run build
node scripts/verify-subpath.mjs          # serves dist/ under /org-site/sanofi-flu-demonstrator/ and checks every asset
node scripts/verify-subpath.mjs --serve  # same, but keeps the server up for a browser check
```

If you ever need a fixed absolute base instead, set `base: '/<repo>/'` in `vite.config.ts`.

## Honest limits

- Cluster assignments, expected coverage and driver indexes are designed, precomputed examples. No fit statistics, feature importance or validation claims are made or implied.
- Dispensing proxies are not official coverage or confirmed administration. Differences between treated and comparison catchments are descriptive signals, not causal effects. No revenue, margin or ROI is shown.
- HAS positions Efluelda and Fluad equivalently for adults aged 65+. Nothing here compares them clinically.
- Illustrative playbooks are OpenSky-authored examples, not Sanofi documents. The monitoring dates are fictional scenario checkpoints.

See `docs/VALIDATION_REPORT.md` for what was tested, what was not, and observations about the supplied data.
