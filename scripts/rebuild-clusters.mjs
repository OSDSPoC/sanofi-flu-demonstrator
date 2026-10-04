// Assigns profiles and rebuilds the dependent synthetic outputs. Deterministic and idempotent.
//
// Inputs : src/data/department_features.json (fixed synthetic feature table), src/lib/clustering.mjs (reference profiles and
//          distance method), src/data/departments.json (public coverage, INSEE 65+ population).
// Outputs: the `illustrative` block of each department and src/data/clusters.json.
//
// Assignment reads ONLY the feature vector. Coverage is read afterwards, to compute observed-minus-expected and the opportunity.
// Rules and rationale: docs/CLUSTER_RULES.md. Run: node scripts/rebuild-clusters.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, FEATURE_SCALE, FEATURE_WEIGHT, REFERENCE_PROFILES, assignProfile } from '../src/lib/clustering.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depFile = path.join(root, 'src/data/departments.json');
const clFile = path.join(root, 'src/data/clusters.json');
const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
const clusters = JSON.parse(fs.readFileSync(clFile, 'utf8'));
const table = JSON.parse(fs.readFileSync(path.join(root, 'src/data/department_features.json'), 'utf8')).features;

// Agreed featured profiles and expectations (supplied in the handoff pack). The assignment below must reproduce the profiles.
const FEATURED = {
  '43': { profile: 'access', expected: 55.0 },
  '93': { profile: 'activation', expected: 54.0 },
  '69': { profile: 'enhanced', expected: 61.0 },
  '29': { profile: 'strong', expected: 66.0 },
};
const r1 = (v) => Math.round(v * 10) / 10;

// Expected coverage for non-featured areas: a documented deterministic rule on enabling features (authored, unvalidated).
const EXPECTED_RULE = {
  base: 56.0,
  centre: { access: 62, availability: 68, engagement: 56, recommendation: 55, enhanced_adoption: 44 },
  weight: { access: 0.06, availability: 0.05, engagement: 0.06, recommendation: 0.07, enhanced_adoption: 0.025 },
};
const expectedFromFeatures = (f) =>
  r1(EXPECTED_RULE.base + FEATURES.reduce((s, k) => s + EXPECTED_RULE.weight[k] * (f[k] - EXPECTED_RULE.centre[k]), 0));

for (const d of dep.departments) {
  const f = table[d.code];
  if (!f) throw new Error(`no feature vector for ${d.code}`);
  const profile = assignProfile(f); // features only
  const fixed = FEATURED[d.code];
  if (fixed && fixed.profile !== profile) throw new Error(`featured ${d.code} would be assigned ${profile}, expected ${fixed.profile}; adjust the reference profiles, do not override`);
  const i = d.illustrative;
  i.cluster_id = profile;
  i.driver_indexes = {
    access_index: f.access,
    hcp_engagement_index: f.engagement,
    confidence_index: f.confidence,
    availability_index: f.availability,
    recommendation_index: f.recommendation,
  };
  i.enhanced_share_of_65plus_dispensing_pct = f.enhanced_adoption;
  i.efluelda_share_of_enhanced_dispensing_pct = f.efluelda_share;
  i.expected_vcr_65plus = fixed ? fixed.expected : expectedFromFeatures(f);
  i.observed_minus_expected_pp = d.historical.vcr_65plus == null ? null : r1(d.historical.vcr_65plus - i.expected_vcr_65plus);
}

