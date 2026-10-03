import {
  CLUSTER_BY_ID,
  DEPT_BY_CODE,
  METRO_DEPARTMENTS,
  NATIONAL,
  PACKAGES,
  PACKAGE_BY_ID,
  SCENARIO,
} from './data';
import type { Checkpoint, ClusterId, Context, Department, PackageId, Pkg, Week } from './types';

/* ---------- formatting (single place so UI, advisor and print agree) ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtPct(v: number | null | undefined, digits = 1): string {
  return v == null ? 'Unavailable' : `${v.toFixed(digits)}%`;
}
export function fmtPp(v: number | null | undefined, digits = 1): string {
  if (v == null) return 'Unavailable';
  const s = v.toFixed(digits);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s.replace('-', '')} pp`;
}
export function fmtSigned(v: number, digits = 0): string {
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}
export function fmtInt(v: number | null | undefined): string {
  return v == null ? 'Unavailable' : Math.round(v).toLocaleString('en-GB');
}
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function weekLabel(week: Week): string {
  return week === 0 ? 'Baseline' : `+${week} weeks`;
}

/* ---------- national / cluster aggregates ---------- */

export const GAP_TO_TARGET = round1(NATIONAL.target_pct - NATIONAL.vcr_65plus);
export const NATIONAL_CHANGE_PP = round1(NATIONAL.vcr_65plus - NATIONAL.previous_season_vcr_65plus);

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function gapTo75(d: Department): number | null {
  const v = d.historical.vcr_65plus;
  return v == null ? null : round1(NATIONAL.target_pct - v);
}

export function clusterMembers(id: ClusterId): Department[] {
  return METRO_DEPARTMENTS.filter((d) => d.illustrative.cluster_id === id);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface ClusterStats {
  count: number;
  min: number | null;
  max: number | null;
  medianVcr: number | null;
  opportunity: number;
  missing: number;
}

export function clusterStats(id: ClusterId): ClusterStats {
  const members = clusterMembers(id);
  const vals = members.map((d) => d.historical.vcr_65plus).filter((v): v is number => v != null);
  return {
    count: members.length,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    medianVcr: median(vals),
    opportunity: members.reduce((s, d) => s + (d.illustrative.unvaccinated_opportunity ?? 0), 0),
    missing: members.length - vals.length,
  };
}

export function metroOpportunityTotal(): number {
  return METRO_DEPARTMENTS.reduce((s, d) => s + (d.illustrative.unvaccinated_opportunity ?? 0), 0);
}

/* ---------- context helpers ---------- */

export function ctxKey(ctx: Context): string {
  return ctx.kind === 'france' ? 'france' : ctx.kind === 'cluster' ? `cluster:${ctx.id}` : `department:${ctx.code}`;
}

export function ctxClusterId(ctx: Context): ClusterId | null {
  if (ctx.kind === 'cluster') return ctx.id;
  if (ctx.kind === 'department') return DEPT_BY_CODE.get(ctx.code)?.illustrative.cluster_id ?? null;
  return null;
}

export function ctxLabel(ctx: Context): string {
  if (ctx.kind === 'france') return 'France overview';
  if (ctx.kind === 'cluster') return CLUSTER_BY_ID.get(ctx.id)!.name;
  const d = DEPT_BY_CODE.get(ctx.code);
  return d ? `${d.name} (${d.code})` : ctx.code;
}

/** Packages whose footprint lies in the selected context. Ordinary departments have none. */
export function relevantPackageIds(ctx: Context): PackageId[] {
  if (ctx.kind === 'france') return PACKAGES.map((p) => p.id);
  if (ctx.kind === 'cluster') return PACKAGES.filter((p) => p.cluster_id === ctx.id).map((p) => p.id);
  return PACKAGES.filter((p) => p.department_code === ctx.code).map((p) => p.id);
}

export function scopedPackages(ctx: Context, selected: PackageId[]): Pkg[] {
  const rel = new Set(relevantPackageIds(ctx));
  return selected.filter((id) => rel.has(id)).map((id) => PACKAGE_BY_ID.get(id)!);
}

export function packageAt(pkg: Pkg, week: Week): Checkpoint {
  return pkg.checkpoints.find((c) => c.week === week)!;
}

export function checkpointDates(week: Week) {
  return SCENARIO.checkpoints.find((c) => c.week === week)!;
}

/* ---------- outcome metrics ---------- */

export function unitLabel(pkg: Pkg): string {
  return pkg.metric_type === 'dose_rate' ? 'doses per 10,000 people aged 65+' : 'percentage points';
}

export function fmtChange(pkg: Pkg, v: number): string {
  return pkg.metric_type === 'dose_rate' ? fmtSigned(v, 0) : `${fmtSigned(v, 0)} pp`;
}

export interface CombinedDose {
  packageIds: PackageId[];
  population: number;
  treatedChange: number;
  comparisonChange: number;
  difference: number;
  countDifference: number;
}

/** Population-weighted combination of P1/P2 dose-rate changes. P3 is never combined. */
export function combinedDoseDifference(selected: PackageId[], week: Week): CombinedDose | null {
  const pkgs = selected
    .map((id) => PACKAGE_BY_ID.get(id)!)
    .filter((p) => p.metric_type === 'dose_rate');
  if (!pkgs.length) return null;
  const population = pkgs.reduce((s, p) => s + p.target_population_65plus, 0);
  let t = 0;
  let c = 0;
  for (const p of pkgs) {
    const cp = packageAt(p, week);
    t += (cp.treated_change ?? 0) * p.target_population_65plus;
    c += (cp.comparison_change ?? 0) * p.target_population_65plus;
  }
  const treatedChange = t / population;
  const comparisonChange = c / population;
  const difference = treatedChange - comparisonChange;
  return {
    packageIds: pkgs.map((p) => p.id),
    population,
    treatedChange,
    comparisonChange,
    difference,
    countDifference: (difference / 10000) * population,
  };
}

export function packageSummaryLine(pkg: Pkg, week: Week): string {
  const cp = packageAt(pkg, week);
  const u = pkg.metric_type === 'dose_rate' ? 'doses per 10,000 people aged 65+' : 'percentage points';
  return `${fmtChange(pkg, cp.treated_change ?? 0).replace(' pp', '')} treated vs ${fmtChange(pkg, cp.comparison_change ?? 0).replace(' pp', '')} comparison; difference ${fmtChange(pkg, cp.comparative_change_difference ?? 0).replace(' pp', '')} ${u}`;
}

/** Highest checkpoint a package change can honestly be read at. */
export function dataThroughFor(week: Week): string {
  return checkpointDates(week).data_through;
}

export function opportunityOf(d: Department): number | null {
  return d.illustrative.unvaccinated_opportunity;
}
