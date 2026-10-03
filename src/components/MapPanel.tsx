import { useState } from 'react';
import FranceMap, { OPP_MAX, VCR_MAX, VCR_MIN, coverageColor, opportunityColor, PATTERN_ID } from './FranceMap';
import { CLUSTERS, CLUSTER_GLYPH, DEPARTMENTS, DEPT_BY_CODE, FEATURED, CLUSTER_BY_ID } from '../lib/data';
import { clusterStats, ctxClusterId, fmtInt, fmtPct, metroOpportunityTotal } from '../lib/calc';
import type { MapView } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { Glyph } from './ui';

const VIEWS: { id: MapView; label: string }[] = [
  { id: 'coverage', label: 'Coverage' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'opportunity', label: 'Opportunity' },
];

function Legend({ view }: { view: MapView }) {
  const s = useApp();
  const dispatch = useDispatch();
  if (view === 'coverage') {
    const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => VCR_MIN + t * (VCR_MAX - VCR_MIN));
    return (
      <div className="legend">
        <h3>65+ coverage 2025–26 <span className="tag public">Public</span></h3>
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${coverageColor(VCR_MIN)}, ${coverageColor(VCR_MAX)})` }} />
        <div className="ramp-scale">
          {stops.map((v) => (
            <span key={v}>{Math.round(v)}%</span>
          ))}
        </div>
        <p className="legend-note">Reimbursement-based estimate, by department. Darker = higher coverage. National figure is France-wide.</p>
      </div>
    );
  }
  if (view === 'opportunity') {
    return (
      <div className="legend">
        <h3>Illustrative opportunity <span className="tag synthetic">Synthetic</span></h3>
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${opportunityColor(0)}, ${opportunityColor(OPP_MAX)})` }} />
        <div className="ramp-scale">
          <span>0</span>
          <span>{fmtInt(OPP_MAX / 4)}</span>
          <span>{fmtInt(OPP_MAX)}</span>
        </div>
        <p className="legend-note">
          Synthetic 65+ population × (1 − historical coverage). People not covered, not a validated opportunity score. Metropolitan total {fmtInt(metroOpportunityTotal())}.
        </p>
      </div>
    );
  }
  const activeId = s.ctx.kind === 'cluster' ? s.ctx.id : null;
  return (
    <div className="legend">
      <h3>Illustrative cluster <span className="tag simulated">Illustrative</span></h3>
      <ul className="legend-list">
        {CLUSTERS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`legend-item${activeId === c.id ? ' active' : ''}`}
              aria-pressed={activeId === c.id}
              onClick={() => dispatch({ type: 'setContext', ctx: activeId === c.id ? { kind: 'france' } : { kind: 'cluster', id: c.id } })}
            >
              <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
                <rect width="26" height="18" rx="3" fill={c.color} />
                <rect width="26" height="18" rx="3" fill={`url(#${PATTERN_ID[c.id]})`} />
              </svg>
              <Glyph id={c.id} />
              <span>{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="legend-note">Fixed, designed assignment — not a fitted French model. Members need not be adjacent.</p>
    </div>
  );
}