/* ---------- cluster definitions ---------- */
const COPY = {
  access: {
    name: 'Access-constrained',
    description: 'Weaker access and delivery conditions; provider engagement need not be weak.',
    defining_features: ['Lower access and availability indexes', 'Engagement and recommendation closer to average'],
    potentially_influenceable: ['Appointment information', 'Delivery coordination', 'Availability review'],
    context: ['Travel and local delivery conditions', 'Age mix of the 65+ population'],
    interpretation: 'Check delivery conditions before assuming reluctance to vaccinate.',
    shared_approach: [
      'Coordinate delivery capacity and appointment information with local providers',
      'Review pharmacy availability and travel barriers',
      'Use existing local channels to communicate where and when to vaccinate',
    ],
    common_pattern: 'Access and availability are the weakest enabling conditions; engagement and recommendation are closer to average.',
    featured_department: '43',
    default_package: 'P1',
  },
  activation: {
    name: 'Activation gap',
    description: 'Stronger access and availability, with weaker provider engagement and proactive recommendation.',
    defining_features: ['Stronger access and availability', 'Lower provider engagement', 'Lower recommendation index'],
    potentially_influenceable: ['Proactive recommendation', 'Trusted community information', 'Provider-managed reminders'],
    context: ['Population density and diversity', 'Previous uptake'],
    interpretation: 'Access alone may not explain the gap; look at recommendation, relevance and follow-through.',
    shared_approach: [
      'Brief providers on proactive recommendation to eligible adults',
      'Share clear information through existing community partners',
      'Support provider-managed reminders and follow-through',
    ],
    common_pattern: 'Access and availability are relatively strong, while provider engagement and recommendation are weak.',
    featured_department: '93',
    default_package: 'P2',
  },
  enhanced: {
    name: 'Enhanced-vaccine adoption gap',
    description: 'Reasonable delivery conditions, with lower adoption of enhanced vaccines among adults aged 65+.',
    defining_features: ['Reasonable access and engagement', 'Lower enhanced-vaccine share of dispensing', 'Recommendation implementation uncertain'],
    potentially_influenceable: ['Recommendation education', 'Pathway clarity', 'Product availability review'],
    context: ['Age mix of the 65+ population', 'Established channel patterns'],
    interpretation: 'Separate implementation of the category recommendation from Efluelda brand performance.',
    shared_approach: [
      'Implement the 65+ recommendation: brief teams on the equivalent HAS positioning of Efluelda and Fluad',
      'Review the local pathway and availability of recommended options',
      'Record what prevents consistent implementation; Commercial reviews brand questions separately',
    ],
    common_pattern: 'Delivery conditions are reasonable and recommendation is mixed, while the enhanced-vaccine share of dispensing is the lowest of the four profiles.',
    featured_department: '69',
    default_package: 'P3',
  },
  strong: {
    name: 'Strong delivery',
    description: 'Stronger delivery and engagement enabling conditions. Observed coverage varies, so remaining gaps are questions to investigate.',
    defining_features: ['Stronger access and availability', 'Stronger engagement and recommendation', 'Higher enhanced-vaccine share'],
    potentially_influenceable: ['Sharing delivery practices', 'Remaining cohort follow-through'],
    context: ['Existing infrastructure', 'Historical uptake'],
    interpretation: 'Maintain execution, investigate remaining cohort gaps and share useful practices, checking whether they transfer to other conditions.',
    shared_approach: [
      'Maintain execution and document the delivery practices that are working',
      'Investigate remaining cohort gaps with local partners',
      'Test whether useful practices transfer to areas with different conditions',
    ],
    common_pattern: 'Access, availability, engagement and recommendation are all favourable.',
    featured_department: '29',
    default_package: null,
  },
};

const metro = dep.departments.filter((d) => d.metropolitan);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const DRIVER_KEYS = ['access_index', 'hcp_engagement_index', 'confidence_index', 'availability_index', 'recommendation_index'];
clusters.assignment_method =
  'Nearest reference profile by weighted Euclidean distance on five synthetic features (access, availability, engagement, recommendation, enhanced-vaccine share). Authored demonstration content, not fitted clustering. See docs/CLUSTER_RULES.md.';
clusters.driver_scale = '0–100 index; higher means stronger enabling conditions';
clusters.reference_profiles = REFERENCE_PROFILES;
clusters.feature_scale = FEATURE_SCALE;
clusters.feature_weight = FEATURE_WEIGHT;
clusters.expected_coverage_rule = EXPECTED_RULE;
for (const c of clusters.clusters) {
  const members = metro.filter((d) => d.illustrative.cluster_id === c.id);
  Object.assign(c, COPY[c.id]);
  c.driver_template = DRIVER_KEYS.map((k) => Math.round(mean(members.map((d) => d.illustrative.driver_indexes[k]))));
  c.expected_vcr = r1(mean(members.map((d) => d.illustrative.expected_vcr_65plus)));
  c.member_count = members.length;
  c.reference_profile = REFERENCE_PROFILES[c.id];
}

fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + '\n');
fs.writeFileSync(clFile, JSON.stringify(clusters, null, 2) + '\n');

for (const c of clusters.clusters) {
  const m = metro.filter((d) => d.illustrative.cluster_id === c.id);
  const v = m.map((d) => d.historical.vcr_65plus);
  console.log(`${c.id.padEnd(10)} n=${String(m.length).padStart(2)}  coverage ${Math.min(...v)}–${Math.max(...v)} (mean ${mean(v).toFixed(1)})  template ${c.driver_template.join(',')}`);
}
