# Cluster assignment rules (authored content)

The four profiles are an **authored, rule-based grouping** with designed driver scores. They are not fitted clustering, and nothing here claims accuracy, feature importance or causal drivers. The rules exist so that every membership has an intelligible reason and so future revisions stay consistent.

Regenerate with `node scripts/rebuild-clusters.mjs`. The script is deterministic and idempotent. It reads only public coverage, the age profile and the synthetic eligible populations from `src/data/departments.json`, and rewrites the `illustrative` block of each department and `src/data/clusters.json`. Public values are never touched (a fingerprint test guards them).

## Assignment rule (applied in order, metropolitan departments)

| Order | Condition | Profile |
|---|---|---|
| 0 | The four featured departments keep their agreed profiles | 43 Access-constrained, 93 Activation gap, 69 Enhanced-vaccine adoption gap, 29 Strong delivery (the rule below gives the same result for each) |
| 1 | 65+ coverage ≥ 60.5% **and** age gap (75+ minus 65–74) ≤ 14.5 pp | Strong delivery |
| 2 | Coverage ≥ 56.5% (reasonable coverage, or high coverage with a wide age gap) | Enhanced-vaccine adoption gap |
| 3 | Coverage < 56.5% **and** the department is in the authored rural / low-density list | Access-constrained |
| 4 | Coverage < 56.5% otherwise | Activation gap |

The rural list (`RURAL` in the script) is authored from general knowledge of French geography, not from a dataset. Profiles are therefore not coverage bins: access and activation overlap in coverage (48.4–56.2% and 46.4–56.4%), and the age gap and area type decide between them.

Resulting membership: Access-constrained 31, Activation gap 21, Enhanced-vaccine adoption gap 29, Strong delivery 15 (96 metropolitan departments). Observed coverage ranges: 48.4–56.2%, 46.4–56.4%, 56.6–60.4% and 60.5–66.8%. No Strong-delivery member is below 60%.

## Driver profiles

Each department's five driver scores (access, provider engagement, public confidence, availability, recommendation; 0–100, higher means stronger enabling conditions) are an archetype plus a small deterministic offset (±6, hashed from the department code). Featured departments keep their agreed values exactly.

| Profile | Access | Engagement | Confidence | Availability | Recommendation | Enhanced share of 65+ dispensing |
|---|---|---|---|---|---|---|
| Access-constrained | 38 | 62 | 66 | 50 | 48 | 45% |
| Activation gap | 68 | 36 | 60 | 82 | 40 | 43% |
| Enhanced-vaccine adoption gap | 72 | 65 | 64 | 69 | 50 | 36% |
| Strong delivery | 82 | 78 | 76 | 90 | 80 | 56% |

The cluster driver template shown in the app is the rounded mean of its members. Expected coverage per department is the profile's mean observed coverage plus 1.5 pp, adjusted slightly by that department's driver offsets (featured departments fixed at 55.0, 54.0, 61.0 and 66.0). The observed-minus-expected figure is derived from it. Efluelda share of enhanced dispensing is 68% ± 5 for non-featured departments.

## What was not changed

Public coverage, age splits and history; the synthetic eligible populations; the intervention numbers; the P1/P3 checkpoints. Illustrative opportunity (population × (1 − coverage)) therefore does not change. Estimated populations and opportunity are displayed rounded to hundreds or thousands.

## Known limitation

The supplied synthetic eligible populations for non-featured departments are not realistic for some areas (for example a small rural department with a population in the tens of thousands of adults aged 65+ would be plausible, but the supplied figure is much larger). They only feed the Opportunity map and tooltips. Replace them with a sourced population dataset (for example INSEE) before any use beyond the demonstration.
