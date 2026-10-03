import { useEffect, useRef } from 'react';
import { CLUSTER_BY_ID, DEPT_BY_CODE, PACKAGES, PACKAGE_BY_ID, PLAYBOOKS, PLAYBOOK_BY_ID, SCENARIO, SOURCES, SOURCES_CUTOFF } from '../lib/data';
import { fmtDate, fmtEst, fmtInt, weekLabel } from '../lib/calc';
import { iqviaCumulative, medicamPacks } from '../lib/history';
import { STATUS_LABEL, useApp, useDispatch } from '../state';
import type { PlanStatus } from '../lib/types';
import { LineChart } from './charts';
import { planDiffers } from './Monitor';
import { LIMITATIONS, OutcomeBlock } from './Outcome';
import { Drawer, Glyph, Tag } from './ui';

/* ---------------- about this demonstrator ---------------- */
export function StatusDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="About this demonstrator" onClose={onClose} width={520}>
      <p>
        <b>Demonstrator · public and synthetic data.</b> This prototype shows how a local cross-functional team could investigate a market, organise interventions and review results. It is not a Sanofi system and holds no Sanofi data.
      </p>
      <table className="plain-table">
        <tbody>
          <tr>
            <th scope="row"><Tag kind="public" /></th>
            <td>Official 2016–17 to 2025–26 departmental coverage, the IQVIA public pharmacy series, Medic’AM reimbursed packs and HAS policy. Publisher, season and date are in each source entry.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="derived" /></th>
            <td>Calculated from public values with the formula shown, for example 75 − 56.7 = 18.3 pp.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="synthetic" /></th>
            <td>Estimated populations, driver scores, enhanced and Efluelda shares, activity logs and every 2026–27 follow-up value. Invented to show a capability; not Sanofi performance.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="simulated" /></th>
            <td>Expected coverage and cluster membership. Authored and precomputed, not fitted from French data; no accuracy statistics are claimed.</td>
          </tr>
        </tbody>
      </table>
      <ul className="plain">
        <li>The advisor gives prepared answers selected by area, mode and date. There is no live model, backend or connection to Sanofi documents.</li>
        <li>The 2026–27 dates are scenario checkpoints. Differences are signals for review, not proven effects, and no revenue, margin or ROI is shown.</li>
        <li>HAS positions Efluelda and Fluad equivalently for adults aged 65+. This prototype does not compare them clinically.</li>
        <li>Playbooks are OpenSky-authored examples, not Sanofi documents.</li>
      </ul>
      <p className="note">Open Sources for each dataset’s provenance, period and limitations.</p>
    </Drawer>
  );
}

/* ---------------- how this works ---------------- */
export function ModelDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="How this works" onClose={onClose} width={620}>
      <section className="model-part">
        <h3><span className="num">1</span> Analytical foundation</h3>
        <p>
          A production version would combine five families of evidence: <b>outcomes</b> (official coverage), <b>population and context</b>, <b>access and delivery</b>, <b>product and supply</b>, and <b>activity</b>. From these it would estimate expected coverage for each area and group similar areas into clusters.
        </p>
        <p className="callout">
          In this demonstrator that step is <b>authored and precomputed</b>. Cluster membership follows a documented rule using public coverage, the age profile and area type; driver scores and expected coverage are designed values. No feature-importance, accuracy or validation statistics are claimed.
        </p>
      </section>
      <section className="model-part">
        <h3><span className="num">2</span> Interactive workspace</h3>
        <p>Geographic exploration, cluster comparison, local evidence and intervention tracking sit in one place, so Public Affairs, Medical, Market Access and Commercial work from the same picture and make different decisions from it.</p>
      </section>
      <section className="model-part">
        <h3><span className="num">3</span> Interpretive advisor</h3>
        <p>The advisor would combine selected model outputs with policy, medical evidence and local playbooks to help the team reason about actions. Here its answers are prepared and selected by context; people review every suggestion.</p>
        <p className="note">Reference documents shape interpretation. They are not automatically numeric model features.</p>
      </section>
      <section className="model-part">
        <h3>The annual cycle</h3>
        <ol className="cycle">
          <li><b>Prepare</b> (before the campaign): understand coverage, group areas into clusters, choose a shared approach and plan a local package.</li>
          <li><b>Deliver</b> (in season): start the plan with participating sites and providers; record which sites are active.</li>
          <li><b>Review</b> (fortnightly): check execution first, then comparative dispensing signals; decide whether to adjust or extend. Lessons feed the next preparation cycle.</li>
        </ol>
      </section>
      <section className="model-part">
        <h3>The four clusters</h3>
        <ul className="plain">
          {Array.from(CLUSTER_BY_ID.values()).map((c) => (
            <li key={c.id}>
              <Glyph id={c.id} /> <b>{c.name}.</b> {c.description}
            </li>
          ))}
        </ul>
        <p className="note">Members need not be neighbours. Clusters organise local investigation; they do not establish causes.</p>
      </section>
    </Drawer>
  );
}

