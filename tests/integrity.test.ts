import { describe, expect, it } from 'vitest';
import {
  CLUSTERS,
  DEPARTMENTS,
  DEPT_BY_CODE,
  FEATURED_CODES,
  METRO_DEPARTMENTS,
  MONITOR_INTENTS,
  NATIONAL,
  PACKAGES,
  PLAN_INTENTS,
  RESPONSES,
  RESPONSE_BY_KEY,
  SOURCE_BY_ID,
} from '../src/lib/data';
import { combinedDoseDifference, GAP_TO_TARGET, packageAt, scopedPackages } from '../src/lib/calc';
import { matchIntent, renderResponse, responseKey } from '../src/lib/advisor';
import type { Context, PackageId, Week } from '../src/lib/types';
import geoRaw from '../src/assets/departements.geojson?raw';

const WEEKS: Week[] = [0, 2, 4, 6];
const SUBSETS: PackageId[][] = [['P1'], ['P2'], ['P3'], ['P1', 'P2'], ['P1', 'P3'], ['P2', 'P3'], ['P1', 'P2', 'P3']];
const FRANCE: Context = { kind: 'france' };

describe('source data', () => {
  it('national figures and featured public values', () => {
    expect(NATIONAL.vcr_65plus).toBe(56.7);
    expect(NATIONAL.previous_season_vcr_65plus).toBe(53.7);
    expect(GAP_TO_TARGET).toBe(18.3);
    const v = (c: string) => DEPT_BY_CODE.get(c)!.historical.vcr_65plus;
    expect([v('43'), v('93'), v('69'), v('29')]).toEqual([50.7, 46.4, 59.3, 66.8]);
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
  it('every metropolitan department has a cluster that exists; clusters are four', () => {
    expect(CLUSTERS.length).toBe(4);
    const ids = new Set(CLUSTERS.map((c) => c.id));
    for (const d of METRO_DEPARTMENTS) expect(ids.has(d.illustrative.cluster_id)).toBe(true);
  });
  it('all advisor source IDs resolve; 270 prepared responses', () => {
    expect(RESPONSES.length).toBe(270);
    for (const r of RESPONSES) for (const id of r.source_ids) expect(SOURCE_BY_ID.has(id), `${r.id} -> ${id}`).toBe(true);
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
    expect(c.treatedChange).toBeCloseTo(533.333, 3);
    expect(c.comparisonChange).toBeCloseTo(400, 3);
    expect(c.difference).toBeCloseTo(133.333, 3);
    expect(Math.round(c.countDifference)).toBe(800);
  });
  it('P3 is never part of the dose-rate combination', () => {
    expect(combinedDoseDifference(['P3'], 6)).toBeNull();
    expect(combinedDoseDifference(['P1', 'P3'], 6)!.packageIds).toEqual(['P1']);
  });
});

describe('advisor selection rules across the seven package subsets', () => {
  for (const subset of SUBSETS) {
    for (const week of [2, 4, 6] as Week[]) {
      it(`${subset.join('+')} at +${week}: only selected packages appear`, () => {
        for (const intent of MONITOR_INTENTS) {
          const r = renderResponse({ ctx: FRANCE, mode: 'monitor', week, intent, selected: subset, hasSimulation: true });
          const text = [...r.evidence, ...r.decisions, r.combinedNote ?? ''].join(' ');
          for (const id of ['P1', 'P2', 'P3'] as PackageId[]) {
            if (!subset.includes(id)) {
              const title = PACKAGES.find((p) => p.id === id)!.title;
              expect(text.includes(title), `${intent}: ${id} leaked`).toBe(false);
            }
          }
          if (intent === 'commercial' && !subset.includes('P3')) {
            expect(text).not.toMatch(/70%/);
            expect(r.fallback).toMatch(/No prepared brand-share/);
          }
        }
      });
    }
  }
  it('France +6 performance shows combined 133.3 only when both P1 and P2 selected', () => {
    const both = renderResponse({ ctx: FRANCE, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1', 'P2'], hasSimulation: true });
    expect(both.combinedNote).toMatch(/\+133\.3/);
    const one = renderResponse({ ctx: FRANCE, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1', 'P3'], hasSimulation: true });
    expect(one.combinedNote).toBeUndefined();
  });
  it('Finistère never shows a treated result; context without a selected package shows the fallback', () => {
    for (const w of WEEKS) {
      const r = renderResponse({ ctx: { kind: 'department', code: '29' }, mode: 'monitor', week: w, intent: 'performance', selected: ['P1', 'P2', 'P3'], hasSimulation: true });
      expect(r.evidence.join(' ')).toMatch(/No intervention is assigned/);
      expect(r.evidence.join(' ')).not.toMatch(/treated change/);
    }
    const r = renderResponse({ ctx: { kind: 'department', code: '93' }, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1'], hasSimulation: true });
    expect(r.fallback).toMatch(/No selected intervention/);
    expect(r.evidence).toEqual([]);
  });
  it('an ordinary department uses its cluster response and does not show another area\'s outcome', () => {
    const r = renderResponse({ ctx: { kind: 'department', code: '04' }, mode: 'monitor', week: 6, intent: 'performance', selected: ['P1', 'P2', 'P3'], hasSimulation: true });
    expect(r.evidence).toEqual([]);
    expect(r.fallback).toBeTruthy();
    const plan = renderResponse({ ctx: { kind: 'department', code: '04' }, mode: 'plan', week: 0, intent: 'profile', selected: [], hasSimulation: false });
    expect(plan.clusterNote).toMatch(/Cluster-level/);
    expect(plan.localSummary?.length).toBeGreaterThan(0);
  });
  it('scopedPackages keeps footprints disjoint and context-relevant', () => {
    expect(scopedPackages({ kind: 'department', code: '69' }, ['P1', 'P2', 'P3']).map((p) => p.id)).toEqual(['P3']);
    expect(scopedPackages({ kind: 'cluster', id: 'access' }, ['P1', 'P2', 'P3']).map((p) => p.id)).toEqual(['P1']);
  });
});

describe('prepared coverage', () => {
  it('every context and intent resolves to a prepared response', () => {
    const ctxs: Context[] = [FRANCE, ...CLUSTERS.map((c) => ({ kind: 'cluster', id: c.id }) as Context), ...FEATURED_CODES.map((code) => ({ kind: 'department', code }) as Context)];
    for (const ctx of ctxs) {
      for (const i of PLAN_INTENTS) expect(RESPONSE_BY_KEY.has(responseKey(ctx, 'plan', 0, i))).toBe(true);
      for (const w of WEEKS) for (const i of MONITOR_INTENTS) expect(RESPONSE_BY_KEY.has(responseKey(ctx, 'monitor', w, i))).toBe(true);
    }
  });
  it('free text matches deterministic intents and otherwise returns null', () => {
    expect(matchIntent('Why is coverage low here?', 'plan')).toBe('explain_gap');
    expect(matchIntent('How is Efluelda performing?', 'monitor')).toBe('commercial');
    expect(matchIntent('What should the team change?', 'monitor')).toBe('adapt');
    expect(matchIntent('tell me a joke', 'plan')).toBeNull();
    expect(matchIntent('xyzzy', 'monitor')).toBeNull();
  });
});
