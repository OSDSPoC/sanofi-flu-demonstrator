import { PACKAGE_BY_ID, SCENARIO } from '../lib/data';
import {
  checkpointDates,
  combinedDoseDifference,
  fmtChange,
  fmtDate,
  fmtInt,
  fmtSigned,
  packageAt,
  weekLabel,
} from '../lib/calc';
import type { PackageId, Pkg, Week } from '../lib/types';
import { LineChart } from './charts';
import { Tag } from './ui';

export const WEEK_NOTE: Record<Week, string> = {
  0: 'Baseline. No outcome change is expected or shown yet; the plan snapshot is fixed.',
  2: 'Implementation and data completeness come first. Early differences are not yet an outcome signal.',
  4: 'Directional signals are emerging. They still need administration evidence and a record of concurrent activity.',
  6: 'Comparative review. Differences are descriptive signals, not proven causal effects.',
};

function weeksUpTo(week: Week): Week[] {
  return ([0, 2, 4, 6] as Week[]).filter((w) => w <= week);
}

function metricUnit(p: Pkg) {
  return p.metric_type === 'dose_rate' ? 'doses per 10,000 people aged 65+ (pharmacy-dispensing proxy; fixed participating catchments)' : '% of observed 65+ flu dispensing that is enhanced vaccine (Efluelda + Fluad)';
}