/* ---------------- sources ---------------- */
const GROUPS: { title: string; test: (t: string, p: string) => boolean }[] = [
  { title: 'Numeric public inputs', test: (t) => t === 'numeric_public' },
  { title: 'Policy, clinical and delivery references', test: (t) => t === 'public_reference' },
  { title: 'Synthetic and simulated layers', test: (t, p) => p === 'synthetic' && t !== 'illustrative_reference' },
  { title: 'Playbooks (OpenSky-authored examples)', test: (t) => t === 'illustrative_reference' },
  { title: 'Potential future sources (not acquired)', test: (t, p) => p === 'not_acquired' },
];

export function SourcesDrawer({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, [s.sourceFocus]);
  return (
    <Drawer title="Sources and data inventory" onClose={onClose} width={680}>
      <p className="note">
        Research cutoff {fmtDate(SOURCES_CUTOFF)}. Each entry separates what it is used for from what it cannot support. The follow-up refresh (fortnightly, with a three-day reporting lag) is a scenario assumption; no live feed from GERS or any Sanofi system is implied.
      </p>
      {GROUPS.map((g) => {
        const items = SOURCES.filter((x) => g.test(x.type, x.provenance));
        if (!items.length) return null;
        return (
          <section key={g.title} className="src-group">
            <h3>{g.title}</h3>
            {items.map((x) => {
              const focus = s.sourceFocus === x.id;
              const pb = PLAYBOOK_BY_ID.get(x.id);
              return (
                <div key={x.id} ref={focus ? focusRef : undefined} className={`src${focus ? ' focus' : ''}`} id={`src-${x.id}`}>
                  <h4>
                    {x.title}{' '}
                    <Tag kind={x.provenance === 'synthetic' ? (x.type === 'simulated_model' ? 'simulated' : 'synthetic') : 'public'} label={x.provenance === 'not_acquired' ? 'Not acquired' : undefined} />
                  </h4>
                  <dl>
                    <dt>Purpose</dt><dd>{x.purpose}</dd>
                    <dt>Owner / geography</dt><dd>{x.owner} · {x.geography}</dd>
                    <dt>Period</dt><dd>{x.period}</dd>
                    <dt>Cadence</dt><dd>{x.cadence}</dd>
                    <dt>Limitation</dt><dd>{x.limitation}</dd>
                  </dl>
                  {x.url && (
                    <a href={x.url} target="_blank" rel="noreferrer noopener">
                      Open source ↗
                    </a>
                  )}
                  {pb && (
                    <div className="playbook">
                      <p className="note"><b>{pb.status}.</b></p>
                      <ul className="plain">{pb.rules.map((r) => <li key={r}>{r}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="note">{PLAYBOOKS.length} playbooks are described locally above. They carry no claim of Sanofi authorship or approval.</p>
    </Drawer>
  );
}

/* ---------------- historical evidence ---------------- */
export function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const a24 = iqviaCumulative('2024-2025', 'DOSES(J07E1)');
  const a25 = iqviaCumulative('2025-2026', 'DOSES(J07E1)');
  const s24 = iqviaCumulative('2024-2025', 'ACTE(VGP)');
  const s25 = iqviaCumulative('2025-2026', 'ACTE(VGP)');
  const k = (v: number) => v / 1000;
  const ticks = [1, 30, 60, 90, 120].map((x) => ({ x, label: `Day ${x}` }));
  const fam = [
    { name: 'Efluelda', re: /EFLUELDA/i, color: '#5b2ba6' },
    { name: 'Fluad', re: /FLUAD/i, color: '#E7A33E' },
    { name: 'Vaxigrip', re: /^VAXIGRIP/i, color: '#00A6A6' },
    { name: 'Influvac', re: /INFLUVAC/i, color: '#4777B6' },
    { name: 'Flucelvax', re: /FLUCELVAX/i, color: '#94a3b8' },
  ];
  const mc = fam.map((f) => ({ ...f, data: medicamPacks(f.re) }));
  const months = mc[0].data.map((d, i) => ({ x: i, label: d.month.slice(2).replace('-', '/') }));
  return (
    <Drawer title="Historical evidence" onClose={onClose} width={720}>
      <p className="note">Public series for context. They are not 2026 observations and are not used to estimate local intervention effects.</p>
      <h3>Pharmacy dispensing, adults 65+: cumulative by campaign day</h3>
      <LineChart
        title="Cumulative pharmacy doses dispensed to adults 65+ by campaign day"
        desc="Cumulative doses (J07E1) in thousands, 2024–25 and 2025–26 campaigns, by elapsed campaign day."
        series={[
          { name: '2024–25', color: '#94a3b8', points: a24.map((p) => ({ x: p.jour, y: k(p.v) })) },
          { name: '2025–26', color: '#5b2ba6', points: a25.map((p) => ({ x: p.jour, y: k(p.v) })) },
        ]}
        xTicks={ticks}
        yFormat={(v) => `${Math.round(v / 1000)}M`}
        yLabel="Doses dispensed (millions)"
        height={210}
      />
      <LineChart
        title="Cumulative pharmacy vaccination acts for adults 65+ by campaign day"
        desc="Cumulative pharmacy administration acts (VGP) in thousands, 2024–25 and 2025–26 campaigns, by elapsed campaign day."
        series={[
          { name: '2024–25', color: '#94a3b8', points: s24.map((p) => ({ x: p.jour, y: k(p.v) })) },
          { name: '2025–26', color: '#0f8f8f', points: s25.map((p) => ({ x: p.jour, y: k(p.v) })) },
        ]}
        xTicks={ticks}
        yFormat={(v) => `${Math.round(v / 1000)}M`}
        yLabel="Pharmacy acts (millions)"
        height={210}
      />
      <p className="note">
        Doses dispensed and pharmacy administration acts are different measures and are never summed. Their difference is not unvaccinated stock: other professionals can administer doses dispensed at pharmacies. Series are extrapolated panel estimates (IQVIA, last updated 26 February 2026) with no brand or department detail.
      </p>
      <h3>Reimbursed packs by product family, October 2025 to February 2026 (preliminary)</h3>
      <LineChart
        title="Monthly reimbursed packs by product family"
        desc="Monthly reimbursed pack counts for five influenza product families from Assurance Maladie Medic'AM, October 2025 to February 2026."
        series={mc.map((m) => ({ name: m.name, color: m.color, points: m.data.map((d, i) => ({ x: i, y: d.packs / 1000 })) }))}
        xTicks={months}
        yFormat={(v) => `${Math.round(v)}k`}
        yLabel="Reimbursed packs (thousands)"
        height={220}
      />
      <table className="plain-table">
        <thead><tr><th>Product family</th><th>Packs, Oct 2025 to Feb 2026</th></tr></thead>
        <tbody>
          {mc.map((m) => (
            <tr key={m.name}><th scope="row">{m.name}</th><td>{fmtInt(m.data.reduce((a, b) => a + b.packs, 0))}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        Reimbursed packs by reimbursement date, national, community pharmacy. They are not administered doses, not a validated 65+ market share and not net Sanofi revenue. Pack sizes are not mapped to doses. Vaxigrip and Efluelda are both Sanofi products. Source: Assurance Maladie Medic’AM.
      </p>
    </Drawer>
  );
}

/* ---------------- intervention plan ---------------- */
const STEPS: { id: PlanStatus; label: string }[] = [
  { id: 'draft', label: STATUS_LABEL.draft },
  { id: 'ready', label: STATUS_LABEL.ready },
  { id: 'followup', label: STATUS_LABEL.followup },
  { id: 'reviewed', label: STATUS_LABEL.reviewed },
];

export function PlanDrawer({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const dispatch = useDispatch();
  const p = s.plan;
  const selected = p.packageIds.map((id) => PACKAGE_BY_ID.get(id)!);
  const sites = selected.reduce((n, x) => n + x.target_sites, 0);
  const pop = selected.reduce((n, x) => n + x.target_population_65plus, 0);
  const idx = STEPS.findIndex((x) => x.id === p.status);
  const drift = s.snapshot ? planDiffers(p.packageIds, s.snapshot.packageIds) : false;
  const cps = SCENARIO.checkpoints.filter((c) => c.week > 0);
  return (
    <Drawer title="Intervention plan" onClose={onClose} width={740}>
      <ol className="stepper" aria-label="Plan status">
        {STEPS.map((st, i) => (
          <li key={st.id} className={i === idx ? 'current' : i < idx ? 'done' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span>{i + 1}</span> {st.label}
          </li>
        ))}
      </ol>
      <p className="note">A proposal for a cross-functional team meeting. The team can challenge it, change it or decide not to proceed. Printing does not change the status.</p>

      <h3 className="plan-title">{p.title || 'Intervention plan'}</h3>
      {selected.length === 0 ? (
        <div className="empty-plan">
          <p>
            <b>No package selected yet.</b> Open an area, such as Seine-Saint-Denis, and add its proposed intervention, or choose one under Other intervention options below.
          </p>
        </div>
      ) : (
        selected.map((pk) => {
          const dep = DEPT_BY_CODE.get(pk.department_code)!;
          return (
            <section key={pk.id} className="plan-pkg">
              <h4>
                <span className="pkg-id">{pk.id}</span> {pk.title}
              </h4>
              <dl className="plan-facts">
                <div>
                  <dt>Area</dt>
                  <dd>
                    {dep.name} · <Glyph id={pk.cluster_id} /> {CLUSTER_BY_ID.get(pk.cluster_id)!.name}
                  </dd>
                </div>
                <div>
                  <dt>Footprint</dt>
                  <dd>
                    {pk.target_sites} participating sites · about {fmtEst(pk.target_population_65plus)} adults aged 65+ in the defined catchments
                  </dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>
                    Start {fmtDate(SCENARIO.start_date)} · reviews {cps.map((c) => fmtDate(c.review_date).replace(' 2026', '')).join(', ')}
                  </dd>
                </div>
              </dl>
              <p>
                <b>Hypothesis.</b> {pk.hypothesis}
              </p>
              <h5>Actions</h5>
              <ol className="actions-list">
                {pk.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
              <h5>Owners</h5>
              <ul className="roles">
                {pk.roles.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p>
                <b>Measure.</b> {pk.primary_metric}. Review execution after two weeks, then comparative signals at four and six weeks.
              </p>
            </section>
          );
        })
      )}
      <div className="plan-summary">
        <b>{selected.length}</b> package{selected.length === 1 ? '' : 's'} · <b>{sites}</b> participating sites · about <b>{fmtEst(pop)}</b> adults aged 65+ · Budget: {p.budget ? `EUR ${p.budget} (entered by the team)` : 'not set'}
      </div>

      {drift && s.snapshot && (
        <div className="drift" role="alert">
          <p>Your selection differs from the follow-up in progress ({s.snapshot.packageIds.join(', ')}). Results keep describing that snapshot until you restart.</p>
        </div>
      )}

      <div className="drawer-actions">
        <button type="button" className="btn" disabled={!selected.length} onClick={() => dispatch({ type: 'print', target: 'plan' })}>
          Print plan / Save PDF
        </button>
        {!s.snapshot && (
          <button type="button" className="btn" disabled={!selected.length || p.status === 'ready'} onClick={() => dispatch({ type: 'setStatus', status: 'ready' })}>
            {p.status === 'ready' ? 'Marked ready for team review' : 'Mark ready for team review'}
          </button>
        )}
        {!s.snapshot || drift ? (
          <button type="button" className="btn primary" disabled={!selected.length} onClick={() => dispatch({ type: 'startSimulation' })}>
            {s.snapshot ? 'Restart follow-up with revised plan' : 'Start follow-up'}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => { dispatch({ type: 'setMode', mode: 'monitor' }); onClose(); }}>
            Go to follow-up
          </button>
        )}
        {s.snapshot && s.week > 0 && (
          <button type="button" className="btn" onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
            Print outcome review
          </button>
        )}
      </div>
      {!selected.length && <p className="note">Add a package to enable printing and follow-up.</p>}
      <p className="note">Starting follow-up runs the 2026–27 review scenario inside this prototype from a 27 October 2026 start. It is not an approval or an instruction to anyone.</p>

      <details className="fold">
        <summary>Edit plan details</summary>
        <div className="form-grid">
          <label>
            Plan title
            <input value={p.title} onChange={(e) => dispatch({ type: 'updatePlan', patch: { title: e.target.value } })} />
          </label>
          <label>
            Owner role
            <input value={p.owner} onChange={(e) => dispatch({ type: 'updatePlan', patch: { owner: e.target.value } })} />
          </label>
          <label className="wide">
            Objective
            <textarea rows={2} value={p.objective} onChange={(e) => dispatch({ type: 'updatePlan', patch: { objective: e.target.value } })} />
          </label>
          <label>
            Draft budget (optional, EUR)
            <input inputMode="decimal" placeholder="Blank by default" value={p.budget} onChange={(e) => dispatch({ type: 'updatePlan', patch: { budget: e.target.value } })} />
          </label>
          <label className="wide">
            Notes
            <textarea rows={3} value={p.notes} onChange={(e) => dispatch({ type: 'updatePlan', patch: { notes: e.target.value } })} placeholder="Optional notes for the team" />
          </label>
        </div>
      </details>

      <details className="fold">
        <summary>Other intervention options</summary>
        <div className="pkg-list">
          {PACKAGES.map((pk) => {
            const on = p.packageIds.includes(pk.id);
            const dep = DEPT_BY_CODE.get(pk.department_code)!;
            return (
              <div key={pk.id} className={`pkg${on ? ' on' : ''}`}>
                <label className="pkg-head">
                  <input type="checkbox" checked={on} onChange={() => dispatch({ type: 'togglePackage', id: pk.id })} />
                  <span className="pkg-id">{pk.id}</span>
                  <b>{pk.title}</b>
                  <span className="muted">
                    {dep.name} · <Glyph id={pk.cluster_id} /> {CLUSTER_BY_ID.get(pk.cluster_id)!.name}
                  </span>
                </label>
                <p className="pkg-meta">{pk.hypothesis}</p>
              </div>
            );
          })}
        </div>
      </details>
    </Drawer>
  );
}

/* ---------------- outcome review ---------------- */
export function ReviewDrawer({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const dispatch = useDispatch();
  if (!s.snapshot) {
    return (
      <Drawer title="Outcome review" onClose={onClose}>
        <p>Start follow-up from the plan to review outcomes.</p>
      </Drawer>
    );
  }
  const snap = s.snapshot;
  const pkgs = snap.packageIds.map((id) => PACKAGE_BY_ID.get(id)!);
  return (
    <Drawer title={`Outcome review: ${weekLabel(s.week)}`} onClose={onClose} width={820}>
      <h3>{snap.title}</h3>
      <p className="note">Plan snapshot: {snap.packageIds.join(', ')}.</p>
      <OutcomeBlock ids={snap.packageIds} week={s.week} />
      {s.week >= 4 && (
        <section>
          <h3>{s.week === 6 ? 'Proposed adjustments for team review' : 'Interim reading'}</h3>
          {s.week === 6 ? (
            <ul className="plain">{pkgs.map((p) => <li key={p.id}><b>{p.id}.</b> {p.final_decision}</li>)}</ul>
          ) : (
            <p>Directional signals are emerging; hold judgement on changes until the +6 weeks comparative review.</p>
          )}
        </section>
      )}
      <section>
        <h3>Evidence and assumptions</h3>
        <ul className="plain">{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
      <div className="drawer-actions">
        <button type="button" className="btn primary" disabled={s.week === 0} onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
          Print outcome review
        </button>
      </div>
    </Drawer>
  );
}

export { fmtInt };
