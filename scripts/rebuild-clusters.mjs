// Rebuilds the authored (synthetic) cluster layer. Deterministic and idempotent.
// Reads public values (coverage, age split) and the synthetic eligible populations from src/data/departments.json,
// and rewrites ONLY the `illustrative` block plus src/data/clusters.json.
// Rules and rationale: docs/CLUSTER_RULES.md. Run: node scripts/rebuild-clusters.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depFile = path.join(root, 'src/data/departments.json');
const clFile = path.join(root, 'src/data/clusters.json');
const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
const clusters = JSON.parse(fs.readFileSync(clFile, 'utf8'));

/* ---------- authored inputs ---------- */

// Lower-density, more rural departments (travel distance and thinner provider networks are plausible barriers).
// Authored from general knowledge of French geography; not taken from a dataset.
const RURAL = new Set(
  ['02', '03', '04', '05', '07', '08', '09', '10', '12', '15', '16', '18', '19', '2A', '2B', '23', '24', '32', '36', '39', '43', '46', '47', '48', '52', '53', '55', '58', '61', '65', '70', '82', '88', '89', '40', '81', '26'],
);

// The four featured departments keep their agreed values exactly (as supplied in the handoff).
const FIXED = {
  '43': { cluster: 'access', drivers: [35, 62, 67, 48, 45], expected: 55.0, enh: 44, ef: 69 },
  '93': { cluster: 'activation', drivers: [66, 34, 62, 86, 40], expected: 54.0, enh: 43, ef: 66 },
  '69': { cluster: 'enhanced', drivers: [73, 66, 62, 69, 49], expected: 61.0, enh: 40, ef: 70 },
  '29': { cluster: 'strong', drivers: [83, 81, 73, 90, 82], expected: 66.0, enh: 65, ef: 71 },
};
const DRIVER_KEYS = ['access_index', 'hcp_engagement_index', 'confidence_index', 'availability_index', 'recommendation_index'];

// Archetype driver means: access, provider engagement, confidence, availability, recommendation.
const ARCH = {
  access: { drivers: [38, 62, 66, 50, 48], enh: 45 },
  activation: { drivers: [68, 36, 60, 82, 40], enh: 43 },
  enhanced: { drivers: [72, 65, 64, 69, 50], enh: 36 },
  strong: { drivers: [82, 78, 76, 90, 80], enh: 56 },
};

/* ---------- assignment rule (ordered) ---------- */
// 1. Strong delivery: coverage >= 60.5% and a balanced age profile (75+ minus 65-74 gap <= 14.5 pp).
// 2. Enhanced-vaccine adoption gap: reasonable coverage (56.5% to <60.5%), or high coverage with a wide age gap
//    (younger cohort lagging, so adoption is uneven).
// 3. Below 56.5%: rural / low-density -> Access-constrained; otherwise -> Activation gap.
function assign(d) {
  const v = d.historical.vcr_65plus;
  const gap = d.historical.vcr_75plus - d.historical.vcr_65_74;
  if (v >= 60.5 && gap <= 14.5) return 'strong';
  if (v >= 56.5) return 'enhanced';
  return RURAL.has(d.code) ? 'access' : 'activation';
}

