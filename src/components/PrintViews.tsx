import logo from '../assets/opensky-logo.jpg';
import { CLUSTER_BY_ID, DEPT_BY_CODE, NATIONAL, PACKAGE_BY_ID, SCENARIO, SOURCE_BY_ID, UI } from '../lib/data';
import { checkpointDates, fmtDate, fmtEst, fmtPct, fmtInt, gapTo75, packageAt, weekLabel } from '../lib/calc';
import { STATUS_LABEL, useApp } from '../state';
import { DEFINITIONS, LIMITATIONS, OutcomeBlock } from './Outcome';

/** One short notice per document, in the header. */
function PrintHeader({ title, status }: { title: string; status: string }) {
  return (
    <header className="ph">
      <img src={logo} alt="OpenSky" width={99} height={40} />
      <div>
        <h1>{title}</h1>
        <p>
          France Influenza Uptake Intelligence · {status}
        </p>
        <p className="ph-notice">{UI.prototype_label}</p>
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
            {s.title}
            {s.url ? ` (${s.url})` : s.provenance === 'synthetic' ? ' (demonstration input)' : ''}
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
  const sources = pkgs.flatMap((k) => k.source_ids).concat(['spf_bulletin', 'spf_vcr']);
  return (
    <div className="print-doc">
      <section className="print-page">
        <PrintHeader title={p.title || 'Intervention plan'} status={`Plan status: ${STATUS_LABEL[p.status]}`} />
        <table className="print-table kv">
          <tbody>
            <tr><th>Objective</th><td>{p.objective}</td></tr>
            <tr><th>Owner role</th><td>{p.owner}</td></tr>
            <tr><th>Areas</th><td>{depts.map((d) => `${d.name} (${CLUSTER_BY_ID.get(d.illustrative.cluster_id)!.name})`).join('; ')}</td></tr>
            <tr><th>Dates</th><td>Start {fmtDate(SCENARIO.start_date)}; reviews {cps.filter((c) => c.week > 0).map((c) => `${fmtDate(c.review_date)} (+${c.week} weeks)`).join(', ')}.</td></tr>
            <tr><th>Budget</th><td>{p.budget ? `EUR ${p.budget} (entered by the team)` : 'Not set'}</td></tr>
            <tr><th>Notes</th><td className="notes">{p.notes || '—'}</td></tr>
          </tbody>
        </table>

        <h2>Why these areas</h2>
        <table className="print-table">
          <thead>
            <tr><th>Department</th><th>65+ coverage</th><th>65–74</th><th>75+</th><th>Gap to 75%</th><th>Rationale</th></tr>
          </thead>
          <tbody>
            {pkgs.map((k) => {
              const d = DEPT_BY_CODE.get(k.department_code)!;
              return (
                <tr key={k.id}>
                  <td>{d.name}</td>
                  <td>{fmtPct(d.historical.vcr_65plus)}</td>
                  <td>{fmtPct(d.historical.vcr_65_74)}</td>
                  <td>{fmtPct(d.historical.vcr_75plus)}</td>
                  <td>{gapTo75(d)?.toFixed(1)} pp</td>
                  <td>{k.rationale}</td>
                </tr>
              );
            })}
            <tr><td>France-wide, 65+</td><td>{fmtPct(NATIONAL.vcr_65plus)}</td><td>—</td><td>—</td><td>{(75 - NATIONAL.vcr_65plus).toFixed(1)} pp</td><td>Official 2025–26 estimate.</td></tr>
          </tbody>
        </table>

        {pkgs.map((k) => (
          <div key={k.id} className="print-pkg">
            <h2>
              {k.id} · {k.title}
            </h2>
            <p>
              <b>Hypothesis.</b> {k.hypothesis}
            </p>
            <table className="print-table">
              <thead>
                <tr><th>Action</th><th>Owner / support</th></tr>
              </thead>
              <tbody>
                {k.action_rows.map((r) => (
                  <tr key={r.action}>
                    <td>{r.action}</td>
                    <td>{r.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="print-note">
              <b>Footprint.</b> {k.target_sites} participating sites; about {fmtEst(k.target_population_65plus)} adults aged 65+ in the defined catchments. {k.footprint_note} {k.notes.join(' ')}
            </p>
          </div>
        ))}
      </section>

      <section className="print-page">
        <PrintHeader title={`${p.title || 'Intervention plan'}: measurement and review`} status={`Plan status: ${STATUS_LABEL[p.status]}`} />
        <h2>Measurement</h2>
        <table className="print-table">
          <thead>
            <tr><th>Package</th><th>Measure and denominator</th><th>Baseline</th><th>Comparison group</th></tr>
          </thead>
          <tbody>
            {pkgs.map((k) => {
              const b = packageAt(k, 0);
              return (
                <tr key={k.id}>
                  <td><b>{k.id}</b></td>
                  <td>
                    {k.metric_type === 'dose_rate'
                      ? 'Pharmacy-dispensing proxy: doses per 10,000 adults aged 65+ in fixed participating catchments. Not official coverage or confirmed administration.'
                      : 'Enhanced vaccines as a share of observed 65+ flu dispensing; separately, Efluelda’s share of enhanced dispensing (a different denominator).'}
                  </td>
                  <td>{k.metric_type === 'dose_rate' ? `${fmtInt(b.treated_level)} doses per 10,000` : `${b.treated_level}% enhanced share; Efluelda ${b.efluelda_share_within_enhanced_pct}% of enhanced`}</td>
                  <td>{k.comparator}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul className="print-defs">{DEFINITIONS.slice(3).map((d) => <li key={d}>{d}</li>)}</ul>

        <h2>Sources and refresh</h2>
        <p className="print-note">Fortnightly refresh with a three-day reporting lag is a scenario assumption; actual data access is unconfirmed. Official coverage may be reconciled later.</p>
        <SourceList ids={sources} />

        <h2>Questions for the team</h2>
        <ul>
          <li>Is the barrier validated with local partners, and is each action with the right owner?</li>
          <li>Are the footprint, baseline and comparison catchments agreed, and who records concurrent activity?</li>
          <li>What evidence of administration is needed before attributing any change?</li>
          <li>Which questions belong to Commercial, such as availability and Efluelda account execution?</li>
        </ul>

        <h2>Team decision</h2>
        <div className="decision-box">
          <p>☐ Proceed &nbsp;&nbsp; ☐ Proceed with changes &nbsp;&nbsp; ☐ Hold &nbsp;&nbsp; ☐ Do not proceed</p>
          <p className="lines">Comments</p>
          <div className="blank" />
          <p>Decision by: ______________________ &nbsp;&nbsp; Date: ______________</p>
        </div>
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
        <PrintHeader title={`${snap.title}: outcome review`} status="Follow-up review, campaign 2026–27" />
        <table className="print-table kv">
          <tbody>
            <tr><th>Plan snapshot</th><td>{pkgs.map((k) => `${k.id} ${k.title}`).join('; ')}</td></tr>
            <tr><th>Review</th><td>{weekLabel(s.week)}: {fmtDate(d.review_date)}. Observations through {fmtDate(d.data_through)}.</td></tr>
            <tr><th>Owner role</th><td>{snap.owner}</td></tr>
            <tr><th>Budget</th><td>{snap.budget ? `EUR ${snap.budget} (entered by the team)` : 'Not set'}</td></tr>
          </tbody>
        </table>
        <OutcomeBlock ids={snap.packageIds} week={s.week} compact />
        <h2>Interpretation</h2>
        <p>The differences are directional comparative signals for the team to discuss. Other activity, seasonality and delivery differences may explain some of the movement. Category movement and brand performance are separate results.</p>
        {s.week >= 4 && (
          <>
            <h2>{s.week === 6 ? 'Proposed adjustments for team review' : 'Interim reading'}</h2>
            {s.week === 6 ? (
              <ul>{pkgs.map((k) => <li key={k.id}><b>{k.id}.</b> {k.final_decision}</li>)}</ul>
            ) : (
              <p>Hold judgement on changes until the +6 weeks comparative review.</p>
            )}
          </>
        )}
        <h2>Evidence and assumptions</h2>
        <ul>{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
        <h2>Team decision</h2>
        <div className="decision-box">
          <p>☐ Continue as planned &nbsp;&nbsp; ☐ Adjust &nbsp;&nbsp; ☐ Consider extension to other areas &nbsp;&nbsp; ☐ Stop</p>
          <p className="lines">Comments</p>
          <div className="blank" />
          <p>Decision by: ______________________ &nbsp;&nbsp; Date: ______________</p>
        </div>
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
