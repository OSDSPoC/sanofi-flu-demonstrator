# Validation report

Build date 3 October 2026. This reports what was actually run. It is not a blanket "all tested".

## Where the deployable build is

`dist/` (run `npm run build`). It is a static site with a relative base: about 1.6 MB of JavaScript (380 kB gzipped, mostly bundled data and the boundary file), 23 kB CSS and the logo. Nothing has been deployed.

## Automated checks (all passing)

`npm test` runs 46 tests; `npm run build` type-checks first.

- **Source data:** national 56.7% (2024–25: 53.7%), gap 18.3 pp; featured values 43 = 50.7, 93 = 46.4, 69 = 59.3, 29 = 66.8; 96 metropolitan departments all join to the 96 boundary features by string code (including 01, 2A, 2B); 99 departments in total; four clusters; 270 prepared responses and every source ID in them resolves.
- **Numbers:** P1 +400/+300/+100, P2 +600/+450/+150, P3 +8/+5/+3 pp with Efluelda share flat at 70% at +6 weeks; P2 at +2 weeks both +160 (no separation); every checkpoint reconciles (level − baseline = change; treated − comparison = difference); P1 + P2 combined at +6 = +133.3 doses/10,000 (treated 533.3, comparison 400.0), equivalent to 800 dispensing-proxy doses; P3 never enters the dose combination.
- **Selection rules, all seven non-empty subsets of P1/P2/P3 at +2, +4 and +6 weeks, all six monitor prompts:** no unselected package's title, figure or decision appears; the Rhône brand finding (70%) never appears unless P3 is selected, otherwise the supplied no-brand-outcome fallback shows; the combined figure appears only when both P1 and P2 are selected.
- **Context rules:** Finistère never shows a treated result; a department with no selected package shows "No selected intervention in this area"; an ordinary department uses its own numerical summary plus an explicitly labelled cluster-level response and never another area's outcome.
- **State:** starting state; pending answers cancelled by any context change and never landing under another context; answers keep their original scope and date; repeated prompt focuses the existing answer; empty plan cannot start a simulation; printing leaves status and simulation unchanged; Draft → Ready → Simulation started → Reviewed; changing packages after starting keeps the snapshot until an explicit restart; Reset restores the starting state; unsupported free text returns the fixed fallback.
- **Coverage of prepared content:** every context × intent × checkpoint combination resolves to a prepared response.
- **Static delivery:** `scripts/verify-subpath.mjs` serves `dist/` under `/org-site/sanofi-flu-demonstrator/` and confirms every referenced asset returns 200 and the bundle has no root-absolute paths. Loaded in the browser from that sub-path: 96 department paths render, the logo loads, and **0 requests go outside the origin**. The built output contains no workstation paths, user names, keys or credentials.

## Manual checks in the browser pane (development server)

Done: full route (reset → cluster → featured department → advisor → sources → plan → three packages → start follow-up → +2 → +6 → advise → restart prompt → print preview); optional text input fallback and a supported question; Monitor tab without a simulation opens the plan; empty-plan buttons disabled; reset clears session storage; header, history, sources, model, status, plan and review drawers open without console errors.

Layout measured by script (page width, header height, clipped or off-screen elements) at **1280×800, 1440×900, 1920×1080, 820×900 and 390×800**: no horizontal page overflow at any size, header on one row from 1280 to 1920, advisor stacks beneath the evidence below 1280. Screenshots were inspected at 1280×800 and at the pane's own size.

Print layout inspected on screen with `?printpreview`: plan page 1 and 2 (about 239 mm and 248 mm of 273 mm available with three packages selected, so two A4 pages), outcome review at +6 weeks (about two pages).

## Not verified, please check before the meeting

- **The browser's real print dialog and PDF output were not exercised.** Pagination was checked through the on-screen preview of the same print layout, not a print engine. Cancelling print returning to the same state is covered by the state tests and the `afterprint` handler, not by watching the dialog. Do one real "Save as PDF" of each print view.
- **1440×900 and 1920×1080 were checked by measurement and partial screenshots only.** The pane could not show a full-size capture at those sizes, so please look at them once on the presentation display.
- **Keyboard and screen-reader use** were designed in (focus rings, button labels, skip link, ARIA labels, non-colour cluster cues) but not tested with a screen reader or a full keyboard pass. Contrast was set by hand, not measured.
- Browsers other than the one in the pane were not tried.

## Observations about the supplied data (not changed)

1. **"Strong delivery" is not uniformly strong on coverage.** Its members range 49.0–66.8% observed coverage; ten of its 26 members are below 55% (for example Haute-Corse 49.0%, Ardèche 52.1%, Var 53.1%). The card therefore shows a wide range beside "Strong delivery". This is consistent with clusters being designed from synthetic drivers rather than coverage, and is worth a sentence if asked, but a sharp audience may notice it.
2. **The Access-constrained profile averages availability 73/100**, while its definition says "lower local availability" and Haute-Loire (the featured member) scores 48. The profile reference marker on Haute-Loire's availability bar will therefore sit well above its own value. The text is accurate for Haute-Loire, not for the cluster.
3. One department's opportunity (Seine-Maritime, 53,034.5) differs by rounding convention from a recomputed value; the supplied value is used.
4. `validation_report.json` in the handoff covers the handoff data only; it was not reused as evidence for the site.

## Decisions taken where the brief left room

- The Monitor tab is unavailable until a simulation exists (clicking it opens the plan).
- Advisor answers for an ordinary department in Monitor mode show the "No selected intervention in this area" text rather than a cluster-level package outcome, to avoid showing another area's result.
- The combined P1 + P2 figure is computed from fixed target populations and added to France-level answers; it is not in the prepared text.
- Added a "Historical evidence" drawer (IQVIA cumulative 65+ dispensing and acts, kept separate; Medic'AM reimbursed packs by product family) and an "Intervention plan" header button so the plan is reachable at any time.
- Plan and outcome prints omit the trend charts to keep within two pages; the tables carry the same values as the screen.
- Session state is saved in `sessionStorage` only, under a versioned key, and removed whenever the app is back in its starting state.

## Assets still to confirm

- **Logo:** copied verbatim from the Sanofi corporate site header (source recorded in `src/assets/README.md`). Confirm you are comfortable with that source, or drop in a brand-approved file under the same name.
- **Boundaries:** `france-geojson` (IGN Admin Express 2018, Licence Ouverte per the repository README). Source, hash and attribution are recorded in `src/assets/README.md`.
