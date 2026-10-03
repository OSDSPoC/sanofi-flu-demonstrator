import { CLUSTER_BY_ID, DEPT_BY_CODE, DRIVER_LABELS, DRIVER_SCALE, METRO_DEPARTMENTS, NATIONAL, PACKAGE_BY_ID, PACKAGES } from '../lib/data';
import { clusterMembers, clusterStats, fmtInt, fmtPct, fmtPp, gapTo75, round1 } from '../lib/calc';
import { departmentSeries, medianSeries, seasonLabel, SEASONS } from '../lib/history';
import type { ClusterId, Department } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { LineChart } from './charts';
import { Glyph, SourceChips, Tag, ValueBar } from './ui';

const TEMPLATE_KEYS: (keyof Department['illustrative']['driver_indexes'])[] = [
  'access_index',
  'hcp_engagement_index',
  'confidence_index',
  'availability_index',
  'recommendation_index',
];

function FranceEvidence() {
  const dispatch = useDispatch();
  const rows = [
    {
      title: 'Total uptake',
      q: 'Which eligible people remain unreached?',
      fn: 'Public Affairs, Medical, providers and partners',
      data: `France-wide 65+ coverage was ${fmtPct(NATIONAL.vcr_65plus)} in 2025–26, ${(75 - NATIONAL.vcr_65plus).toFixed(1)} pp below the 75% reference.`,
    },
    {
      title: 'Enhanced-vaccine adoption',
      q: 'Where is the 65+ recommendation translating unevenly into practice?',
      fn: 'Public Affairs, Medical, Market Access',
      data: 'HAS recommends Efluelda and Fluad preferentially for adults 65+, with equivalent positioning. Local adoption shares here are synthetic.',
    },
    {
      title: 'Sanofi performance',
      q: 'How is Efluelda performing within the category, and what warrants investigation?',
      fn: 'Commercial, Sales, Marketing, Market Access',
      data: 'Public reimbursed-pack signals are national only (not doses, not 65+ share). Vaxigrip is also a Sanofi product.',
    },
  ];
  return (
    <>
      <h2 className="panel-title">France overview</h2>
      <p className="panel-lead">One evidence base, three different decisions. They are related but must stay separate.</p>
      <div className="three-cols">
        {rows.map((r) => (
          <div key={r.title} className="opp">
            <h3>{r.title}</h3>
            <p className="opp-q">{r.q}</p>
            <p>{r.data}</p>
            <p className="opp-fn">
              <b>Functions:</b> {r.fn}
            </p>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'drawer', drawer: 'history' })}>
          Open historical evidence (IQVIA, Medic’AM)
        </button>
      </div>
      <SourceChips ids={['spf_bulletin', 'spf_vcr', 'has_policy', 'synthetic_model']} />
    </>
  );
}

