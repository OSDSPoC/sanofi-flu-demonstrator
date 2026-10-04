import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLUSTERS,
  CLUSTER_BY_ID,
  DEPARTMENTS,
  DEPT_BY_CODE,
  METRO_DEPARTMENTS,
  NATIONAL,
  PACKAGES,
  PACKAGE_BY_ID,
  SOURCE_BY_ID,
} from '../src/lib/data';
import { clusterStats, combinedDoseDifference, fmtEst, GAP_TO_TARGET, metroOpportunityTotal, opportunityOf, packageAt, scopedPackages } from '../src/lib/calc';
import { buildAnswer, matchIntent, promptsFor } from '../src/lib/answers';
import type { Answer, ClusterId, Context, PackageId, Week } from '../src/lib/types';
import geoRaw from '../src/assets/departements.geojson?raw';
import features from '../src/data/department_features.json';
import population from '../src/data/population_65plus.json';
import { FEATURES, REFERENCE_PROFILES, assignProfile, type FeatureVector } from '../src/lib/clustering.mjs';

const WEEKS: Week[] = [0, 2, 4, 6];
const SUBSETS: PackageId[][] = [['P1'], ['P2'], ['P3'], ['P1', 'P2'], ['P1', 'P3'], ['P2', 'P3'], ['P1', 'P2', 'P3']];
const FRANCE: Context = { kind: 'france' };
const answerText = (a: Answer) => [a.title, a.recommendation, ...a.body, ...(a.bullets ?? []), ...(a.rows ?? []).flatMap((r) => [r.action, r.owner]), a.fallback ?? '', ...a.evidence, a.uncertainty ?? ''].join(' ');

describe('source data', () => {
  it('national figures and featured public values', () => {
    expect(NATIONAL.vcr_65plus).toBe(56.7);
    expect(NATIONAL.previous_season_vcr_65plus).toBe(53.7);
    expect(GAP_TO_TARGET).toBe(18.3);
    const v = (c: string) => DEPT_BY_CODE.get(c)!.historical.vcr_65plus;
    expect([v('43'), v('93'), v('69'), v('29')]).toEqual([50.7, 46.4, 59.3, 66.8]);
  });
  it('public department data are unchanged from the handoff (fingerprint)', () => {
    const pub = JSON.stringify(DEPARTMENTS.map((d) => [d.code, d.name, d.historical.vcr_65plus, d.historical.vcr_65_74, d.historical.vcr_75plus, d.historical.vcr_under65_atrisk]));
    expect(createHash('sha256').update(pub).digest('hex')).toBe('b441b0d1f02af6b897b46b92f80579be086a758ffe10fc946c83c2dc7b95b0fe');
  });
  it('96 metropolitan departments join to authentic geometry by string code', () => {
    const geo = JSON.parse(geoRaw) as { features: { properties: { code: string } }[] };
    const codes = new Set(geo.features.map((f) => f.properties.code));
    expect(METRO_DEPARTMENTS.length).toBe(96);
    expect(geo.features.length).toBe(96);
    for (const d of METRO_DEPARTMENTS) expect(codes.has(d.code)).toBe(true);
    expect(codes.has('2A') && codes.has('2B') && codes.has('01')).toBe(true);
    expect(DEPARTMENTS.length).toBe(99);
  });
  it('source IDs used by packages resolve', () => {
    for (const p of PACKAGES) for (const id of p.source_ids) expect(SOURCE_BY_ID.has(id), `${p.id} -> ${id}`).toBe(true);
  });
});

