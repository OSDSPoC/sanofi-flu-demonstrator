import { CLUSTER_BY_ID, DEPT_BY_CODE, METRO_DEPARTMENTS, NATIONAL } from '../lib/data';
import {
  GAP_TO_TARGET,
  NATIONAL_CHANGE_PP,
  checkpointDates,
  clusterStats,
  combinedDoseDifference,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtPp,
  fmtSigned,
  gapTo75,
  packageAt,
  scopedPackages,
  weekLabel,
} from '../lib/calc';
import { useApp } from '../state';
import { Tag } from './ui';

function Card({ label, value, sub, tag }: { label: string; value: string; sub: string; tag?: React.ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {label} {tag}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

export default function KpiStrip() {
  const s = useApp();
  if (s.mode === 'monitor' && s.snapshot) {
    const d = checkpointDates(s.week);
    const scoped = scopedPackages(s.ctx, s.snapshot.packageIds);
    const sitesActive = scoped.reduce((n, p) => n + (packageAt(p, s.week).sites_active ?? 0), 0);
    const sitesTotal = scoped.reduce((n, p) => n + (packageAt(p, s.week).sites_total ?? 0), 0);
    const dose = combinedDoseDifference(scoped.map((p) => p.id), s.week);
    const p3 = scoped.find((p) => p.metric_type === 'share_pct');
    const bothDose = dose && dose.packageIds.length === 2;
    return (
      <section className="kpis" aria-label="Simulated progress">
        <Card label="Simulated review" value={weekLabel(s.week)} sub={`${fmtDate(d.review_date)} · observations through ${fmtDate(d.data_through)}`} tag={<Tag kind="synthetic" />} />
        <Card
          label="Sites active"
          value={scoped.length ? `${sitesActive} of ${sitesTotal}` : '—'}
          sub={scoped.length ? `${scoped.map((p) => p.id).join(', ')} · execution status as of review date` : 'No selected intervention in this area'}
          tag={<Tag kind="synthetic" />}
        />
        <Card
          label={bothDose ? 'Comparative dispensing difference' : 'Comparative dispensing difference'}
          value={dose ? `${fmtSigned(dose.difference, bothDose ? 1 : 0)}` : '—'}
          sub={dose ? `doses per 10,000 people aged 65+ · ${bothDose ? 'P1 + P2 weighted by target population' : dose.packageIds.join(', ')}` : 'No uptake package in this area'}
          tag={<Tag kind="synthetic" />}
        />
        <Card
          label="Enhanced-category share difference"
          value={p3 ? `${fmtSigned(packageAt(p3, s.week).comparative_change_difference ?? 0)} pp` : '—'}
          sub={p3 ? 'P3 · share of observed 65+ flu dispensing; separate unit' : 'P3 not selected in this area'}
          tag={<Tag kind="synthetic" />}
        />
        <Card label="Official 2025–26 VCR" value={fmtPct(NATIONAL.vcr_65plus)} sub="Unchanged by the simulation · France-wide" tag={<Tag kind="public" />} />
      </section>
    );
  }

  let third: React.ReactNode;
  if (s.ctx.kind === 'france') {
    third = <Card label="Illustrative profiles" value="4" sub={`${METRO_DEPARTMENTS.length} metropolitan departments assigned`} tag={<Tag kind="simulated" label="Illustrative" />} />;
  } else if (s.ctx.kind === 'cluster') {
    const st = clusterStats(s.ctx.id);
    third = (
      <Card
        label="Selected profile"
        value={`${st.count} departments`}
        sub={`${CLUSTER_BY_ID.get(s.ctx.id)!.name} · observed ${fmtPct(st.min)}–${fmtPct(st.max)}`}
        tag={<Tag kind="simulated" label="Illustrative" />}
      />
    );
  } else {
    const dep = DEPT_BY_CODE.get(s.ctx.code)!;
    third = (
      <Card
        label="Selected department"
        value={fmtPct(dep.historical.vcr_65plus)}
        sub={`${dep.name} (${dep.code}) · ${fmtPp(gapTo75(dep)).replace(/^[+−]/, '')} below 75%`}
        tag={<Tag kind="public" />}
      />
    );
  }
  return (
    <section className="kpis" aria-label="Key figures">
      <Card
        label="Historical VCR, 65+, 2025–26"
        value={fmtPct(NATIONAL.vcr_65plus)}
        sub={`France-wide · ${fmtPp(NATIONAL_CHANGE_PP)} vs 2024–25 (${fmtPct(NATIONAL.previous_season_vcr_65plus)})`}
        tag={<Tag kind="public" />}
      />
      <Card label="Gap to 75% reference" value={`${GAP_TO_TARGET.toFixed(1)} pp`} sub="75 − 56.7 · policy benchmark, not a Sanofi target" tag={<Tag kind="derived" />} />
      {third}
    </section>
  );
}

export { fmtInt };