function ClusterEvidence({ id }: { id: ClusterId }) {
  const dispatch = useDispatch();
  const c = CLUSTER_BY_ID.get(id)!;
  const st = clusterStats(id);
  const members = [...clusterMembers(id)].sort((a, b) => (a.historical.vcr_65plus ?? 0) - (b.historical.vcr_65plus ?? 0));
  const pkg = c.default_package ? PACKAGE_BY_ID.get(c.default_package) : null;
  return (
    <>
      <h2 className="panel-title">
        <Glyph id={id} size="md" /> {c.name} <Tag kind="simulated" label="Illustrative cluster" />
      </h2>
      <p className="panel-lead">{c.description}</p>
      <div className="two-cols">
        <div>
          <h3 className="sub">What defines this profile</h3>
          <ul className="plain">{c.defining_features.map((f) => <li key={f}>{f}</li>)}</ul>
          <h3 className="sub">Potentially influenceable inputs</h3>
          <ul className="plain">{c.potentially_influenceable.map((f) => <li key={f}>{f}</li>)}</ul>
          <h3 className="sub">Contextual characteristics</h3>
          <ul className="plain">{c.context.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
        <div>
          <h3 className="sub">Observed 2025–26 coverage in members <Tag kind="public" /></h3>
          <p className="big-range">
            {fmtPct(st.min)}–{fmtPct(st.max)} <span className="muted">department median {fmtPct(st.medianVcr)}</span>
          </p>
          <p className="note">A range and median of department estimates, not a cluster coverage rate: no compatible population denominators are available.</p>
          <h3 className="sub">Driver profile <Tag kind="synthetic" /></h3>
          {DRIVER_LABELS.map((dl) => {
            const idx = TEMPLATE_KEYS.indexOf(dl.key);
            return <ValueBar key={dl.key} label={dl.label} value={c.driver_template[idx]} display={`${c.driver_template[idx]}`} color={c.color} />;
          })}
          <p className="note">{DRIVER_SCALE}. Designed values, not feature importance or causal effects.</p>
        </div>
      </div>
      <h3 className="sub">Members, lowest observed coverage first</h3>
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.code}>
            <button type="button" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: m.code } })}>
              {m.name} <span className="muted">{m.code}</span> <b>{fmtPct(m.historical.vcr_65plus)}</b>
            </button>
          </li>
        ))}
      </ul>
      <p className="interp">
        <b>Reading.</b> {c.interpretation}
      </p>
      <div className="applic">
        <b>Intervention applicability:</b>{' '}
        {pkg ? (
          <>
            Prepared package {pkg.id} — {pkg.title} (illustrative catchments in {DEPT_BY_CODE.get(pkg.department_code)?.name}).{' '}
            <button type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
              Open plan
            </button>
          </>
        ) : (
          'No bespoke package. Use as a reference profile for discussion, not as a causal comparator.'
        )}
      </div>
      <SourceChips ids={['spf_vcr', 'synthetic_model']} />
    </>
  );
}