export default function MapPanel() {
  const s = useApp();
  const dispatch = useDispatch();
  const [q, setQ] = useState('');
  const metroOpts = DEPARTMENTS.filter((d) => d.metropolitan);
  const overseas = DEPARTMENTS.filter((d) => !d.metropolitan);
  const cid = ctxClusterId(s.ctx);

  function pickFromSearch(v: string) {
    setQ(v);
    const m = v.match(/\(([0-9AB]{2,3})\)\s*$/);
    const code = m?.[1];
    const found = code ? metroOpts.find((d) => d.code === code) : metroOpts.find((d) => d.name.toLowerCase() === v.trim().toLowerCase());
    if (found) {
      dispatch({ type: 'setContext', ctx: { kind: 'department', code: found.code } });
      setQ('');
    }
  }

  return (
    <section className="card map-card" aria-label="Map">
      <div className="map-toolbar">
        <div className="seg small" role="tablist" aria-label="Map view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={s.mapView === v.id}
              className={s.mapView === v.id ? 'active' : ''}
              onClick={() => dispatch({ type: 'setMapView', view: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Search departments</span>
          <input
            type="search"
            list="dept-list"
            placeholder="Search department"
            value={q}
            onChange={(e) => pickFromSearch(e.target.value)}
          />
          <datalist id="dept-list">
            {metroOpts.map((d) => (
              <option key={d.code} value={`${d.name} (${d.code})`} />
            ))}
          </datalist>
        </label>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' } })}>
          France overview
        </button>
      </div>

      <nav className="crumbs" aria-label="Selection">
        <button type="button" className={s.ctx.kind === 'france' ? 'current' : ''} onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' } })}>
          France
        </button>
        {cid && (
          <>
            <span aria-hidden="true">›</span>
            <button
              type="button"
              className={s.ctx.kind === 'cluster' ? 'current' : ''}
              onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'cluster', id: cid } })}
            >
              <Glyph id={cid} /> {CLUSTER_BY_ID.get(cid)!.name}
            </button>
          </>
        )}
        {s.ctx.kind === 'department' && (
          <>
            <span aria-hidden="true">›</span>
            <span className="current">
              {DEPT_BY_CODE.get(s.ctx.code)?.name} ({s.ctx.code})
            </span>
          </>
        )}
      </nav>

      <div className="featured-row" role="group" aria-label="Featured departments">
        <span className="featured-label">Featured</span>
        {FEATURED.map((d) => (
          <button
            key={d.code}
            type="button"
            className={`feat${s.ctx.kind === 'department' && s.ctx.code === d.code ? ' active' : ''}`}
            aria-pressed={s.ctx.kind === 'department' && s.ctx.code === d.code}
            onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: d.code } })}
          >
            <Glyph id={d.illustrative.cluster_id} />
            {d.name} <span className="muted">{d.code}</span> <b>{fmtPct(d.historical.vcr_65plus)}</b>
          </button>
        ))}
      </div>

      <button type="button" className="skip-link" onClick={() => (document.querySelector('.ccard') as HTMLElement | null)?.focus()}>
        Skip the map (96 departments) to the profile cards
      </button>
      <div className="map-body">
        <FranceMap
          view={s.mapView}
          ctx={s.ctx}
          packageIds={s.mode === 'monitor' && s.snapshot ? s.snapshot.packageIds : s.plan.packageIds}
          packageMode={s.mode === 'monitor' ? 'simulation' : 'draft'}
          onSelectDepartment={(code) => dispatch({ type: 'setContext', ctx: { kind: 'department', code } })}
        />
        <div className="map-side">
          <Legend view={s.mapView} />
          <p className="scope-note">
            <b>Scope.</b> Map: 96 metropolitan departments including Corsica. The 56.7% headline is France-wide.
            {overseas.length > 0 && ` ${overseas.length} overseas departments (${overseas.map((d) => d.code).join(', ')}) are in the data but not drawn.`}
          </p>
          {(s.mode === 'monitor' || s.plan.packageIds.length > 0) && (
            <p className="scope-note">
              <span className="marker-key">P</span> Circles mark illustrative participating catchments for {s.mode === 'monitor' ? 'the simulated packages' : 'draft packages'}; not department-wide coverage.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ClusterCards() {
  const s = useApp();
  const dispatch = useDispatch();
  return (
    <section className="cluster-cards" aria-label="Illustrative profiles">
      {CLUSTERS.map((c) => {
        const st = clusterStats(c.id);
        const active = (s.ctx.kind === 'cluster' && s.ctx.id === c.id) || (s.ctx.kind === 'department' && ctxClusterId(s.ctx) === c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`ccard${active ? ' active' : ''}`}
            style={{ ['--cc' as string]: c.color }}
            aria-pressed={s.ctx.kind === 'cluster' && s.ctx.id === c.id}
            onClick={() => dispatch({ type: 'setContext', ctx: s.ctx.kind === 'cluster' && s.ctx.id === c.id ? { kind: 'france' } : { kind: 'cluster', id: c.id } })}
          >
            <span className="ccard-head">
              <Glyph id={c.id} size="md" />
              <span className="ccard-name">{c.name}</span>
            </span>
            <span className="ccard-line">
              <b>{st.count}</b> departments
            </span>
            <span className="ccard-line">
              Observed 65+ coverage <b>{fmtPct(st.min)}–{fmtPct(st.max)}</b>
            </span>
            <span className="ccard-line">
              Illustrative opportunity <b>{fmtInt(st.opportunity)}</b> people
            </span>
            <span className="ccard-desc">{c.description}</span>
            <span className="ccard-tag">Illustrative cluster · {CLUSTER_GLYPH[c.id]}</span>
          </button>
        );
      })}
    </section>
  );
}
