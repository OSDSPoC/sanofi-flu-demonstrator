import { useMemo, useState } from 'react';
import FranceMap, { OPP_MAX, VCR_MAX, VCR_MIN, coverageColor, opportunityColor } from './FranceMap';
import {
  CLUSTERS,
  CLUSTER_BY_ID,
  DEPARTMENTS,
  DEPT_BY_CODE,
  DRIVER_LABELS,
  DRIVER_SCALE,
  METRO_DEPARTMENTS,
  NATIONAL,
  UI,
  packageForDepartment,
} from '../lib/data';
import { GAP_TO_TARGET, NATIONAL_CHANGE_PP, clusterMembers, clusterStats, ctxClusterId, fmtEst, fmtPct, fmtPp, fmtSigned, gapTo75, metroOpportunityTotal } from '../lib/calc';
import { departmentSeries, medianSeries, seasonLabel, SEASONS } from '../lib/history';
import type { ClusterId, MapView } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { LineChart } from './charts';
import { Glyph, SourceChips, ValueBar } from './ui';

const VIEWS: { id: MapView; label: string }[] = [
  { id: 'coverage', label: 'Coverage' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'opportunity', label: 'Opportunity' },
];

/** Mean of each driver across all metropolitan departments (marker on profile comparisons). */
const ALL_MEAN = DRIVER_LABELS.map((l) => Math.round(METRO_DEPARTMENTS.reduce((s, d) => s + d.illustrative.driver_indexes[l.key], 0) / METRO_DEPARTMENTS.length));

/* ---------- breadcrumb + search ---------- */

export function Breadcrumb() {
  const s = useApp();
  const dispatch = useDispatch();
  const [q, setQ] = useState('');
  const cid = ctxClusterId(s.ctx);
  const metro = DEPARTMENTS.filter((d) => d.metropolitan);

  function pick(v: string) {
    setQ(v);
    const m = v.match(/\(([0-9AB]{2,3})\)\s*$/);
    const found = m ? metro.find((d) => d.code === m[1]) : metro.find((d) => d.name.toLowerCase() === v.trim().toLowerCase());
    if (found) {
      dispatch({ type: 'setContext', ctx: { kind: 'department', code: found.code }, mapView: 'clusters' });
      setQ('');
    }
  }

  return (
    <div className="crumb-row">
      <nav className="crumbs" aria-label="Selection">
        <button type="button" className={s.ctx.kind === 'france' ? 'current' : ''} aria-current={s.ctx.kind === 'france' ? 'page' : undefined} onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' }, mapView: 'coverage' })}>
          France
        </button>
        {cid && (
          <>
            <span aria-hidden="true">→</span>
            <button
              type="button"
              className={s.ctx.kind === 'cluster' ? 'current' : ''}
              aria-current={s.ctx.kind === 'cluster' ? 'page' : undefined}
              onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'cluster', id: cid }, mapView: 'clusters' })}
            >
              <Glyph id={cid} /> {CLUSTER_BY_ID.get(cid)!.name}
            </button>
          </>
        )}
        {s.ctx.kind === 'department' && (
          <>
            <span aria-hidden="true">→</span>
            <span className="current" aria-current="page">
              {DEPT_BY_CODE.get(s.ctx.code)?.name}
            </span>
          </>
        )}
      </nav>
      <label className="search">
        <span className="sr-only">Search departments</span>
        <input type="search" list="dept-list" placeholder="Search department" value={q} onChange={(e) => pick(e.target.value)} />
        <datalist id="dept-list">
          {metro.map((d) => (
            <option key={d.code} value={`${d.name} (${d.code})`} />
          ))}
        </datalist>
      </label>
    </div>
  );
}

/* ---------- legend ---------- */

