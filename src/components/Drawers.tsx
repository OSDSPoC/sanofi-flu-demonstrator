import { useEffect, useRef } from 'react';
import { CLUSTER_BY_ID, DEPT_BY_CODE, PACKAGES, PACKAGE_BY_ID, PLAYBOOKS, PLAYBOOK_BY_ID, SOURCES, SOURCES_CUTOFF, UI } from '../lib/data';
import { fmtDate, fmtInt, weekLabel } from '../lib/calc';
import { iqviaCumulative, medicamPacks } from '../lib/history';
import type { PlanStatus } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { LineChart } from './charts';
import { planDiffers } from './Monitor';
import { LIMITATIONS, OutcomeBlock } from './Outcome';
import { Drawer, Glyph, Tag } from './ui';

/* ---------------- status ---------------- */
export function StatusDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="About this demonstrator" onClose={onClose} width={520}>
      <p>
        <b>{UI.prototype_label}.</b> This is a prototype built to show how a local cross-functional team could investigate a market, organise interventions and review results. It is not a Sanofi system and holds no Sanofi data.
      </p>
      <table className="plain-table">
        <tbody>
          <tr>
            <th scope="row"><Tag kind="public" /></th>
            <td>Official 2016–17 to 2025–26 departmental coverage, IQVIA public pharmacy series, Medic’AM reimbursed packs, HAS policy. Publisher, season and date are in each source detail.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="derived" /></th>
            <td>Calculated from public values with the formula shown, e.g. 75 − 56.7 = 18.3 pp.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="synthetic" /></th>
            <td>Populations, driver indexes, enhanced and Efluelda shares, activity logs and all 2026–27 monitoring values. Invented to illustrate a capability; not Sanofi performance.</td>
          </tr>
          <tr>
            <th scope="row"><Tag kind="simulated" /></th>
            <td>Expected uptake, residuals and cluster assignment. Precomputed and designed; not fitted from French data, and no accuracy statistics are claimed.</td>
          </tr>
        </tbody>
      </table>
      <ul className="plain">
        <li>The advisor shows scripted demonstration responses selected by area, mode and date. There is no live model, backend or connection to Sanofi documents.</li>
        <li>The 2026–27 dates are fictional scenario checkpoints. Differences are descriptive signals, not proven effects, and no revenue, margin or ROI is shown.</li>
        <li>HAS positions Efluelda and Fluad equivalently for adults aged 65+. This prototype does not compare them clinically.</li>
        <li>Illustrative playbooks are OpenSky-authored examples, not Sanofi documents.</li>
      </ul>
    </Drawer>
  );
}

/* ---------------- model ---------------- */
export function ModelDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer title="How this works" onClose={onClose} width={620}>
      <section className="model-part">
        <h3><span className="num">1</span> Analytical foundation</h3>
        <p>
          A production version would combine five families of evidence: <b>outcomes</b> (official coverage), <b>population and context</b>, <b>access and delivery</b>, <b>product and supply</b>, and <b>activity</b>. From these it would estimate expected uptake for each area and group similar areas by profile.
        </p>
        <p className="callout">
          In this demonstrator that step is <b>precomputed and illustrative</b>. Cluster membership, expected coverage and driver indexes are designed values, not fitted from French data. No feature-importance, accuracy or validation statistics are claimed.
        </p>
      </section>
      <section className="model-part">
        <h3><span className="num">2</span> Interactive workspace</h3>
        <p>Geographic exploration, cluster comparison, local evidence and intervention tracking sit in one place, so Public Affairs, Medical, Market Access and Commercial work from the same picture and make different decisions from it.</p>
      </section>
      <section className="model-part">
        <h3><span className="num">3</span> Interpretive advisor</h3>
        <p>The advisor would combine selected model outputs with policy, medical evidence and local playbooks to help the team reason about actions. Here its answers are scripted and selected by context; a person reviews every suggestion.</p>
        <p className="note">Reference documents shape interpretation. They are not automatically numeric model features.</p>
      </section>
      <section className="model-part">
        <h3>The four illustrative profiles</h3>
        <ul className="plain">
          {Array.from(CLUSTER_BY_ID.values()).map((c) => (
            <li key={c.id}>
              <Glyph id={c.id} /> <b>{c.name}.</b> {c.description}
            </li>
          ))}
        </ul>
        <p className="note">Members need not be geographically adjacent. Profiles organise local investigation; they do not claim causes.</p>
      </section>
    </Drawer>
  );
}

