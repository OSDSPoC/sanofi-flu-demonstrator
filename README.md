# France Influenza Uptake Intelligence: Sanofi demonstrator (OpenSky)

A static, interactive demonstrator built for a Sanofi meeting with Public Affairs colleagues from France, Italy and Spain. France is the worked market and Efluelda, Sanofi's high-dose influenza vaccine, is the product anchor.

**Demonstrator · public and synthetic data.** Official coverage, IQVIA, Medic'AM and HAS material are real public data. Driver scores, enhanced/Efluelda shares, cluster assignments, activity logs and every 2026–27 follow-up value are synthetic. There is no live model, backend, database, map tiles or API key. The advisor gives prepared answers.

## Run it

```bash
npm install
npm run dev        # development server (http://localhost:5173)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm test           # unit tests (73)
npm run qa         # browser walkthrough with screenshots and PDFs (needs the app running; see below)
```

Requires Node 18+ (built and tested on Node 24).

## What is in the build

| Area | Where |
|---|---|
| State (mode, map view, context, checkpoint, plan draft, follow-up snapshot, transcript) | `src/state.tsx` |
| Metric formatting and calculations (single source for UI, advisor and print) | `src/lib/calc.ts` |
| Prepared answers, prompts per context, free-text intent matching | `src/lib/answers.ts` |
| Bundled data | `src/data/*.json`, adapters in `src/lib/data.ts`, `src/lib/history.ts` |
| Plan views (France, cluster, department) | `src/components/PlanViews.tsx`, `FranceMap.tsx` |
| Follow-up views (date strip, package card) and outcome tables | `src/components/Monitor.tsx`, `Outcome.tsx` |
| Advisor, drawers, print layouts | `Advisor.tsx`, `Drawers.tsx`, `PrintViews.tsx` |
| Cluster features, assignment and population (INSEE) | `docs/CLUSTER_RULES.md`, `src/lib/clustering.mjs`, `scripts/rebuild-clusters.mjs`, `scripts/build-population.mjs` |
| Local assets and their provenance | `src/assets/`, `src/assets/README.md` |
| Tests | `tests/` |

The raw MedicAM downloads and the internal reference screenshots from the handoff pack are not part of this project and are not shipped.

## Presenting it

The primary route is the presenter walkthrough: Reset demo, Where should we focus?, Explore Activation gap, the common-traits and shared-approach questions, Explore Seine-Saint-Denis, Where is the opportunity?, What can Public Affairs do?, Help us design an intervention, Add to plan, Review plan, Print plan / Save PDF, Start follow-up, +2 weeks, How is the plan progressing?, +6 weeks, How did the intervention perform?, What should the team do next?, Print outcome review. Rhône/Efluelda is an optional two-minute branch.

- **Reset demo** returns to France overview, Coverage map, no packages and no follow-up, and clears stored session data.
- The Monitor tab stays unavailable until follow-up has started (clicking it opens the plan).
- Typed questions match a small set of keyword intents for the current context; anything else gets a fixed fallback. Use the prepared prompts to control the route.
- Print opens the browser print dialog. Adding `?printpreview` to the URL shows the print layout on screen instead.

## Quality checks

`npm run qa` drives the whole walkthrough in headless Chrome (puppeteer-core, dev-only), checks that evidence and advisor are visible together at 1440×900, 1280×800 and 1920×1080, saves screenshots and the plan/outcome PDFs to `qa-output/`, and reports pass/fail. Start the app first (`npm run dev`, or serve `dist/`), then run `node scripts/qa-journey.mjs [url] [outDir]`.

See `docs/VALIDATION_REPORT.md` for what was tested, what was not, and what remains unresolved.

## Deploying to GitHub Pages

The build uses a **relative base** (`base: './'` in `vite.config.ts`) and has no history-router routes, so `dist/` works from any project sub-path without configuration.

`.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main`. In the repository, **Settings > Pages > Source** must be set to **GitHub Actions** (once).

Check a build under a nested path before publishing:

```bash
npm run build
node scripts/verify-subpath.mjs          # serves dist/ under /org-site/sanofi-flu-demonstrator/ and checks every asset
node scripts/verify-subpath.mjs --serve  # same, but keeps the server up for a browser check
```

## Honest limits

- Clusters are an authored grouping: each area goes to the nearest of four reference profiles on designed features. It is not fitted clustering. No fit statistics, feature importance or validation claims are made.
- Dispensing proxies are not official coverage or confirmed administration. Differences between participating and comparison catchments are signals for review, not causal effects. No revenue, margin or ROI is shown.
- HAS positions Efluelda and Fluad equivalently for adults aged 65+. Nothing here compares them clinically.
- Playbooks are OpenSky-authored examples, not Sanofi documents. The 2026–27 dates are scenario checkpoints.