function Legend({ view, small = false }: { view: MapView; small?: boolean }) {
  const s = useApp();
  const dispatch = useDispatch();
  if (view === 'coverage') {
    const stops = [0, 0.5, 1].map((t) => VCR_MIN + t * (VCR_MAX - VCR_MIN));
    return (
      <div className="legend">
        <h3>65+ coverage, 2025–26</h3>
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${coverageColor(VCR_MIN)}, ${coverageColor(VCR_MAX)})` }} />
        <div className="ramp-scale">
          {stops.map((v) => (
            <span key={v}>{Math.round(v)}%</span>
          ))}
        </div>
        {!small && <p className="legend-note">Reimbursement-based estimate by department. Darker means higher coverage.</p>}
      </div>
    );
  }
  if (view === 'opportunity') {
    return (
      <div className="legend">
        <h3>Unvaccinated adults 65+ (estimate)</h3>
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${opportunityColor(0)}, ${opportunityColor(OPP_MAX)})` }} />
        <div className="ramp-scale">
          <span>0</span>
          <span>{fmtEst(OPP_MAX)}</span>
        </div>
        {!small && <p className="legend-note">Estimated 65+ population × (1 − coverage). Metropolitan total about {fmtEst(metroOpportunityTotal())}.</p>}
      </div>
    );
  }
  const activeId = s.ctx.kind === 'cluster' ? s.ctx.id : ctxClusterId(s.ctx);
  return (
    <div className="legend">
      <h3>Clusters</h3>
      <ul className="legend-list">
        {CLUSTERS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`legend-item${activeId === c.id ? ' active' : ''}`}
              aria-pressed={activeId === c.id}
              onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'cluster', id: c.id }, mapView: 'clusters' })}
            >
              <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
              <Glyph id={c.id} />
              <span>{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- France overview ---------- */

function KpiStrip() {
  const vals = METRO_DEPARTMENTS.map((d) => d.historical.vcr_65plus).filter((v): v is number => v != null);
  const lo = METRO_DEPARTMENTS.find((d) => d.historical.vcr_65plus === Math.min(...vals))!;
  const hi = METRO_DEPARTMENTS.find((d) => d.historical.vcr_65plus === Math.max(...vals))!;
  return (
    <section className="kpis" aria-label="Key figures">
      <div className="kpi">
        <div className="kpi-label">65+ coverage, 2025–26</div>
        <div className="kpi-value">{fmtPct(NATIONAL.vcr_65plus)}</div>
        <div className="kpi-sub">France-wide · {fmtPp(NATIONAL_CHANGE_PP)} on 2024–25 ({fmtPct(NATIONAL.previous_season_vcr_65plus)})</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Gap to 75% reference</div>
        <div className="kpi-value">{GAP_TO_TARGET.toFixed(1)} pp</div>
        <div className="kpi-sub">75 − 56.7 · a policy benchmark, not a Sanofi target</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Range across departments</div>
        <div className="kpi-value">
          {fmtPct(Math.min(...vals))}–{fmtPct(Math.max(...vals))}
        </div>
        <div className="kpi-sub">
          {lo.name} to {hi.name} · 96 metropolitan departments
        </div>
      </div>
    </section>
  );
}

function FranceView() {
  const s = useApp();
  const dispatch = useDispatch();
  return (
    <>
      <KpiStrip />
      <section className="card map-card" aria-label="Map">
        <div className="map-toolbar">
          <div className="seg small" role="tablist" aria-label="Map view">
            {VIEWS.map((v) => (
              <button key={v.id} role="tab" type="button" aria-selected={s.mapView === v.id} className={s.mapView === v.id ? 'active' : ''} onClick={() => dispatch({ type: 'setMapView', view: v.id })}>
                {v.label}
              </button>
            ))}
          </div>
          <span className="map-hint">Metropolitan France including Corsica · the {fmtPct(NATIONAL.vcr_65plus)} headline is France-wide</span>
        </div>
        <button type="button" className="skip-link" onClick={() => (document.querySelector('.explore-btn') as HTMLElement | null)?.focus()}>
          Skip the map to the cluster list
        </button>
        <div className="france-grid">
          <FranceMap
            view={s.mapView}
            ctx={s.ctx}
            packageIds={s.mode === 'monitor' && s.snapshot ? s.snapshot.packageIds : s.plan.packageIds}
            packageMode={s.mode === 'monitor' ? 'followup' : 'draft'}
            onSelectDepartment={(code) => dispatch({ type: 'setContext', ctx: { kind: 'department', code }, mapView: 'clusters' })}
          />
          <aside className="france-side">
            <Legend view={s.mapView} />
            <div className="explore">
              <h3>Explore clusters</h3>
              <p className="muted-note">Group areas with similar conditions, then choose a shared approach.</p>
              <ul className="explore-list">
                {CLUSTERS.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="explore-btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'cluster', id: c.id }, mapView: 'clusters' })}>
                      <Glyph id={c.id} size="md" />
                      <span className="explore-name">{c.name}</span>
                      <span className="explore-count">{clusterStats(c.id).count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

/* ---------- cluster view ---------- */

function DriverBars({ values, color, markers, markerLabel }: { values: number[]; color: string; markers: number[]; markerLabel: string }) {
  return (
    <div>
      {DRIVER_LABELS.map((l, i) => (
        <ValueBar key={l.key} label={l.label} value={values[i]} display={`${values[i]}`} color={color} marker={markers[i]} />
      ))}
      <p className="note">
        Marker: {markerLabel}. {DRIVER_SCALE}.
      </p>
    </div>
  );
}

function ClusterView({ id }: { id: ClusterId }) {
  const s = useApp();
  const dispatch = useDispatch();
  const c = CLUSTER_BY_ID.get(id)!;
  const st = clusterStats(id);
  const fd = DEPT_BY_CODE.get(c.featured_department)!;
  const members = [...clusterMembers(id)].sort((a, b) => (a.historical.vcr_65plus ?? 0) - (b.historical.vcr_65plus ?? 0));
  return (
    <section className="card cluster-view" aria-label={`${c.name} profile`}>
      <div className="cluster-grid">
        <div className="locator">
          <FranceMap view="clusters" ctx={s.ctx} packageIds={[]} packageMode="draft" compact onSelectDepartment={(code) => dispatch({ type: 'setContext', ctx: { kind: 'department', code }, mapView: 'clusters' })} />
          <p className="locator-note">
            <Glyph id={id} /> {st.count} members highlighted. Members need not be neighbours.
          </p>
        </div>
        <div className="profile">
          <h2 className="panel-title">
            <Glyph id={id} size="md" /> {c.name}
          </h2>
          <p className="panel-lead">{c.description}</p>
          <div className="stat-row">
            <div>
              <b>{st.count}</b>
              <span>departments</span>
            </div>
            <div>
              <b>
                {fmtPct(st.min)}–{fmtPct(st.max)}
              </b>
              <span>observed coverage</span>
            </div>
            <div>
              <b>{fmtPct(st.medianVcr)}</b>
              <span>department median</span>
            </div>
          </div>
          <div className="profile-cols">
            <div>
              <h3 className="sub">Driver profile</h3>
              <DriverBars values={c.driver_template} color={c.color} markers={ALL_MEAN} markerLabel="average of all 96 departments" />
            </div>
            <div>
              <h3 className="sub">Shared approach</h3>
              <ul className="plain">
                {c.shared_approach.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="interp">{c.common_pattern}</p>
            </div>
          </div>
          <div className="row-actions">
            <button type="button" className="btn primary big" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: fd.code }, mapView: 'clusters' })}>
              Explore {fd.name}
            </button>
            <span className="muted-note">
              {c.default_package ? 'Worked local example for this profile' : 'Reference area for this profile'}
            </span>
          </div>
          <details className="more-evidence">
            <summary>Members, lowest coverage first</summary>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.code}>
                  <button type="button" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: m.code }, mapView: 'clusters' })}>
                    {m.name} <b>{fmtPct(m.historical.vcr_65plus)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}