function h(code, salt) {
  let x = 2166136261;
  for (const c of `${code}|${salt}`) {
    x ^= c.charCodeAt(0);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return (x % 10000) / 10000; // 0..1
}
const noise = (code, salt, amp) => Math.round((h(code, salt) * 2 - 1) * amp);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

/* ---------- pass 1: membership ---------- */
const metro = dep.departments.filter((d) => d.metropolitan);
for (const d of metro) {
  const f = FIXED[d.code];
  d.illustrative.cluster_id = f ? f.cluster : assign(d);
}
for (const [code, f] of Object.entries(FIXED)) {
  const d = metro.find((x) => x.code === code);
  if (assign(d) !== f.cluster) console.log(`note: featured ${code} assigned by agreement (${f.cluster}); rule would give ${assign(d)}`);
}

// Overseas records: kept out of the profile model. Assign by the same rule so they remain valid records.
for (const d of dep.departments.filter((x) => !x.metropolitan)) d.illustrative.cluster_id = assign(d);

/* ---------- pass 2: drivers, shares, expected coverage ---------- */
const meanV = {};
for (const id of Object.keys(ARCH)) {
  const m = metro.filter((d) => d.illustrative.cluster_id === id);
  meanV[id] = m.reduce((s, d) => s + d.historical.vcr_65plus, 0) / m.length;
}
for (const d of dep.departments) {
  const id = d.illustrative.cluster_id;
  const f = FIXED[d.code];
  const a = ARCH[id];
  const drivers = f ? f.drivers : a.drivers.map((base, k) => clamp(base + noise(d.code, `drv${k}`, 6), 8, 97));
  const delta = drivers.reduce((s, v, k) => s + (v - a.drivers[k]), 0) / drivers.length;
  const expected = f ? f.expected : r1(meanV[id] + 1.5 + 0.3 * delta);
  const enh = f ? f.enh : clamp(a.enh + noise(d.code, 'enh', 4), 25, 70);
  const ef = f ? f.ef : clamp(68 + noise(d.code, 'ef', 5), 58, 78);
  const i = d.illustrative;
  DRIVER_KEYS.forEach((key, k) => (i.driver_indexes[key] = drivers[k]));
  i.expected_vcr_65plus = expected;
  i.observed_minus_expected_pp = d.historical.vcr_65plus == null ? null : r1(d.historical.vcr_65plus - expected);
  i.enhanced_share_of_65plus_dispensing_pct = enh;
  i.efluelda_share_of_enhanced_dispensing_pct = ef;
  i.unvaccinated_opportunity =
    d.historical.vcr_65plus == null ? null : Math.round(i.eligible_population_65plus * (1 - d.historical.vcr_65plus / 100));
}

/* ---------- cluster definitions ---------- */
const COPY = {
  access: {
    name: 'Access-constrained',
    description: 'Weaker access and availability conditions, often in lower-density areas, with provider engagement close to average.',
    defining_features: ['Lower access and availability indexes', 'Provider engagement close to average', 'Coverage below the national level'],
    potentially_influenceable: ['Appointment information', 'Delivery coordination', 'Availability review'],
    context: ['Rurality and travel conditions', 'Age mix of the 65+ population'],
    interpretation: 'Check delivery conditions before assuming reluctance to vaccinate.',
    shared_approach: [
      'Confirm delivery capacity and appointment information with local providers',
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
    description: 'Reasonable coverage and delivery conditions, with lower adoption of enhanced vaccines among adults aged 65+.',
    defining_features: ['Reasonable overall coverage', 'Lower enhanced-vaccine share of dispensing', 'Recommendation implementation uncertain'],
    potentially_influenceable: ['Recommendation education', 'Pathway clarity', 'Product availability review'],
    context: ['Age mix of the 65+ population', 'Established channel patterns'],
    interpretation: 'Separate implementation of the category recommendation from Efluelda brand performance.',
    shared_approach: [
      'Brief teams on the equivalent HAS positioning of Efluelda and Fluad',
      'Review the local pathway and availability of recommended options',
      'Record what prevents consistent implementation; Commercial reviews brand questions separately',
    ],
    common_pattern: 'Access and engagement are reasonable, but recommendation is mixed and the enhanced-vaccine share of dispensing is the lowest of the four profiles.',
    featured_department: '69',
    default_package: 'P3',
  },
  strong: {
    name: 'Strong delivery',
    description: 'Favourable enabling conditions and generally stronger observed uptake.',
    defining_features: ['Stronger access and availability', 'Stronger engagement and recommendation', 'Coverage at or above 60%'],
    potentially_influenceable: ['Sharing delivery practices', 'Remaining cohort follow-through'],
    context: ['Existing infrastructure', 'Historical uptake'],
    interpretation: 'Look for transferable practices, and test whether they would work in different local conditions.',
    shared_approach: [
      'Document the delivery practices behind stronger uptake',
      'Test whether they transfer to areas with different conditions',
      'Monitor remaining cohort gaps',
    ],
    common_pattern: 'Access, availability, engagement and recommendation are all favourable.',
    featured_department: '29',
    default_package: null,
  },
};

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
clusters.assignment_method =
  'Authored rule-based assignment (coverage, age profile and a rural flag), with synthetic driver profiles. Not fitted clustering. See docs/CLUSTER_RULES.md.';
clusters.driver_scale = '0–100 index; higher means stronger enabling conditions';
for (const c of clusters.clusters) {
  const members = metro.filter((d) => d.illustrative.cluster_id === c.id);
  const copy = COPY[c.id];
  Object.assign(c, copy);
  c.driver_template = DRIVER_KEYS.map((k) => Math.round(mean(members.map((d) => d.illustrative.driver_indexes[k]))));
  c.expected_vcr = r1(mean(members.map((d) => d.illustrative.expected_vcr_65plus)));
  c.member_count = members.length;
}

fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + '\n');
fs.writeFileSync(clFile, JSON.stringify(clusters, null, 2) + '\n');

for (const c of clusters.clusters) {
  const m = metro.filter((d) => d.illustrative.cluster_id === c.id);
  const v = m.map((d) => d.historical.vcr_65plus);
  console.log(`${c.id.padEnd(10)} n=${m.length}  coverage ${Math.min(...v)}–${Math.max(...v)}  template ${c.driver_template.join(',')}  expected ${c.expected_vcr}`);
}
