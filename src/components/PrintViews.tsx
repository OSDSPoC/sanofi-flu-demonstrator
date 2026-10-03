import logo from '../assets/sanofi-logo.svg';
import { CLUSTER_BY_ID, DEPT_BY_CODE, NATIONAL, PACKAGE_BY_ID, SCENARIO, SOURCE_BY_ID, UI } from '../lib/data';
import { checkpointDates, fmtDate, fmtInt, fmtPct, gapTo75, packageAt, weekLabel } from '../lib/calc';
import { useApp } from '../state';
import { LIMITATIONS, OutcomeBlock } from './Outcome';

const STATUS_LABEL = { draft: 'Draft', ready: 'Ready for team review', simulation: 'Simulation started', reviewed: 'Reviewed' } as const;

function PrintHeader({ title, status }: { title: string; status: string }) {
  return (
    <header className="ph">
      <img src={logo} alt="Sanofi" width={84} height={23} />
      <div>
        <h1>{title}</h1>
        <p>
          France Influenza Uptake Intelligence · {UI.prototype_label} · {status}
        </p>
      </div>
    </header>
  );
}

function SourceList({ ids }: { ids: string[] }) {
  const uniq = Array.from(new Set(ids));
  return (
    <ul className="print-sources">
      {uniq.map((id) => {
        const s = SOURCE_BY_ID.get(id);
        if (!s) return null;
        return (
          <li key={id}>
            {s.title} — {s.provenance === 'synthetic' ? 'synthetic / illustrative' : s.provenance === 'not_acquired' ? 'not acquired' : 'public'}
            {s.url ? ` (${s.url})` : ''}
          </li>
        );
      })}
    </ul>
  );
}