export function PackageOutcome({ pkg, week, compact = false }: { pkg: Pkg; week: Week; compact?: boolean }) {
  const cp = packageAt(pkg, week);
  const base = packageAt(pkg, 0);
  const isDose = pkg.metric_type === 'dose_rate';
  const weeks = weeksUpTo(week);
  const pct = Math.round(((cp.sites_active ?? 0) / (cp.sites_total || 1)) * 100);
  return (
    <article className="outcome-card" data-package={pkg.id}>
      <header>
        <h3>
          <span className="pkg-id">{pkg.id}</span> {pkg.title}
        </h3>
        <p className="muted">
          Lead: {pkg.lead} · {pkg.target_sites} illustrative sites · {fmtInt(pkg.target_population_65plus)} people aged 65+ in fixed catchments <Tag kind="synthetic" />
        </p>
      </header>
      <div className="exec">
        <div className="exec-bar" role="img" aria-label={`${cp.sites_active} of ${cp.sites_total} sites active`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="exec-count">Execution: {cp.sites_active} of {cp.sites_total} sites active</p>
        <p>{cp.execution}</p>
      </div>
      <table className="metric-table">
        <caption>{metricUnit(pkg)}</caption>
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col">Baseline</th>
            <th scope="col">{weekLabel(week)}</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Treated catchments</th>
            <td>{fmtInt(base.treated_level)}{isDose ? '' : '%'}</td>
            <td>{fmtInt(cp.treated_level)}{isDose ? '' : '%'}</td>
            <td>{fmtChange(pkg, cp.treated_change ?? 0)}</td>
          </tr>
          <tr>
            <th scope="row">Matched comparison</th>
            <td>{fmtInt(base.comparison_level)}{isDose ? '' : '%'}</td>
            <td>{fmtInt(cp.comparison_level)}{isDose ? '' : '%'}</td>
            <td>{fmtChange(pkg, cp.comparison_change ?? 0)}</td>
          </tr>
          <tr className="diff">
            <th scope="row">Comparative change difference</th>
            <td colSpan={2} className="muted">
              (treated change) − (comparison change)
            </td>
            <td>
              <b>{fmtChange(pkg, cp.comparative_change_difference ?? 0)}</b>
            </td>
          </tr>
          {!isDose && (
            <tr>
              <th scope="row">Efluelda share within enhanced dispensing</th>
              <td>{base.efluelda_share_within_enhanced_pct}%</td>
              <td>{cp.efluelda_share_within_enhanced_pct}%</td>
              <td>{fmtSigned((cp.efluelda_share_within_enhanced_pct ?? 0) - (base.efluelda_share_within_enhanced_pct ?? 0))} pp</td>
            </tr>
          )}
        </tbody>
      </table>
      {!isDose && <p className="note">Denominators differ: the enhanced share uses all observed 65+ flu doses; the Efluelda share uses enhanced doses only. Category movement is not brand-share movement.</p>}
      {!compact && weeks.length > 1 && (
        <LineChart
          title={`${pkg.id}: change from baseline, treated versus comparison`}
          desc={`Change from baseline at each review up to ${weekLabel(week)}. Later checkpoints are not shown.`}
          series={[
            { name: 'Treated', color: '#5b2ba6', points: weeks.map((w) => ({ x: w, y: packageAt(pkg, w).treated_change ?? 0 })) },
            { name: 'Comparison', color: '#0f8f8f', dash: '5 4', points: weeks.map((w) => ({ x: w, y: packageAt(pkg, w).comparison_change ?? 0 })) },
          ]}
          xTicks={weeks.map((w) => ({ x: w, label: w === 0 ? 'Base' : `+${w}w` }))}
          yMin={0}
          yMax={Math.max(1, ...weeks.flatMap((w) => [packageAt(pkg, w).treated_change ?? 0, packageAt(pkg, w).comparison_change ?? 0]))}
          yFormat={(v) => (isDose ? String(Math.round(v)) : `${Math.round(v)} pp`)}
          height={150}
        />
      )}
      <p className="note">
        <b>Comparator.</b> {pkg.comparator}
      </p>
      <p className="note">
        <b>Footprint.</b> {pkg.footprint_note}
      </p>
    </article>
  );
}

export function CombinedOutcome({ ids, week }: { ids: PackageId[]; week: Week }) {
  const c = combinedDoseDifference(ids, week);
  if (!c || c.packageIds.length < 2 || week === 0) return null;
  return (
    <article className="outcome-card combined-card">
      <header>
        <h3>Comparative dispensing difference for selected uptake packages</h3>
        <p className="muted">
          {c.packageIds.join(' + ')} · weighted by fixed target populations ({c.packageIds.map((id) => `${id}: ${fmtInt(PACKAGE_BY_ID.get(id)!.target_population_65plus)}`).join('; ')}) <Tag kind="synthetic" />
        </p>
      </header>
      <p className="big-diff">
        {fmtSigned(c.difference, 1)} <span>doses per 10,000 people aged 65+</span>
      </p>
      <p className="note">
        Weighted treated change {fmtSigned(c.treatedChange, 1)} vs weighted comparison change {fmtSigned(c.comparisonChange, 1)}. Equivalent to a comparative difference of {fmtInt(c.countDifference)} dispensing-proxy doses across {fmtInt(c.population)} people; this is not a count of attributed additional vaccinations. P3 is a separate percentage-point measure and is never added to this figure.
      </p>
    </article>
  );
}

export const LIMITATIONS = [
  'Pharmacy dispensing is a proxy, not confirmed administration and not official vaccination coverage. Other channels also administer vaccines.',
  'Comparison catchments are fictional matched groups. Cluster membership alone does not justify causal inference.',
  'Differences are descriptive comparative signals. No p-values, confidence intervals, avoided hospitalisations or ROI are produced.',
  'Concurrent campaigns, seasonality and selection differences may explain part of any movement.',
  'Monitoring values are synthetic. Source cadence is a demonstration assumption (fortnightly product refresh); actual Sanofi data access is unconfirmed.',
  'Official historical coverage is unchanged by the simulation and may be reconciled later.',
];

export function OutcomeBlock({ ids, week, compact = false }: { ids: PackageId[]; week: Week; compact?: boolean }) {
  const d = checkpointDates(week);
  const pkgs = ids.map((id) => PACKAGE_BY_ID.get(id)!);
  return (
    <div className="outcome-block">
      <div className="review-meta">
        <span>
          <b>Review date</b> {fmtDate(d.review_date)} ({weekLabel(week)})
        </span>
        <span>
          <b>Data through</b> {fmtDate(d.data_through)}
        </span>
        <span>
          <b>Scenario</b> {SCENARIO.scenario}
        </span>
      </div>
      <p className="week-note">{WEEK_NOTE[week]}</p>
      <div className="outcome-grid">
        {pkgs.map((p) => (
          <PackageOutcome key={p.id} pkg={p} week={week} compact={compact} />
        ))}
        <CombinedOutcome ids={ids} week={week} />
      </div>
    </div>
  );
}