function DepartmentEvidence({ code }: { code: string }) {
  const s = useApp();
  const dispatch = useDispatch();
  const d = DEPT_BY_CODE.get(code)!;
  const c = CLUSTER_BY_ID.get(d.illustrative.cluster_id)!;
  const h = d.historical;
  const i = d.illustrative;
  const pkg = PACKAGES.find((p) => p.department_code === code);
  const series = departmentSeries(code);
  const med = medianSeries();
  const selected = s.plan.packageIds.includes(pkg?.id as never);
  const gap = gapTo75(d);
  const ageBars: [string, number | null][] = [
    ['Adults 65+', h.vcr_65plus],
    ['Age 65–74', h.vcr_65_74],
    ['Age 75+', h.vcr_75plus],
  ];
  return (
    <>
      <h2 className="panel-title">
        {d.name} <span className="muted">({d.code})</span>
        <span className="title-tags">
          <Glyph id={c.id} size="md" /> {c.name} <Tag kind="simulated" label="Illustrative cluster" />
        </span>
      </h2>
      <p className="panel-lead">
        {d.region_name}. Actual 2025–26 coverage among adults aged 65+: <b>{fmtPct(h.vcr_65plus)}</b> <Tag kind="public" />
        {gap != null && (
          <>
            {' '}· {gap.toFixed(1)} pp below the 75% reference <Tag kind="derived" />
          </>
        )}
      </p>
      <div className="two-cols">
        <div>
          <h3 className="sub">Historical coverage and comparison <Tag kind="public" /></h3>
          {ageBars.map(([l, v]) => (
            <ValueBar key={l} label={l} value={v ?? 0} max={100} display={fmtPct(v)} color="#5b2ba6" />
          ))}
          <ValueBar label="France, 65+ (France-wide)" value={NATIONAL.vcr_65plus} display={fmtPct(NATIONAL.vcr_65plus)} color="#94a3b8" />
          <ValueBar label="Reference target" value={75} display="75%" color="#cbd5e1" />
          <p className="note">
            Observed minus illustrative expected: <b>{fmtPp(i.observed_minus_expected_pp)}</b> (expected {fmtPct(i.expected_vcr_65plus)}) <Tag kind="simulated" />. Formula: observed − model expectation.
          </p>
          <LineChart
            title={`${d.name}: 65+ coverage by season`}
            desc="Line chart of official 65+ influenza coverage by campaign season for the selected department and the median of metropolitan departments."
            series={[
              { name: d.name, color: '#5b2ba6', points: series.map((p) => ({ x: p.year, y: p.v })) },
              { name: 'Median of metropolitan departments', color: '#94a3b8', dash: '5 4', points: med.map((p) => ({ x: p.year, y: p.v })) },
            ]}
            xTicks={SEASONS.filter((y) => y % 2 === 0 || y === SEASONS[SEASONS.length - 1]).map((y) => ({ x: y, label: seasonLabel(y) }))}
            yFormat={(v) => `${Math.round(v)}%`}
            yMin={20}
            yMax={80}
            height={190}
          />
        </div>
        <div>
          <h3 className="sub">Potentially influenceable inputs <Tag kind="synthetic" /></h3>
          {DRIVER_LABELS.filter((x) => x.influenceable).map((dl) => {
            const idx = TEMPLATE_KEYS.indexOf(dl.key);
            const v = i.driver_indexes[dl.key];
            return <ValueBar key={dl.key} label={dl.label} value={v} display={`${v}`} color={c.color} marker={c.driver_template[idx]} />;
          })}
          <p className="note">Tick marks show the profile's designed reference value. {DRIVER_SCALE}. Associations to investigate, not causes.</p>
          <h3 className="sub">Contextual characteristics <Tag kind="synthetic" /></h3>
          <ValueBar label="Public confidence" value={i.driver_indexes.confidence_index} display={`${i.driver_indexes.confidence_index}`} color="#94a3b8" />
          <p className="note">
            Synthetic 65+ population {fmtInt(i.eligible_population_65plus)}; illustrative opportunity {fmtInt(i.unvaccinated_opportunity)} people (population × (1 − coverage)).
          </p>
          <h3 className="sub">Category and brand signals <Tag kind="synthetic" /></h3>
          <ValueBar label="Enhanced share of 65+ flu dispensing" value={i.enhanced_share_of_65plus_dispensing_pct} display={`${i.enhanced_share_of_65plus_dispensing_pct}%`} color="#E7A33E" />
          <ValueBar label="Efluelda share of enhanced dispensing" value={i.efluelda_share_of_enhanced_dispensing_pct} display={`${i.efluelda_share_of_enhanced_dispensing_pct}%`} color="#00A6A6" />
          <p className="note">Different denominators: all 65+ flu doses, then enhanced doses only. Category movement is not brand movement.</p>
        </div>
      </div>
      <div className="applic">
        <b>Intervention applicability:</b>{' '}
        {pkg ? (
          <>
            {pkg.id} — {pkg.title}: {pkg.hypothesis} Footprint: illustrative participating catchments ({pkg.target_sites} sites), not the whole department.{' '}
            <button type="button" className="btn small" onClick={() => dispatch({ type: 'togglePackage', id: pkg.id })} disabled={false}>
              {selected ? `Remove ${pkg.id} from plan` : `Add ${pkg.id} to plan`}
            </button>{' '}
            <button type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
              Open plan
            </button>
          </>
        ) : d.featured ? (
          'Reference profile. No intervention is assigned, and this department is not automatically a valid comparator.'
        ) : (
          <>
            No department-specific package. Cluster-level approach: {c.potentially_influenceable.join('; ').toLowerCase()}. This is a cluster-level interpretation, not a local dossier.
          </>
        )}
      </div>
      <SourceChips ids={['spf_vcr', 'synthetic_model', 'synthetic_commercial']} />
    </>
  );
}

export default function EvidencePanel() {
  const s = useApp();
  return (
    <section className="card evidence" aria-label="Selected-context evidence" aria-live="polite">
      {s.ctx.kind === 'france' && <FranceEvidence />}
      {s.ctx.kind === 'cluster' && <ClusterEvidence id={s.ctx.id} />}
      {s.ctx.kind === 'department' && <DepartmentEvidence code={s.ctx.code} />}
    </section>
  );
}

export { METRO_DEPARTMENTS, round1 };