/* ---------- department view ---------- */

function InterventionCard({ code }: { code: string }) {
  const s = useApp();
  const dispatch = useDispatch();
  const d = DEPT_BY_CODE.get(code)!;
  const c = CLUSTER_BY_ID.get(d.illustrative.cluster_id)!;
  const pkg = packageForDepartment(code);
  if (!pkg) {
    const fd = DEPT_BY_CODE.get(c.featured_department)!;
    return (
      <div className="intervention">
        <div className="eyebrow">{c.default_package ? 'Suggested approach' : 'Reference area'}</div>
        {c.default_package ? (
          <>
            <h3>{c.name} framework</h3>
            <ul className="plain">
              {c.shared_approach.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="note">No local package is prepared for {d.name}. Adapt the approach locally.</p>
            {fd.code !== code && (
              <button type="button" className="btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: fd.code }, mapView: 'clusters' })}>
                See the worked example: {fd.name}
              </button>
            )}
          </>
        ) : (
          <>
            <h3>No intervention proposed</h3>
            <p className="note">A reference for discussion, not a comparator for other areas.</p>
          </>
        )}
      </div>
    );
  }
  const inPlan = s.plan.packageIds.includes(pkg.id);
  return (
    <div className="intervention">
      <div className="eyebrow">Proposed intervention</div>
      <h3>{pkg.title}</h3>
      <p className="note strong">
        {pkg.target_sites} participating sites · about {fmtEst(pkg.target_population_65plus)} adults aged 65+
      </p>
      <p>{pkg.hypothesis}</p>
      <div className="row-actions">
        {inPlan ? (
          <span className="added" role="status">
            ✓ In plan
          </span>
        ) : (
          <button type="button" className="btn primary" onClick={() => dispatch({ type: 'addPackage', id: pkg.id })}>
            Add to plan
          </button>
        )}
        <button type="button" className={inPlan ? 'btn primary' : 'btn'} onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
          Review plan
        </button>
      </div>
    </div>
  );
}

function DepartmentView({ code }: { code: string }) {
  const s = useApp();
  const dispatch = useDispatch();
  const d = DEPT_BY_CODE.get(code)!;
  const c = CLUSTER_BY_ID.get(d.illustrative.cluster_id)!;
  const h = d.historical;
  const i = d.illustrative;
  const gap = gapTo75(d);
  const series = useMemo(() => departmentSeries(code), [code]);
  const med = useMemo(() => medianSeries(), []);
  const st = clusterStats(c.id);
  const vsNational = h.vcr_65plus != null ? h.vcr_65plus - NATIONAL.vcr_65plus : null;
  return (
    <section className="card dept-view" aria-label={`${d.name} evidence`}>
      <div className="dept-head">
        <h2 className="panel-title">
          {d.name} <span className="muted">({d.code})</span>
        </h2>
        <span className="cluster-pill">
          <Glyph id={c.id} /> {c.name}
        </span>
        <span className="muted-note">{d.region_name}</span>
      </div>
      <div className="dept-grid">
        <div className="locator">
          <FranceMap view="clusters" ctx={s.ctx} packageIds={[]} packageMode="draft" compact onSelectDepartment={(cd) => dispatch({ type: 'setContext', ctx: { kind: 'department', code: cd }, mapView: 'clusters' })} />
          <p className="locator-note">
            <Glyph id={c.id} /> {c.name}: {st.count} departments highlighted
          </p>
        </div>
        <div className="dept-main">
          <div className="tiles">
            <div className="tile primary">
              <span>65+ coverage, 2025–26</span>
              <b>{fmtPct(h.vcr_65plus)}</b>
              <em>{vsNational != null ? `${fmtPp(vsNational)} vs France-wide ${fmtPct(NATIONAL.vcr_65plus)}` : ''}</em>
            </div>
            <div className="tile">
              <span>Gap to 75% reference</span>
              <b>{gap != null ? `${gap.toFixed(1)} pp` : 'Unavailable'}</b>
            </div>
            <div className="tile">
              <span>Expected coverage</span>
              <b>{fmtPct(i.expected_vcr_65plus)}</b>
              <em>{fmtPp(i.observed_minus_expected_pp)} observed vs expected</em>
            </div>
          </div>
          <div className="dept-cols">
            <div>
              <h3 className="sub">Coverage by age</h3>
              <ValueBar label="Ages 65–74" value={h.vcr_65_74 ?? 0} display={fmtPct(h.vcr_65_74)} color="#5b2ba6" marker={75} />
              <ValueBar label="Ages 75+" value={h.vcr_75plus ?? 0} display={fmtPct(h.vcr_75plus)} color="#5b2ba6" marker={75} />
              <p className="note">Marker: 75% reference.</p>
              <h3 className="sub">Driver profile</h3>
              {DRIVER_LABELS.map((l, k) => (
                <ValueBar key={l.key} label={l.label} value={i.driver_indexes[l.key]} display={`${i.driver_indexes[l.key]}`} color={c.color} marker={c.driver_template[k]} />
              ))}
              <p className="note">Marker: {c.name} profile average.</p>
            </div>
            <InterventionCard code={code} />
          </div>
        </div>
      </div>
      <details className="more-evidence">
        <summary>More evidence</summary>
        <div className="more-grid">
          <div>
            <LineChart
              title={`${d.name}: 65+ coverage by season`}
              desc="Official 65+ influenza coverage by campaign season for the selected department and the median of metropolitan departments."
              series={[
                { name: d.name, color: '#5b2ba6', points: series.map((p) => ({ x: p.year, y: p.v })) },
                { name: 'Median of metropolitan departments', color: '#94a3b8', dash: '5 4', points: med.map((p) => ({ x: p.year, y: p.v })) },
              ]}
              xTicks={SEASONS.filter((y) => y % 2 === 0 || y === SEASONS[SEASONS.length - 1]).map((y) => ({ x: y, label: seasonLabel(y) }))}
              yFormat={(v) => `${Math.round(v)}%`}
              yMin={20}
              yMax={80}
              height={170}
            />
          </div>
          <div>
            <ValueBar label="Enhanced share of 65+ flu dispensing" value={i.enhanced_share_of_65plus_dispensing_pct} display={`${i.enhanced_share_of_65plus_dispensing_pct}%`} color="#E7A33E" />
            <ValueBar label="Efluelda share of enhanced dispensing" value={i.efluelda_share_of_enhanced_dispensing_pct} display={`${i.efluelda_share_of_enhanced_dispensing_pct}%`} color="#00A6A6" />
            <p className="note">Different denominators: all 65+ flu doses, then enhanced doses only.</p>
            <p className="note">
              Estimated 65+ population about {fmtEst(i.eligible_population_65plus)}; about {fmtEst(i.unvaccinated_opportunity)} not yet vaccinated (population × (1 − coverage)).
            </p>
            <div className="row-actions">
              <button type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'history' })}>
                Historical evidence
              </button>
            </div>
            <SourceChips ids={['spf_vcr', 'synthetic_model']} />
          </div>
        </div>
      </details>
    </section>
  );
}

/* ---------- plan workspace ---------- */

export function GeographyAndEvidence() {
  const s = useApp();
  return (
    <>
      <Breadcrumb />
      {s.ctx.kind === 'france' && <FranceView />}
      {s.ctx.kind === 'cluster' && <ClusterView id={s.ctx.id} />}
      {s.ctx.kind === 'department' && <DepartmentView code={s.ctx.code} />}
    </>
  );
}

export default function PlanWorkspace() {
  return (
    <>
      <div className="eyebrow-row">
        <span className="eyebrow">{UI.season_labels.plan}</span>
      </div>
      <GeographyAndEvidence />
    </>
  );
}

export { fmtSigned };