function PlanPrint() {
  const s = useApp();
  const p = s.plan;
  const pkgs = p.packageIds.map((id) => PACKAGE_BY_ID.get(id)!);
  const depts = pkgs.map((k) => DEPT_BY_CODE.get(k.department_code)!);
  const cps = SCENARIO.checkpoints;
  const sources = pkgs.flatMap((k) => k.source_ids).concat(['spf_bulletin', 'has_policy', 'synthetic_model']);
  return (
    <div className="print-doc">
      <section className="print-page">
        <PrintHeader title={p.title || 'Intervention plan'} status={`Plan status: ${STATUS_LABEL[p.status]} (printing does not approve or start anything)`} />
        <p className="print-flag">Prototype for discussion. Public historical data plus synthetic scenarios and illustrative playbooks. Not a Sanofi plan or approval.</p>
        <table className="print-table kv">
          <tbody>
            <tr><th>Objective</th><td>{p.objective}</td></tr>
            <tr><th>Owner role</th><td>{p.owner}</td></tr>
            <tr><th>Selected areas</th><td>{depts.map((d) => `${d.name} (${d.code}) — ${CLUSTER_BY_ID.get(d.illustrative.cluster_id)!.name} (illustrative cluster)`).join('; ')}</td></tr>
            <tr><th>Start and reviews</th><td>Hypothetical start {fmtDate(SCENARIO.start_date)}; reviews {cps.filter((c) => c.week > 0).map((c) => `${fmtDate(c.review_date)} (+${c.week} weeks)`).join(', ')}. Fictional scenario checkpoints.</td></tr>
            <tr><th>Draft budget</th><td>{p.budget ? `EUR ${p.budget} (user-entered draft)` : 'Not set'}</td></tr>
            <tr><th>Notes</th><td className="notes">{p.notes || '—'}</td></tr>
          </tbody>
        </table>

        <h2>Historical evidence for selected areas (public, 2025–26)</h2>
        <table className="print-table">
          <thead>
            <tr><th>Department</th><th>65+ coverage</th><th>65–74</th><th>75+</th><th>Gap to 75%</th><th>Expected (simulated)</th></tr>
          </thead>
          <tbody>
            {depts.map((d) => (
              <tr key={d.code}>
                <td>{d.name} ({d.code})</td>
                <td>{fmtPct(d.historical.vcr_65plus)}</td>
                <td>{fmtPct(d.historical.vcr_65_74)}</td>
                <td>{fmtPct(d.historical.vcr_75plus)}</td>
                <td>{gapTo75(d)?.toFixed(1)} pp</td>
                <td>{fmtPct(d.illustrative.expected_vcr_65plus)}</td>
              </tr>
            ))}
            <tr><td>France, 65+ (France-wide)</td><td>{fmtPct(NATIONAL.vcr_65plus)}</td><td>—</td><td>—</td><td>{(75 - NATIONAL.vcr_65plus).toFixed(1)} pp</td><td>—</td></tr>
          </tbody>
        </table>

        <h2>Interventions, owners and footprint</h2>
        <table className="print-table">
          <thead>
            <tr><th>Package</th><th>Lead and support</th><th>Actions</th><th>Footprint (synthetic)</th></tr>
          </thead>
          <tbody>
            {pkgs.map((k) => (
              <tr key={k.id}>
                <td><b>{k.id}</b> {k.title}<br /><i>{k.hypothesis}</i></td>
                <td><b>{k.lead}</b><br />{k.support.join('; ')}</td>
                <td><ul>{k.actions.map((a) => <li key={a}>{a}</li>)}</ul></td>
                <td>{k.target_sites} illustrative sites; {fmtInt(k.target_population_65plus)} people aged 65+. Not department-wide.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-page">
        <PrintHeader title={`${p.title || 'Intervention plan'} — measurement and review`} status={`Plan status: ${STATUS_LABEL[p.status]}`} />
        <h2>Measurement definitions</h2>
        <table className="print-table">
          <thead>
            <tr><th>Package</th><th>Primary measure and denominator</th><th>Baseline (synthetic)</th><th>Comparator</th></tr>
          </thead>
          <tbody>
            {pkgs.map((k) => {
              const b = packageAt(k, 0);
              return (
                <tr key={k.id}>
                  <td><b>{k.id}</b></td>
                  <td>{k.primary_metric}. {k.metric_type === 'dose_rate' ? 'Doses per 10,000 people aged 65+; dispensing proxy, not official VCR or confirmed administration.' : 'Percentage of observed 65+ flu dispensing; separately, Efluelda share of enhanced dispensing (different denominator).'}</td>
                  <td>{fmtInt(b.treated_level)}{k.metric_type === 'dose_rate' ? ' doses/10,000' : '% enhanced share'}{k.metric_type === 'share_pct' ? `; Efluelda ${b.efluelda_share_within_enhanced_pct}% of enhanced` : ''}</td>
                  <td>{k.comparator}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="print-note">Comparative change difference = (treated change) − (comparison change). It is a descriptive signal, not proof of effect. Dose-rate and percentage-point measures are never added together.</p>

        <h2>Sources and refresh assumptions</h2>
        <p className="print-note">Fortnightly product refresh with a three-day lag is a demonstration assumption; actual Sanofi data access is unconfirmed. Official coverage may be reconciled later.</p>
        <SourceList ids={sources} />

        <h2>Questions for the team review</h2>
        <ul>
          <li>Is the barrier validated with local partners, and is this the right owner for each action?</li>
          <li>Are the footprint, baseline and comparison catchments agreed, and who records concurrent activity?</li>
          <li>What evidence of administration would be needed before attributing any uptake change?</li>
          <li>Which questions belong to Commercial (availability, Efluelda account execution) rather than Public Affairs?</li>
        </ul>

        <h2>Team decision</h2>
        <div className="decision-box">
          <p>☐ Proceed &nbsp;&nbsp; ☐ Proceed with changes &nbsp;&nbsp; ☐ Hold &nbsp;&nbsp; ☐ Do not proceed</p>
          <p className="lines">Comments</p>
          <div className="blank" />
          <p>Decision by: ______________________ &nbsp;&nbsp; Date: ______________</p>
        </div>
        <p className="print-note">Illustrative playbooks are OpenSky-authored examples, not Sanofi documents. Synthetic values are marked in the application.</p>
      </section>
    </div>
  );
}

function OutcomePrint() {
  const s = useApp();
  const snap = s.snapshot!;
  const pkgs = snap.packageIds.map((id) => PACKAGE_BY_ID.get(id)!);
  const d = checkpointDates(s.week);
  const sources = pkgs.flatMap((k) => k.source_ids).concat(['synthetic_activity', 'synthetic_commercial', 'spf_vcr']);
  return (
    <div className="print-doc">
      <section className="print-page flow">
        <PrintHeader title={`${snap.title} — outcome review`} status="Simulated 2026–27 campaign" />
        <p className="print-flag">Simulated 2026–27 campaign. All monitoring values are synthetic and the dates are fictional scenario checkpoints. Not forecasts, live data or demonstrated effects.</p>
        <table className="print-table kv">
          <tbody>
            <tr><th>Plan snapshot</th><td>{pkgs.map((k) => `${k.id} ${k.title}`).join('; ')}</td></tr>
            <tr><th>Review</th><td>{weekLabel(s.week)}: {fmtDate(d.review_date)}. Data through {fmtDate(d.data_through)}.</td></tr>
            <tr><th>Owner role</th><td>{snap.owner}</td></tr>
            <tr><th>Draft budget</th><td>{snap.budget ? `EUR ${snap.budget} (user-entered draft)` : 'Not set'}</td></tr>
          </tbody>
        </table>
        <OutcomeBlock ids={snap.packageIds} week={s.week} compact />
        <h2>Interpretation</h2>
        <p>The differences are directional comparative signals. Other activities, seasonality and selection differences may explain some movement. Category movement and brand performance are separate results.</p>
        {s.week >= 4 && (
          <>
            <h2>{s.week === 6 ? 'Proposed changes for team review' : 'Interim reading'}</h2>
            {s.week === 6 ? (
              <ul>{pkgs.map((k) => <li key={k.id}><b>{k.id}.</b> {k.final_decision}</li>)}</ul>
            ) : (
              <p>Hold judgement on changes until the +6 weeks comparative review.</p>
            )}
          </>
        )}
        <h2>Limitations</h2>
        <ul>{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
        <h2>Source references</h2>
        <SourceList ids={sources} />
      </section>
    </div>
  );
}

export default function PrintViews() {
  const s = useApp();
  if (!s.print) return null;
  return <div id="print-root">{s.print === 'plan' ? <PlanPrint /> : s.snapshot ? <OutcomePrint /> : null}</div>;
}
