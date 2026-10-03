import { PACKAGE_BY_ID, SCENARIO } from '../lib/data';
import { checkpointDates, combinedDoseDifference, fmtChange, fmtDate, fmtEst, fmtInt, fmtSigned, packageAt, weekLabel } from '../lib/calc';
import { weekRecommendation } from '../lib/answers';
import type { PackageId, Pkg, Week } from '../lib/types';
import { LineChart } from './charts';

export const WEEK_NOTE: Record<Week, string> = {
  0: 'Baseline. The plan snapshot is fixed and no outcome change is expected yet.',
  2: 'Execution and data completeness come first. Early differences are not yet an outcome signal.',
  4: 'Directional signals are emerging. They still need administration evidence and a record of concurrent activity.',
  6: 'Comparative review. Differences are signals for the team to discuss, not proven effects.',
};

const WEEKS: Week[] = [0, 2, 4, 6];
const upTo = (week: Week) => WEEKS.filter((w) => w <= week);

const METRIC_SUBTITLE: Record<Pkg['metric_type'], string> = {
  dose_rate: 'Dispensing proxy: pharmacy doses per 10,000 adults aged 65+ in fixed participating catchments',
  share_pct: 'Enhanced vaccines as a share of observed 65+ flu dispensing, in fixed participating catchments',
};

export const DEFINITIONS = [
  'Dispensing proxy: doses dispensed by pharmacies, per 10,000 adults aged 65+ in the participating catchments. It is not official coverage or confirmed administration.',
  'Fixed participating catchments: the same defined sites and populations throughout the follow-up.',
  'Comparison group: matched catchments that are not participating, matched on baseline trajectory and relevant characteristics.',
  'Comparative difference: (participating change) − (comparison change). Seasonal increases are expected in both groups; the review examines their difference.',
  'Data-through date: the last day of observations included, three days before each review date.',
];

/* ---------- on-screen package card (one package, result + chart + decision) ---------- */