describe('cluster membership follows features, not coverage', () => {
  type D = (typeof METRO_DEPARTMENTS)[number];
  const members = (id: ClusterId) => METRO_DEPARTMENTS.filter((d) => d.illustrative.cluster_id === id);
  const mean = (id: ClusterId, f: (d: D) => number) => members(id).reduce((s, d) => s + f(d), 0) / members(id).length;
  const drv = (k: keyof D['illustrative']['driver_indexes']) => (d: D) => d.illustrative.driver_indexes[k];
  const table = (features as { features: Record<string, FeatureVector & { confidence: number; efluelda_share: number }> }).features;
  const vec = (code: string): FeatureVector => ({ ...table[code] });

  it('every department has exactly one profile and the assignment reproduces from the stored features', () => {
    for (const d of DEPARTMENTS) expect(d.illustrative.cluster_id, d.code).toBe(assignProfile(vec(d.code)));
    expect(CLUSTERS.map((c) => c.id).sort()).toEqual(['access', 'activation', 'enhanced', 'strong']);
    expect(CLUSTERS.reduce((n, c) => n + members(c.id).length, 0)).toBe(96);
    for (const c of CLUSTERS) {
      expect(members(c.id).length).toBeGreaterThanOrEqual(8);
      expect(clusterStats(c.id).count).toBe(c.member_count);
    }
  });
  it('the assignment function reads only the five features', () => {
    const src = readFileSync(new URL('../src/lib/clustering.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    for (const banned of ['vcr', 'historical', 'rural', 'cluster_id', 'code', 'hash']) expect(src.toLowerCase().includes(banned), banned).toBe(false);
    expect(FEATURES).toEqual(['access', 'availability', 'engagement', 'recommendation', 'enhanced_adoption']);
  });
  it('changing only historical coverage leaves every assignment unchanged', () => {
    for (const d of METRO_DEPARTMENTS) {
      const withCoverage = { ...vec(d.code), vcr_65plus: 10, vcr_65_74: 90, vcr_75plus: 99, historical: { vcr_65plus: 1 } } as unknown as FeatureVector;
      expect(assignProfile(withCoverage)).toBe(d.illustrative.cluster_id);
    }
  });
  it('changing enabling and adoption features moves the assignment in the expected direction', () => {
    const base93 = vec('93'); // Activation gap: strong access, weak engagement and recommendation
    expect(assignProfile(base93)).toBe('activation');
    expect(assignProfile({ ...base93, engagement: 80, recommendation: 80, enhanced_adoption: 56 })).toBe('strong');
    expect(assignProfile({ ...base93, access: 36, availability: 46 })).toBe('access');
    const base43 = vec('43'); // Access-constrained
    expect(assignProfile({ ...base43, access: 84, availability: 90, engagement: 36, recommendation: 40 })).toBe('activation');
    const base69 = vec('69'); // Enhanced adoption gap: reasonable delivery, low enhanced share
    expect(assignProfile({ ...base69, enhanced_adoption: 58, recommendation: 80, engagement: 78, availability: 90, access: 82 })).toBe('strong');
  });
  it('featured departments receive their agreed profiles from the same method, with their agreed values', () => {
    const cl = (c: string) => DEPT_BY_CODE.get(c)!.illustrative.cluster_id;
    expect([cl('43'), cl('93'), cl('69'), cl('29')]).toEqual(['access', 'activation', 'enhanced', 'strong']);
    expect(DEPT_BY_CODE.get('93')!.illustrative.driver_indexes).toMatchObject({ access_index: 66, hcp_engagement_index: 34, availability_index: 86, recommendation_index: 40 });
    expect(DEPT_BY_CODE.get('93')!.illustrative.expected_vcr_65plus).toBe(54);
    expect([DEPT_BY_CODE.get('69')!.illustrative.enhanced_share_of_65plus_dispensing_pct, DEPT_BY_CODE.get('69')!.illustrative.efluelda_share_of_enhanced_dispensing_pct]).toEqual([40, 70]);
    for (const c of CLUSTERS) expect(DEPT_BY_CODE.get(c.featured_department)!.illustrative.cluster_id).toBe(c.id);
  });
  it('profile summaries equal member aggregates', () => {
    const keys = ['access_index', 'hcp_engagement_index', 'confidence_index', 'availability_index', 'recommendation_index'] as const;
    for (const c of CLUSTERS) keys.forEach((k, i) => expect(c.driver_template[i]).toBe(Math.round(mean(c.id, drv(k)))));
    for (const d of DEPARTMENTS) {
      const f = vec(d.code);
      expect(d.illustrative.driver_indexes.access_index).toBe(f.access);
      expect(d.illustrative.enhanced_share_of_65plus_dispensing_pct).toBe(f.enhanced_adoption);
    }
  });
  it('profiles match their descriptions', () => {
    for (const o of ['activation', 'enhanced', 'strong'] as ClusterId[]) {
      expect(mean('access', drv('access_index'))).toBeLessThan(mean(o, drv('access_index')));
      expect(mean('access', drv('availability_index'))).toBeLessThan(mean(o, drv('availability_index')));
    }
    for (const o of ['access', 'enhanced', 'strong'] as ClusterId[]) {
      expect(mean('activation', drv('hcp_engagement_index'))).toBeLessThan(mean(o, drv('hcp_engagement_index')));
      expect(mean('activation', drv('recommendation_index'))).toBeLessThan(mean(o, drv('recommendation_index')));
    }
    expect(mean('activation', drv('access_index'))).toBeGreaterThan(mean('access', drv('access_index')) + 15);
    for (const o of ['access', 'activation', 'strong'] as ClusterId[])
      expect(mean('enhanced', (d) => d.illustrative.enhanced_share_of_65plus_dispensing_pct)).toBeLessThan(mean(o, (d) => d.illustrative.enhanced_share_of_65plus_dispensing_pct));
    for (const k of ['access_index', 'hcp_engagement_index', 'availability_index', 'recommendation_index'] as const)
      for (const o of ['access', 'activation', 'enhanced'] as ClusterId[]) expect(mean('strong', drv(k))).toBeGreaterThan(mean(o, drv(k)));
    expect(REFERENCE_PROFILES.strong.access).toBeGreaterThan(REFERENCE_PROFILES.access.access);
  });
  it('coverage overlaps between profiles, especially Enhanced and Strong, with similar-coverage areas in different profiles', () => {
    const lo = (id: ClusterId) => clusterStats(id).min!;
    const hi = (id: ClusterId) => clusterStats(id).max!;
    expect(Math.min(hi('enhanced'), hi('strong')) - Math.max(lo('enhanced'), lo('strong'))).toBeGreaterThan(4);
    expect(Math.min(hi('access'), hi('activation')) - Math.max(lo('access'), lo('activation'))).toBeGreaterThan(4);
    let pairs = 0;
    for (const a of members('enhanced')) for (const b of members('strong')) if (Math.abs(a.historical.vcr_65plus! - b.historical.vcr_65plus!) <= 0.5) pairs++;
    expect(pairs).toBeGreaterThanOrEqual(5);
  });
  it('expected coverage follows the documented feature rule (featured fixed) and residuals are not extreme', () => {
    const rule = { base: 56, c: { access: 62, availability: 68, engagement: 56, recommendation: 55, enhanced_adoption: 44 }, w: { access: 0.06, availability: 0.05, engagement: 0.06, recommendation: 0.07, enhanced_adoption: 0.025 } };
    for (const d of METRO_DEPARTMENTS) {
      if (['43', '93', '69', '29'].includes(d.code)) continue;
      const f = vec(d.code);
      const e = rule.base + FEATURES.reduce((s, k) => s + rule.w[k] * (f[k] - rule.c[k]), 0);
      expect(d.illustrative.expected_vcr_65plus).toBeCloseTo(e, 1);
    }
    for (const d of METRO_DEPARTMENTS) {
      expect(d.illustrative.observed_minus_expected_pp).toBeCloseTo(d.historical.vcr_65plus! - d.illustrative.expected_vcr_65plus, 1);
      expect(Math.abs(d.illustrative.observed_minus_expected_pp!)).toBeLessThan(12);
    }
    expect(METRO_DEPARTMENTS.filter((d) => Math.abs(d.illustrative.observed_minus_expected_pp!) > 6).length).toBeLessThanOrEqual(10);
  });
});

describe('opportunity uses INSEE population', () => {
  const p = (population as { departments: Record<string, { pop_65plus: number | null; pop_total: number }>; reference_date: string }).departments;
  it('every metropolitan department joins by code, is positive, and is smaller than the total population', () => {
    for (const d of METRO_DEPARTMENTS) {
      const r = p[d.code];
      expect(r, d.code).toBeTruthy();
      expect(r.pop_65plus!).toBeGreaterThan(0);
      expect(r.pop_65plus!).toBeLessThan(r.pop_total);
      expect(d.illustrative.eligible_population_65plus).toBe(r.pop_65plus);
      expect(r.pop_65plus! / r.pop_total).toBeGreaterThan(0.1);
      expect(r.pop_65plus! / r.pop_total).toBeLessThan(0.4);
    }
    expect((population as { reference_date: string }).reference_date).toBe('2026-01-01');
  });
  it('plausible scale and ordering for Paris, Nord, Lozère, Creuse and the featured departments', () => {
    const v = (c: string) => DEPT_BY_CODE.get(c)!.illustrative.eligible_population_65plus!;
    expect(v('48')).toBeLessThan(30000); // Lozère
    expect(v('23')).toBeLessThan(v('75')); // Creuse < Paris
    expect(v('48')).toBeLessThan(v('23'));
    expect(v('59')).toBeGreaterThan(v('75')); // Nord > Paris
    expect(v('69')).toBeGreaterThan(v('93'));
    expect(v('93')).toBeGreaterThan(v('29') * 0.8);
    expect(v('43')).toBeLessThan(v('29'));
  });
  it('opportunity = population × (1 − coverage); aggregates reconcile', () => {
    let total = 0;
    for (const d of METRO_DEPARTMENTS) {
      const o = opportunityOf(d)!;
      expect(o).toBeCloseTo(d.illustrative.eligible_population_65plus! * (1 - d.historical.vcr_65plus! / 100), 6);
      total += o;
    }
    expect(CLUSTERS.reduce((n, c) => n + clusterStats(c.id).opportunity, 0)).toBeCloseTo(total, 3);
    expect(metroOpportunityTotal()).toBeCloseTo(total, 3);
  });
  it('missing values are unavailable, never zero', () => {
    const d = structuredClone(DEPT_BY_CODE.get('93')!);
    d.historical.vcr_65plus = null;
    expect(opportunityOf(d)).toBeNull();
    d.historical.vcr_65plus = 46.4;
    d.illustrative.eligible_population_65plus = null as unknown as number;
    expect(opportunityOf(d)).toBeNull();
  });
  it('intervention catchment populations and sites are unchanged', () => {
    expect(PACKAGE_BY_ID.get('P1')!.target_population_65plus).toBe(20000);
    expect(PACKAGE_BY_ID.get('P2')!.target_population_65plus).toBe(40000);
    expect(PACKAGE_BY_ID.get('P3')!.target_population_65plus).toBe(30000);
    expect(PACKAGES.map((x) => x.target_sites)).toEqual([12, 20, 15]);
  });
  it('INSEE is documented as an acquired public source', () => {
    const s = SOURCE_BY_ID.get('insee')!;
    expect(s.provenance).toBe('public');
    expect(s.period).toMatch(/1 January 2026/);
    expect(s.url).toMatch(/insee\.fr/);
  });
});
describe('numerical reconciliation', () => {
  it('P1/P2/P3 at +6 weeks', () => {
    const [p1, p2, p3] = PACKAGES;
    const c = (p: typeof p1, w: Week) => packageAt(p, w);
    expect([c(p1, 6).treated_change, c(p1, 6).comparison_change, c(p1, 6).comparative_change_difference]).toEqual([400, 300, 100]);
    expect([c(p2, 6).treated_change, c(p2, 6).comparison_change, c(p2, 6).comparative_change_difference]).toEqual([600, 450, 150]);
    expect([c(p3, 6).treated_change, c(p3, 6).comparison_change, c(p3, 6).comparative_change_difference]).toEqual([8, 5, 3]);
    expect(c(p3, 6).efluelda_share_within_enhanced_pct).toBe(70);
    expect(c(p2, 2).treated_change).toBe(c(p2, 2).comparison_change);
  });
  it('P2 levels, sites and population match the brief', () => {
    const p2 = PACKAGE_BY_ID.get('P2')!;
    expect(p2.title).toBe('Strengthen recommendations and follow-through');
    expect(p2.target_sites).toBe(20);
    expect(p2.target_population_65plus).toBe(40000);
    expect(p2.checkpoints.map((c) => [c.treated_level, c.comparison_level, c.sites_active])).toEqual([
      [1500, 1500, 0],
      [1660, 1660, 10],
      [1880, 1780, 17],
      [2100, 1950, 19],
    ]);
  });
  it('every checkpoint is internally consistent', () => {
    for (const p of PACKAGES)
      for (const cp of p.checkpoints) {
        expect(cp.treated_level! - p.checkpoints[0].treated_level!).toBe(cp.treated_change);
        expect(cp.comparison_level! - p.checkpoints[0].comparison_level!).toBe(cp.comparison_change);
        expect(cp.treated_change! - cp.comparison_change!).toBe(cp.comparative_change_difference);
      }
  });
  it('P1+P2 combined at +6 is weighted 133.3 and 800 dispensing-proxy doses', () => {
    const c = combinedDoseDifference(['P1', 'P2'], 6)!;
    expect(c.difference).toBeCloseTo(133.333, 3);
    expect(Math.round(c.countDifference)).toBe(800);
  });
  it('P3 is never part of the dose-rate combination', () => {
    expect(combinedDoseDifference(['P3'], 6)).toBeNull();
    expect(combinedDoseDifference(['P1', 'P3'], 6)!.packageIds).toEqual(['P1']);
  });
});

describe('advisor: main-path copy', () => {
  const plan = (ctx: Context, intent: string, selected: PackageId[] = []) => buildAnswer({ ctx, mode: 'plan', week: 0, intent, selected, hasSimulation: false });
  const mon = (ctx: Context, week: Week, intent: string, selected: PackageId[]) => buildAnswer({ ctx, mode: 'monitor', week, intent, selected, hasSimulation: true });
  const D93: Context = { kind: 'department', code: '93' };

  it('France: Where should we focus? leads with the Activation-gap action', () => {
    const a = plan(FRANCE, 'focus');
    expect(a.recommendation).toMatch(/Activation-gap/);
    expect(a.body.join(' ')).toMatch(/Coverage alone tells us where uptake is lower/);
    expect(a.actions).toEqual(['explore_cluster:activation']);
  });
  it('Activation gap answers lead to Seine-Saint-Denis', () => {
    const c1 = plan({ kind: 'cluster', id: 'activation' }, 'common');
    expect(c1.body.join(' ')).toMatch(/relatively stronger access and availability, with weaker provider engagement/);
    expect(c1.actions).toEqual(['explore_department:93']);
    const c2 = plan({ kind: 'cluster', id: 'activation' }, 'approach');
    expect(c2.body.join(' ')).toMatch(/common intervention framework/);
    expect(c2.actions).toEqual(['explore_department:93']);
  });
  it('Seine-Saint-Denis: opportunity, Public Affairs and design answers', () => {
    const o = plan(D93, 'opportunity');
    expect(o.recommendation).toBe('Focus first on recommendation and follow-through.');
    expect(o.body.join(' ')).toMatch(/Coverage is 46\.4%, with a larger gap among adults aged 65–74 than those aged 75\+/);
    expect(o.evidence.join(' ')).toMatch(/40\.7%/);
    expect(o.evidence.join(' ')).toMatch(/53\.7%/);
    expect(o.actions).toEqual(['design_local']);
    expect(plan(D93, 'public_affairs').body.join(' ')).toMatch(/Convene existing community partners/);
    const d = plan(D93, 'design');
    expect(d.recommendation).toMatch(/six-week package through 20 participating sites/);
    expect(d.rows).toHaveLength(4);
    expect(d.rows![0].action).toMatch(/Brief participating pharmacies and practices on proactive recommendations/);
    expect(d.rows![0].owner).toBe('Medical supports the briefing; participating providers implement recommendations');
    expect(d.rows![3].owner).toMatch(/Public Affairs coordinates the team review; participating sites record execution; Market Access supports delivery issues/);
    expect(d.rows!.map((r) => r.action + r.owner).join(' ')).not.toMatch(/Patient-level/);
    expect(d.evidence.join(' ')).toMatch(/Patient-level reminder data stay with providers/);
    expect(d.actions).toEqual(['add_plan:P2', 'review_plan']);
  });
  it('P2 at +2 and +6 weeks uses the agreed wording and numbers', () => {
    const p2 = mon(D93, 2, 'progress', ['P2']);
    expect(p2.body.join(' ')).toMatch(/Ten of twenty sites are active/);
    expect(p2.body.join(' ')).toMatch(/increased by 160 per 10,000 adults aged 65\+ in both participating and comparison catchments/);
    expect(p2.recommendation).toBe('Complete rollout and check execution before judging outcomes.');
    const perf = mon(D93, 6, 'performance', ['P2']);
    expect(perf.body.join(' ')).toMatch(/Nineteen of twenty sites are active/);
    expect(perf.body.join(' ')).toMatch(/600 per 10,000 adults aged 65\+ in participating catchments, compared with 450/);
    expect(perf.body.join(' ')).toMatch(/favourable comparative difference of 150/);
    expect(perf.recommendation).toBe('Complete the remaining site and review which audiences are still being missed.');
    const next = mon(D93, 6, 'next', ['P2']);
    expect(next.body.join(' ')).toMatch(/consider adapting the approach in other Activation-gap departments/);
    expect(next.actions).toContain('print_outcome');
    expect(next.body.join(' ')).not.toMatch(/all .*cluster members|automatically/);
  });
  it('+4 weeks: early signal with difference 100', () => {
    expect(mon(D93, 4, 'progress', ['P2']).body.join(' ')).toMatch(/Seventeen of twenty sites/);
    expect(mon(D93, 4, 'progress', ['P2']).body.join(' ')).toMatch(/difference of 100/);
  });
  it('uncertainty answer is available in every context', () => {
    expect(mon(D93, 6, 'uncertain', ['P2']).body.join(' ')).toMatch(/does not confirm administration/);
  });
  it('Rhône Efluelda conclusion at +6 weeks (P3) and no brand claim otherwise', () => {
    const rh: Context = { kind: 'department', code: '69' };
    const a = mon(rh, 6, 'commercial', ['P3']);
    expect(a.body.join(' ')).toMatch(/Efluelda retains its share within the category/);
    expect(a.body.join(' ')).toMatch(/Stable share in a growing category can still mean higher brand volume/);
    expect(a.evidence.join(' ')).toMatch(/70%/);
    const none = mon(FRANCE, 6, 'commercial', ['P2']);
    expect(none.fallback).toBeTruthy();
    expect(answerText(none)).not.toMatch(/70%/);
  });
  it('prompt sets follow the brief', () => {
    const labels = (c: Context, m: 'plan' | 'monitor', sel: PackageId[] = []) => promptsFor(c, m, sel).map((p) => p.label);
    expect(labels(FRANCE, 'plan')).toContain('Where should we focus?');
    expect(labels({ kind: 'cluster', id: 'activation' }, 'plan')).toEqual(expect.arrayContaining(['What do these areas have in common?', 'What approach could work across this cluster?']));
    expect(labels(D93, 'plan')).toEqual(expect.arrayContaining(['Where is the opportunity?', 'What can Public Affairs do?', 'Help us design an intervention']));
    expect(labels(D93, 'monitor', ['P2'])).toEqual(expect.arrayContaining(['How is the plan progressing?', 'How did the intervention perform?', 'What should the team do next?', 'What remains uncertain?']));
  });
  it('free text matches deterministic intents and otherwise returns null', () => {
    const p = promptsFor(D93, 'plan', []);
    expect(matchIntent('Where is the opportunity?', p)).toBe('opportunity');
    expect(matchIntent('what could public affairs do', p)).toBe('public_affairs');
    expect(matchIntent('xyzzy', p)).toBeNull();
  });
});

describe('advisor: scoping across all package subsets', () => {
  const intents = ['progress', 'performance', 'next', 'uncertain', 'commercial', 'sources'];
  for (const subset of SUBSETS) {
    for (const week of [2, 4, 6] as Week[]) {
      it(`${subset.join('+')} at +${week}: only selected packages appear`, () => {
        for (const intent of intents) {
          const a = buildAnswer({ ctx: FRANCE, mode: 'monitor', week, intent, selected: subset, hasSimulation: true });
          const text = answerText(a);
          for (const id of ['P1', 'P2', 'P3'] as PackageId[]) {
            if (!subset.includes(id)) expect(text.includes(PACKAGE_BY_ID.get(id)!.title), `${intent}: ${id} leaked`).toBe(false);
          }
          if (intent === 'commercial' && !subset.includes('P3')) expect(text).not.toMatch(/70%/);
        }
      });
    }
  }
  it('France +6 shows the combined figure only when both P1 and P2 are selected', () => {
    const both = buildAnswer({ ctx: FRANCE, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1', 'P2'], hasSimulation: true });
    expect(answerText(both)).toMatch(/\+133\.3/);
    const one = buildAnswer({ ctx: FRANCE, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1', 'P3'], hasSimulation: true });
    expect(answerText(one)).not.toMatch(/133\.3/);
  });
  it('areas without a selected package state that there is no intervention outcome', () => {
    for (const ctx of [{ kind: 'department', code: '29' }, { kind: 'department', code: '04' }, { kind: 'cluster', id: 'strong' }] as Context[])
      for (const w of WEEKS) {
        const a = buildAnswer({ ctx, mode: 'monitor', week: w, intent: 'performance', selected: ['P1', 'P2', 'P3'], hasSimulation: true });
        expect(a.fallback).toBe('No intervention was assigned here, so there is no intervention outcome to review.');
      }
    const a = buildAnswer({ ctx: { kind: 'department', code: '93' }, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1'], hasSimulation: true });
    expect(a.fallback).toBeTruthy();
  });
  it('scopedPackages keeps footprints context-relevant', () => {
    expect(scopedPackages({ kind: 'department', code: '69' }, ['P1', 'P2', 'P3']).map((p) => p.id)).toEqual(['P3']);
    expect(scopedPackages({ kind: 'cluster', id: 'access' }, ['P1', 'P2', 'P3']).map((p) => p.id)).toEqual(['P1']);
  });
});

describe('ordinary operating copy', () => {
  const ctxs: Context[] = [FRANCE, ...CLUSTERS.map((c) => ({ kind: 'cluster', id: c.id }) as Context), ...['43', '93', '69', '29', '04'].map((code) => ({ kind: 'department', code }) as Context)];
  const all: Answer[] = [];
  for (const ctx of ctxs) {
    for (const p of promptsFor(ctx, 'plan', [])) all.push(buildAnswer({ ctx, mode: 'plan', week: 0, intent: p.intent, selected: [], hasSimulation: false }));
    for (const w of WEEKS)
      for (const p of promptsFor(ctx, 'monitor', ['P1', 'P2', 'P3'])) all.push(buildAnswer({ ctx, mode: 'monitor', week: w, intent: p.intent, selected: ['P1', 'P2', 'P3'], hasSimulation: true }));
  }
  it('has no demonstration qualifiers or internal instructions in any answer', () => {
    for (const a of all) {
      const t = answerText(a);
      expect(t, a.key).not.toMatch(/fictional|notional|illustrative|simulated|synthetic|Do not display/i);
    }
  });
  it('every answer has a recommendation or an explicit fallback, and resolvable sources', () => {
    for (const a of all) {
      expect(Boolean(a.recommendation) || Boolean(a.fallback), a.key).toBe(true);
      for (const id of a.sourceIds) expect(SOURCE_BY_ID.has(id), `${a.key} -> ${id}`).toBe(true);
    }
  });
  it('answers do not open with the national coverage figure', () => {
    for (const a of all.filter((x) => x.key.includes('|plan|') && !x.key.startsWith('france'))) expect(a.recommendation).not.toMatch(/56\.7/);
  });
});

export { CLUSTER_BY_ID };