/* ---------------- sources ---------------- */
const GROUPS: { title: string; test: (t: string, p: string) => boolean }[] = [
  { title: 'Numeric public inputs', test: (t) => t === 'numeric_public' },
  { title: 'Policy, clinical and delivery references', test: (t) => t === 'public_reference' },
  { title: 'Synthetic and simulated layers', test: (t, p) => p === 'synthetic' && t !== 'illustrative_reference' },
  { title: 'Illustrative playbooks (OpenSky-authored examples)', test: (t) => t === 'illustrative_reference' },
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
      <p className="note">Research cutoff {fmtDate(SOURCES_CUTOFF)}. Each entry separates what it is used for from what it cannot support. Opening an entry never implies an internal Sanofi file was accessed.</p>
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
                    <Tag
                      kind={x.provenance === 'synthetic' ? (x.type === 'simulated_model' ? 'simulated' : 'synthetic') : 'public'}
                      label={x.provenance === 'not_acquired' ? 'Not acquired' : undefined}
                    />
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
      <p className="note">{PLAYBOOKS.length} illustrative playbooks are described locally above. They have no claim of Sanofi authorship or approval.</p>
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
      <p className="note">
        Real public series for context. They are not relabelled as live 2026 observations and are not used to estimate local intervention effects. <Tag kind="public" />
      </p>
      <h3>Pharmacy dispensing, adults 65+ — cumulative by campaign day</h3>
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
        Doses dispensed and pharmacy administration acts are different measures and are never summed. Their difference is not unvaccinated stock: other professionals can administer doses dispensed at pharmacies. Series are extrapolated panel estimates (IQVIA, last updated 26 February 2026); no brand or department detail; geographic scope wording is inconsistent in the publisher description.
      </p>
      <h3>Reimbursed packs by product family, October 2025 – February 2026 (preliminary)</h3>
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
        <thead><tr><th>Product family</th><th>Packs, Oct 2025 – Feb 2026</th></tr></thead>
        <tbody>
          {mc.map((m) => (
            <tr key={m.name}><th scope="row">{m.name}</th><td>{fmtInt(m.data.reduce((a, b) => a + b.packs, 0))}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        Reimbursed packs by reimbursement date, national, community pharmacy. They are not administered doses, not a validated 65+ market share, and not net Sanofi revenue. Pack sizes are not mapped to doses here. Vaxigrip and Efluelda are both Sanofi products. Source: Assurance Maladie Medic’AM.
      </p>
    </Drawer>
  );
}

/* ---------------- plan ---------------- */
const STEPS: { id: PlanStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'ready', label: 'Ready for team review' },
  { id: 'simulation', label: 'Simulation started' },
  { id: 'reviewed', label: 'Reviewed' },
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
  return (
    <Drawer title="Intervention plan" onClose={onClose} width={720}>
      <ol className="stepper" aria-label="Plan status">
        {STEPS.map((st, i) => (
          <li key={st.id} className={i === idx ? 'current' : i < idx ? 'done' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span>{i + 1}</span> {st.label}
          </li>
        ))}
      </ol>
      <p className="note">Illustrative packages for discussion. Nothing here is approved or medically validated. No organisation has agreed to participate. Printing never changes the status.</p>

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
          <input
            inputMode="decimal"
            placeholder="Blank by default"
            value={p.budget}
            onChange={(e) => dispatch({ type: 'updatePlan', patch: { budget: e.target.value } })}
          />
        </label>
        <label className="wide">
          Notes
          <textarea rows={3} value={p.notes} onChange={(e) => dispatch({ type: 'updatePlan', patch: { notes: e.target.value } })} placeholder="Optional notes for the team" />
        </label>
      </div>

      <h3>Prepared packages</h3>
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
                  {dep.name} ({dep.code}) · <Glyph id={pk.cluster_id} /> {CLUSTER_BY_ID.get(pk.cluster_id)!.name}
                </span>
              </label>
              <p className="pkg-meta">
                <b>Lead:</b> {pk.lead}. <b>Support:</b> {pk.support.join('; ')}.
              </p>
              <p className="pkg-meta">{pk.hypothesis}</p>
              <details>
                <summary>Actions, rationale and measurement</summary>
                <ul className="plain">{pk.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="note"><b>Rationale.</b> {pk.rationale}</p>
                <p className="note"><b>Measure.</b> {pk.primary_metric}.</p>
                <p className="note"><b>Footprint.</b> {pk.target_sites} illustrative sites, {fmtInt(pk.target_population_65plus)} people aged 65+. {pk.footprint_note}</p>
              </details>
            </div>
          );
        })}
      </div>

      <div className="plan-summary">
        <b>{selected.length}</b> package{selected.length === 1 ? '' : 's'} selected · <b>{sites}</b> illustrative sites · <b>{fmtInt(pop)}</b> people aged 65+ in fixed catchments · Budget: {p.budget ? `EUR ${p.budget} (user-entered draft)` : 'not set'}
      </div>

      {drift && s.snapshot && (
        <div className="drift" role="alert">
          <p>Your selection differs from the running simulation ({s.snapshot.packageIds.join(', ')}). Outcomes keep referring to that snapshot until you restart.</p>
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
            {s.snapshot ? 'Restart simulation with revised plan' : 'Start simulated follow-up'}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => { dispatch({ type: 'setMode', mode: 'monitor' }); onClose(); }}>
            Go to simulated follow-up
          </button>
        )}
        {s.snapshot && s.week > 0 && (
          <button type="button" className="btn" onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
            Print outcome review
          </button>
        )}
      </div>
      {!selected.length && <p className="note">Select at least one package to enable printing and simulated follow-up.</p>}
      <p className="note">“Start simulated follow-up” runs a labelled simulation of the 2026–27 campaign from a hypothetical 27 October 2026 start. It does not claim real-world approval.</p>
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
        <p>Start simulated follow-up from the plan to review outcomes.</p>
      </Drawer>
    );
  }
  const snap = s.snapshot;
  const pkgs = snap.packageIds.map((id) => PACKAGE_BY_ID.get(id)!);
  return (
    <Drawer title={`Outcome review — ${weekLabel(s.week)}`} onClose={onClose} width={820}>
      <p className="sim-flag inline">{UI.monitor_label}</p>
      <h3>{snap.title}</h3>
      <p className="note">Plan snapshot: {snap.packageIds.join(', ')}.</p>
      <OutcomeBlock ids={snap.packageIds} week={s.week} />
      {s.week >= 4 && (
        <section>
          <h3>{s.week === 6 ? 'Proposed changes for team review' : 'Interim reading'}</h3>
          {s.week === 6 ? (
            <ul className="plain">{pkgs.map((p) => <li key={p.id}><b>{p.id}.</b> {p.final_decision}</li>)}</ul>
          ) : (
            <p>Directional signals are emerging; hold judgement on changes until the +6 weeks comparative review.</p>
          )}
        </section>
      )}
      <section>
        <h3>Limitations</h3>
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