export function PackageCard({ pkg, week }: { pkg: Pkg; week: Week }) {
  const cp = packageAt(pkg, week);
  const isDose = pkg.metric_type === 'dose_rate';
  const weeks = upTo(week);
  const final = packageAt(pkg, 6);
  const base = packageAt(pkg, 0);
  const pct = Math.round(((cp.sites_active ?? 0) / (cp.sites_total || 1)) * 100);
  const lo = base.treated_level ?? 0;
  const hi = Math.max(final.treated_level ?? 0, final.comparison_level ?? 0);
  const unit = (v: number) => (isDose ? fmtSigned(v) : `${fmtSigned(v)} pp`);
  const diff = cp.comparative_change_difference ?? 0;
  return (
    <article className="pkg-card" data-package={pkg.id}>
      <header className="pkg-card-head">
        <h3>
          <span className="pkg-id">{pkg.id}</span> {pkg.title}
        </h3>
        <p className="muted-note">
          {fmtDate(SCENARIO.start_date)} start · {pkg.target_sites} participating sites · about {fmtEst(pkg.target_population_65plus)} adults aged 65+
        </p>
      </header>
      <div className="tiles four">
        <div className="tile">
          <span>Sites active</span>
          <b>
            {cp.sites_active} of {cp.sites_total}
          </b>
          <div className="exec-bar" role="img" aria-label={`${cp.sites_active} of ${cp.sites_total} sites active`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="tile">
          <span>Participating change</span>
          <b>{week === 0 ? '—' : unit(cp.treated_change ?? 0)}</b>
        </div>
        <div className="tile">
          <span>Comparison change</span>
          <b>{week === 0 ? '—' : unit(cp.comparison_change ?? 0)}</b>
        </div>
        <div className={`tile primary${week > 0 && diff > 0 ? ' positive' : ''}`}>
          <span>Comparative difference</span>
          <b>{week === 0 ? '—' : unit(diff)}</b>
          <em>{week === 0 ? 'Baseline' : diff === 0 ? 'No separation yet' : week === 2 ? 'Early' : week === 4 ? 'Early signal' : 'Favourable signal'}</em>
        </div>
      </div>
      <div className="pkg-card-body">
        <div className="pkg-chart">
          <p className="chart-subtitle">{METRIC_SUBTITLE[pkg.metric_type]}</p>
          <LineChart
            title={`${pkg.id}: participating versus comparison catchments`}
            desc={`Level of the measure at each review up to ${weekLabel(week)}. Later checkpoints are not shown.`}
            series={[
              { name: 'Participating', color: '#5b2ba6', points: weeks.map((w) => ({ x: w, y: packageAt(pkg, w).treated_level ?? 0 })) },
              { name: 'Comparison', color: '#0f8f8f', dash: '5 4', points: weeks.map((w) => ({ x: w, y: packageAt(pkg, w).comparison_level ?? 0 })) },
            ]}
            xTicks={WEEKS.map((w) => ({ x: w, label: w === 0 ? 'Baseline' : `+${w} wks` }))}
            yMin={Math.floor((lo - (hi - lo) * 0.1) / (isDose ? 100 : 5)) * (isDose ? 100 : 5)}
            yMax={Math.ceil((hi + (hi - lo) * 0.05) / (isDose ? 100 : 5)) * (isDose ? 100 : 5)}
            yFormat={(v) => (isDose ? fmtInt(v) : `${Math.round(v)}%`)}
            height={190}
          />
        </div>
        <div className="pkg-side">
          <p className="exec-text">{cp.execution}</p>
          {!isDose && (
            <p className="note">
              Efluelda share within enhanced dispensing: <b>{cp.efluelda_share_within_enhanced_pct}%</b> (enhanced doses are the denominator, not all flu doses).
            </p>
          )}
          <div className="next-decision">
            <div className="eyebrow">Next decision</div>
            <p>
              <b>{weekRecommendation(pkg, week, 'next')}</b>
            </p>
          </div>
        </div>
      </div>
      <details className="definitions">
        <summary>Definitions</summary>
        <ul className="plain">
          {DEFINITIONS.filter((_, i) => isDose || i !== 0).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/* ---------- table version for the review drawer and print ---------- */

export function PackageOutcome({ pkg, week, compact = false }: { pkg: Pkg; week: Week; compact?: boolean }) {
  const cp = packageAt(pkg, week);
  const base = packageAt(pkg, 0);
  const isDose = pkg.metric_type === 'dose_rate';
  const weeks = upTo(week);
  const pct = Math.round(((cp.sites_active ?? 0) / (cp.sites_total || 1)) * 100);
  return (
    <article className="outcome-card" data-package={pkg.id}>
      <header>
        <h3>
          <span className="pkg-id">{pkg.id}</span> {pkg.title}
        </h3>
        <p className="muted">
          Lead: {pkg.lead} · {pkg.target_sites} participating sites · about {fmtEst(pkg.target_population_65plus)} adults aged 65+ in the defined catchments
        </p>
      </header>
      <div className="exec">
        <div className="exec-bar" role="img" aria-label={`${cp.sites_active} of ${cp.sites_total} sites active`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="exec-count">
          Execution: {cp.sites_active} of {cp.sites_total} sites active
        </p>
        <p>{cp.execution}</p>
      </div>
      <table className="metric-table">
        <caption>{METRIC_SUBTITLE[pkg.metric_type]}</caption>
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
            <th scope="row">Participating catchments</th>
            <td>{fmtInt(base.treated_level)}{isDose ? '' : '%'}</td>
            <td>{fmtInt(cp.treated_level)}{isDose ? '' : '%'}</td>
            <td>{fmtChange(pkg, cp.treated_change ?? 0)}</td>
          </tr>
          <tr>
            <th scope="row">Comparison catchments</th>
            <td>{fmtInt(base.comparison_level)}{isDose ? '' : '%'}</td>
            <td>{fmtInt(cp.comparison_level)}{isDose ? '' : '%'}</td>
            <td>{fmtChange(pkg, cp.comparison_change ?? 0)}</td>
          </tr>
          <tr className="diff">
            <th scope="row">Comparative difference</th>
            <td colSpan={2} className="muted">
              (participating change) − (comparison change)
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
      {!isDose && <p className="note">Enhanced share uses all observed 65+ flu doses; the Efluelda share uses enhanced doses only.</p>}
      {!compact && weeks.length > 1 && (
        <LineChart
          title={`${pkg.id}: change from baseline`}
          desc={`Change from baseline at each review up to ${weekLabel(week)}.`}
          series={[
            { name: 'Participating', color: '#5b2ba6', points: weeks.map((w) => ({ x: w, y: packageAt(pkg, w).treated_change ?? 0 })) },
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
        <b>Comparison group.</b> {pkg.comparator}
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
          {c.packageIds.join(' + ')} · weighted by fixed target populations ({c.packageIds.map((id) => `${id}: ${fmtEst(PACKAGE_BY_ID.get(id)!.target_population_65plus)}`).join('; ')})
        </p>
      </header>
      <p className="big-diff">
        {fmtSigned(c.difference, 1)} <span>doses per 10,000 adults aged 65+</span>
      </p>
      <p className="note">
        Weighted participating change {fmtSigned(c.treatedChange, 1)} against weighted comparison change {fmtSigned(c.comparisonChange, 1)}: about {fmtEst(c.countDifference)} dispensing-proxy doses across {fmtEst(c.population)} adults. This is not a count of attributed vaccinations. Percentage-point measures are reported separately and never added to this figure.
      </p>
    </article>
  );
}

export const LIMITATIONS = [
  'Pharmacy dispensing is a proxy, not confirmed administration and not official coverage. Other professionals also administer vaccines.',
  'Comparison catchments help interpret seasonal movement; they do not establish causation. Cluster membership alone does not justify causal inference.',
  'Results belong to the participating catchments. They are not results for the whole department or the whole cluster.',
  'Other campaign activity, data completeness and delivery differences may explain part of any movement.',
  'The fortnightly refresh and three-day reporting lag are scenario assumptions; actual data access is unconfirmed.',
  'Official historical coverage is unchanged by the follow-up and may be reconciled later.',
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
          <b>Observations through</b> {fmtDate(d.data_through)}
        </span>
        <span>
          <b>Campaign</b> 2026–27
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
