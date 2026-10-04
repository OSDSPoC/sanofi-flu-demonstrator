# Cluster assignment and Opportunity data (authored content)

Version 3 (final content fixes). This replaces the coverage-threshold rule of version 2.

The four profiles are an **authored, feature-based grouping**. The features are demonstration content; the grouping is not fitted clustering, and nothing here claims accuracy, feature importance or causal drivers.

## Pipeline

| Step | File | What it does |
|---|---|---|
| 1. Author features | `scripts/author-features.mjs` → `src/data/department_features.json` | Writes one synthetic feature vector per department from a fixed seed (20261004). Run once; the output is committed. |
| 2. Assign profiles | `src/lib/clustering.mjs` (used by `scripts/rebuild-clusters.mjs`) | Assigns each stored vector to the nearest reference profile. Reads **only** the five features. |
| 3. Rebuild outputs | `scripts/rebuild-clusters.mjs` | Writes the `illustrative` block of each department and `src/data/clusters.json` (profile templates, counts). Deterministic and idempotent. |
| 4. Population | `scripts/build-population.mjs` → `src/data/population_65plus.json` | INSEE 65+ populations (see below). |

## Features

Five features drive assignment, each on a 0–100 scale except the adoption share: **access**, **local availability**, **provider engagement**, **recommendation**, and **enhanced-category adoption** (enhanced vaccines as a % of observed 65+ flu dispensing). Public confidence is kept as context and is not used. Featured departments keep their agreed vectors exactly (Haute-Loire, Seine-Saint-Denis, Rhône, Finistère).

Vectors are generated from three latent factors (delivery → access and availability; engagement → engagement and recommendation; adoption → enhanced share), each N(0,1), plus independent noise. At **authoring time only**, each factor has a modest positive tilt towards observed coverage (0.5, 0.5 and 0.3), so favourable conditions tend, but are not guaranteed, to accompany higher coverage and the story stays plausible. The tilt is an authoring choice. The assignment function never sees coverage, and a test enforces this.

## Reference profiles and method

Distance is weighted Euclidean on features divided by a fixed scale (20 for the four indexes, 10 for the enhanced share). All weights are 1. The nearest reference profile wins; ties go to the earlier profile in the list below.

| Profile | Access | Availability | Engagement | Recommendation | Enhanced share |
|---|---|---|---|---|---|
| Access-constrained | 38 | 48 | 62 | 50 | 46 |
| Activation gap | 68 | 82 | 36 | 40 | 43 |
| Enhanced-vaccine adoption gap | 72 | 69 | 65 | 52 | 36 |
| Strong delivery | 82 | 90 | 78 | 80 | 56 |

The script stops with an error if a featured department would not be assigned its agreed profile. It does not override. All four featured vectors are assigned correctly by this method.

## Result

| Profile | Members | Coverage range (public, 2025–26) | Median |
|---|---|---|---|
| Access-constrained | 28 | 47.9–61.0% | 54.4% |
| Activation gap | 22 | 46.4–63.6% | 55.4% |
| Enhanced-vaccine adoption gap | 30 | 49.0–63.0% | 56.6% |
| Strong delivery | 16 | 55.4–66.8% | 60.5% |

There is no quota. Coverage ranges overlap substantially, including Enhanced and Strong. Public coverage is unchanged and is used only to check that the story reads sensibly.

### Similar coverage, different profiles

| Pair (same coverage) | Distinguishing features |
|---|---|
| Gironde 62.1% **Enhanced** vs Meurthe-et-Moselle 62.1% **Strong** | Enhanced share 25% vs 55%; access 69 vs 83 |
| Gironde 62.1% **Enhanced** vs Indre-et-Loire 62.2% **Strong** | Recommendation 78 vs 61 but enhanced share 25% vs 58% |
| Aube 55.4% **Enhanced** vs Tarn 55.4% **Strong** | Enhanced share 32% vs 57% |
| Sarthe 59.5% **Activation** vs Côte-d'Or 59.5% **Access** | Access 82 vs 53; engagement 44 vs 63 |
| Tarn-et-Garonne 54.3% **Activation** vs Drôme 54.3% **Access** | Access 74 vs 43; engagement 51 vs 77 |

### Exceptions, and how to explain them

Strong delivery means stronger enabling conditions, not high observed coverage. Where a Strong member has lower coverage (Tarn 55.4%, Gard 55.9%) the gap is a question to investigate, not a stated cause. Where an Access-constrained area has high coverage (Puy-de-Dôme 59.8%, Somme 61.0%) it is doing better than its delivery conditions suggest. The app shows a one-line note on any department whose observed coverage differs from its expected coverage by 5 pp or more. Six departments differ by more than 6 pp (Haute-Corse −9.6, Puy-de-Dôme +9.2, Seine-Saint-Denis −7.6 [featured], Loire-Atlantique +7.2, Vaucluse −6.9, Haut-Rhin −6.4).

## Expected coverage

A separate, precomputed demonstration output. Featured departments keep their agreed values (55.0, 54.0, 61.0 and 66.0). Others use a deterministic rule on the same five features:

`expected = 56.0 + 0.06·(access − 62) + 0.05·(availability − 68) + 0.06·(engagement − 56) + 0.07·(recommendation − 55) + 0.025·(enhanced − 44)`

Observed-minus-expected is derived from it. It is authored and unvalidated; Sources says so. It is not derived from the cluster's observed mean.

## Opportunity: population denominators

- **Source:** INSEE, *Estimation de la population au 1er janvier 2026*, table "par département, sexe et âge quinquennal" (<https://www.insee.fr/fr/statistiques/8721456>, file `estim-pop-dep-sexe-aq-1975-2026.xlsx`, early results to end 2025, updated 23 December 2025). Acquired 4 October 2026. SHA-256 of the file is stored in `population_65plus.json`.
- **Definition:** population aged 65+ = sum of the 65–69, 70–74, 75–79, 80–84, 85–89, 90–94 and 95+ bands, both sexes, age reached on 1 January 2026.
- **Geography:** INSEE department codes, joined on the string code (01 … 95, 2A, 2B). Rhône (69) is the whole department including the Métropole de Lyon.
- **Use:** `estimated unvaccinated adults aged 65+ = population 65+ × (1 − 2025–26 coverage)`, computed at full precision and displayed rounded. The map is labelled "Estimated unvaccinated adults aged 65+", with the population date and coverage season in the legend. It is an estimate of people not yet vaccinated, not a priority score. The metropolitan total is not compared with the France-wide coverage figure, and no national coverage is derived from it.
- **Checks:** every metropolitan department joins; 65+ is positive and below the department's total population (13.9% in Seine-Saint-Denis to about 33% in Creuse). Examples: Paris 391,472; Nord 508,286; Lozère 22,011; Creuse 37,513; Seine-Saint-Denis 242,985; Rhône 357,270; Finistère 247,163; Haute-Loire 61,917.
- **Unchanged:** the intervention catchment populations (P1 20,000, P2 40,000, P3 30,000), site counts and every checkpoint metric.
- The 65+ population is a population estimate, not an eligible or addressable population.
