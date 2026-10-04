// Profile assignment for the demonstrator. A transparent, authored method (not a trained model).
//
// Each department has a synthetic feature vector (see src/data/department_features.json). The vector is compared with four
// reference profiles by weighted Euclidean distance on consistently scaled features, and the nearest profile is assigned.
//
// The function reads ONLY the five features below. It never reads historical coverage, age-cohort coverage, a department
// code (or hash of it), an area-type list or an existing cluster label.

export const FEATURES = ['access', 'availability', 'engagement', 'recommendation', 'enhanced_adoption'];

/** Reference shapes (0–100 indexes; enhanced_adoption is the enhanced-vaccine share of 65+ flu dispensing, %). */
export const REFERENCE_PROFILES = {
  access: { access: 38, availability: 48, engagement: 62, recommendation: 50, enhanced_adoption: 46 },
  activation: { access: 68, availability: 82, engagement: 36, recommendation: 40, enhanced_adoption: 43 },
  enhanced: { access: 72, availability: 69, engagement: 65, recommendation: 52, enhanced_adoption: 36 },
  strong: { access: 82, availability: 90, engagement: 78, recommendation: 80, enhanced_adoption: 56 },
};

/** Scale per feature (distance units): indexes use 20 points, enhanced share uses 10 percentage points. */
export const FEATURE_SCALE = { access: 20, availability: 20, engagement: 20, recommendation: 20, enhanced_adoption: 10 };

/** Equal weights. */
export const FEATURE_WEIGHT = { access: 1, availability: 1, engagement: 1, recommendation: 1, enhanced_adoption: 1 };

export const PROFILE_ORDER = ['access', 'activation', 'enhanced', 'strong'];

export function distances(vec) {
  const out = {};
  for (const id of PROFILE_ORDER) {
    let s = 0;
    for (const f of FEATURES) {
      const d = (vec[f] - REFERENCE_PROFILES[id][f]) / FEATURE_SCALE[f];
      s += FEATURE_WEIGHT[f] * d * d;
    }
    out[id] = Math.sqrt(s);
  }
  return out;
}

export function assignProfile(vec) {
  const d = distances(vec);
  let best = PROFILE_ORDER[0];
  for (const id of PROFILE_ORDER) if (d[id] < d[best]) best = id;
  return best;
}
