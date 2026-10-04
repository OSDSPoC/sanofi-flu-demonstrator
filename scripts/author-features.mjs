// AUTHORING STEP (run once, output committed): writes src/data/department_features.json.
//
// This creates the synthetic enabling-condition and adoption features for every department from a fixed seed. It is demonstration
// content, not French evidence. The profile labels are NOT created here: they are assigned later, from the stored features only,
// by src/lib/clustering.mjs (see scripts/rebuild-clusters.mjs).
//
// Design, so that the story stays plausible without making coverage the definition of a profile:
//   three latent factors per department, each N(0,1) with a modest positive tilt towards observed coverage (so favourable
//   conditions tend, but are not guaranteed, to accompany higher coverage), plus independent noise:
//     F1 delivery      -> access, availability
//     F2 engagement    -> provider engagement, recommendation
//     F3 adoption      -> enhanced-vaccine share of 65+ dispensing
//   The tilt is an authoring choice, and is applied here only. Assignment never reads coverage.
// Featured departments keep their agreed vectors exactly.
//
// Run: node scripts/author-features.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dep = JSON.parse(fs.readFileSync(path.join(root, 'src/data/departments.json'), 'utf8')).departments;

const SEED = 20261004;
const TILT = { delivery: 0.5, engagement: 0.5, adoption: 0.3 };

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const normal = () => {
  let u = 0;
  let v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

// Agreed featured vectors (as in the handoff pack): access, availability, engagement, recommendation, enhanced share, confidence, Efluelda share.
const FIXED = {
  '43': { access: 35, availability: 48, engagement: 62, recommendation: 45, enhanced_adoption: 44, confidence: 67, efluelda_share: 69 },
  '93': { access: 66, availability: 86, engagement: 34, recommendation: 40, enhanced_adoption: 43, confidence: 62, efluelda_share: 66 },
  '69': { access: 73, availability: 69, engagement: 66, recommendation: 49, enhanced_adoption: 40, confidence: 62, efluelda_share: 70 },
  '29': { access: 83, availability: 90, engagement: 81, recommendation: 82, enhanced_adoption: 65, confidence: 73, efluelda_share: 71 },
};

const metro = dep.filter((d) => d.metropolitan);
const vs = metro.map((d) => d.historical.vcr_65plus);
const mu = vs.reduce((a, b) => a + b, 0) / vs.length;
const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mu) ** 2, 0) / vs.length);

const features = {};
for (const d of [...dep].sort((a, b) => (a.code < b.code ? -1 : 1))) {
  const z = d.historical.vcr_65plus == null ? 0 : (d.historical.vcr_65plus - mu) / sd;
  const mix = (t) => t * z + Math.sqrt(1 - t * t) * normal();
  // Fixed number of draws per department, so overriding a featured vector does not shift the stream.
  const f1 = mix(TILT.delivery);
  const f2 = mix(TILT.engagement);
  const f3 = mix(TILT.adoption);
  const n = [normal(), normal(), normal(), normal(), normal(), normal(), normal()];
  const gen = {
    access: clamp(62 + 16 * f1 + 4 * n[0], 8, 97),
    availability: clamp(68 + 15 * f1 + 5 * n[1], 8, 97),
    engagement: clamp(56 + 17 * f2 + 4 * n[2], 8, 97),
    recommendation: clamp(55 + 16 * f2 + 4 * n[3], 8, 97),
    enhanced_adoption: clamp(44 + 9 * f3 + 2 * n[4], 25, 70),
    confidence: clamp(62 + 8 * n[5], 35, 90),
    efluelda_share: clamp(68 + 5 * n[6], 58, 78),
  };
  features[d.code] = FIXED[d.code] ?? gen;
}

const out = {
  provenance: 'synthetic demonstration content',
  design: {
    seed: SEED,
    method:
      'Seeded random vectors from three latent factors (delivery, engagement, adoption) with a modest tilt towards observed coverage, applied at authoring time only. Profiles are assigned afterwards from these features alone.',
    tilt: TILT,
    centres: { access: 62, availability: 68, engagement: 56, recommendation: 55, enhanced_adoption: 44, confidence: 62, efluelda_share: 68 },
    featured_fixed: Object.keys(FIXED),
  },
  features,
};
fs.writeFileSync(path.join(root, 'src/data/department_features.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${Object.keys(features).length} feature vectors (seed ${SEED})`);
