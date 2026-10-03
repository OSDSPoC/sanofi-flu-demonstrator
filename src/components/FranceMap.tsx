import { useMemo, useState } from 'react';
import { geoConicConformal, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import geoRaw from '../assets/departements.geojson?raw';
import { DEPT_BY_CODE, CLUSTER_BY_ID, CLUSTER_GLYPH, METRO_DEPARTMENTS, PACKAGE_BY_ID } from '../lib/data';
import { ctxKey, fmtInt, fmtPct, opportunityOf } from '../lib/calc';
import type { ClusterId, Context, MapView, PackageId } from '../lib/types';

const W = 560;
const H = 580;

type Props = {
  view: MapView;
  ctx: Context;
  packageIds: PackageId[];
  packageMode: 'draft' | 'simulation';
  onSelectDepartment: (code: string) => void;
};

const geo = JSON.parse(geoRaw) as FeatureCollection<Geometry, { code: string; nom: string }>;

const projection = geoConicConformal().rotate([-3, 0]).parallels([44, 49]).fitExtent(
  [
    [8, 8],
    [W - 8, H - 8],
  ],
  geo,
);
const pathGen = geoPath(projection);

const features = geo.features.map((f) => ({
  code: f.properties.code,
  d: pathGen(f) ?? '',
  centroid: pathGen.centroid(f),
}));

const vcrValues = METRO_DEPARTMENTS.map((d) => d.historical.vcr_65plus).filter((v): v is number => v != null);
export const VCR_MIN = Math.floor(Math.min(...vcrValues));
export const VCR_MAX = Math.ceil(Math.max(...vcrValues));
const oppValues = METRO_DEPARTMENTS.map((d) => d.illustrative.unvaccinated_opportunity ?? 0);
export const OPP_MAX = Math.max(...oppValues);

function lerp(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Sequential scales (light -> dark) in the prototype palette.
const COVERAGE_LO = [236, 228, 250];
const COVERAGE_HI = [76, 29, 149];
const OPP_LO = [255, 240, 214];
const OPP_HI = [178, 84, 8];

export function coverageColor(v: number | null): string {
  if (v == null) return '#e5e7eb';
  const t = Math.min(1, Math.max(0, (v - VCR_MIN) / (VCR_MAX - VCR_MIN)));
  return lerp(COVERAGE_LO, COVERAGE_HI, t);
}
export function opportunityColor(v: number | null): string {
  if (v == null) return '#e5e7eb';
  const t = Math.min(1, Math.max(0, Math.sqrt(v / OPP_MAX)));
  return lerp(OPP_LO, OPP_HI, t);
}

export const PATTERN_ID: Record<ClusterId, string> = {
  access: 'pat-access',
  activation: 'pat-activation',
  enhanced: 'pat-enhanced',
  strong: 'pat-strong',
};

export function ClusterPatternDefs() {
  return (
    <defs>
      <pattern id={PATTERN_ID.access} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.55" />
      </pattern>
      <pattern id={PATTERN_ID.activation} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.1" fill="#fff" fillOpacity="0.65" />
      </pattern>
      <pattern id={PATTERN_ID.enhanced} width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 3.5H7M3.5 0V7" stroke="#fff" strokeWidth="1.1" strokeOpacity="0.55" />
      </pattern>
      <pattern id={PATTERN_ID.strong} width="6" height="6" patternUnits="userSpaceOnUse">
        <line x1="0" y1="3" x2="6" y2="3" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.55" />
      </pattern>
    </defs>
  );
}

export default function FranceMap({ view, ctx, packageIds, packageMode, onSelectDepartment }: Props) {
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const selectedCode = ctx.kind === 'department' ? ctx.code : null;
  const activeCluster: ClusterId | null =
    ctx.kind === 'cluster' ? ctx.id : selectedCode ? (DEPT_BY_CODE.get(selectedCode)?.illustrative.cluster_id ?? null) : null;

  const markers = useMemo(
    () =>
      packageIds
        .map((id) => PACKAGE_BY_ID.get(id)!)
        .map((p) => ({ id: p.id, f: features.find((f) => f.code === p.department_code) }))
        .filter((m) => m.f),
    [packageIds],
  );

  const hovered = hover ? DEPT_BY_CODE.get(hover.code) : null;

  return (
    <div className="map-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="france-map"
        role="group"
        aria-label="Map of metropolitan France by department. Select a department to update the evidence and advisor."
      >
        <ClusterPatternDefs />
        {features.map((f) => {
          const d = DEPT_BY_CODE.get(f.code);
          if (!d) return null;
          const cid = d.illustrative.cluster_id;
          let fill: string;
          if (view === 'coverage') fill = coverageColor(d.historical.vcr_65plus);
          else if (view === 'opportunity') fill = opportunityColor(opportunityOf(d));
          else fill = CLUSTER_BY_ID.get(cid)!.color;
          const muted = ctx.kind === 'cluster' ? cid !== ctx.id : false;
          const selected = selectedCode === f.code;
          const inCluster = activeCluster === cid;
          return (
            <g key={f.code}>
              <path
                d={f.d}
                fill={fill}
                className={`dept${selected ? ' selected' : ''}${muted ? ' muted' : ''}${d.featured ? ' featured' : ''}`}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                aria-label={`${d.name}, ${d.code}. 65+ coverage ${fmtPct(d.historical.vcr_65plus)}. Illustrative cluster: ${CLUSTER_BY_ID.get(cid)!.name}.`}
                onClick={() => onSelectDepartment(f.code)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDepartment(f.code);
                  }
                }}
                onMouseMove={(e) => {
                  const r = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setHover({ code: f.code, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onMouseLeave={() => setHover(null)}
                onFocus={(e) => {
                  const r = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
                  const b = e.currentTarget.getBoundingClientRect();
                  setHover({ code: f.code, x: b.left - r.left + b.width / 2, y: b.top - r.top });
                }}
                onBlur={() => setHover(null)}
              />
              {view === 'clusters' && (
                <path d={f.d} fill={`url(#${PATTERN_ID[cid]})`} className={`dept-pattern${muted ? ' muted' : ''}`} pointerEvents="none" />
              )}
              {inCluster && !selected && ctx.kind === 'department' && view !== 'clusters' && null}
            </g>
          );
        })}
        {/* selected boundary drawn last so the outline is not covered by neighbours */}
        {selectedCode && (
          <path d={features.find((f) => f.code === selectedCode)?.d} className="dept-outline" pointerEvents="none" />
        )}
        {markers.map((m) => (
          <g key={m.id} transform={`translate(${m.f!.centroid[0]},${m.f!.centroid[1]})`} pointerEvents="none">
            <circle r="13" className={`pkg-marker ${packageMode}`} />
            <text className="pkg-marker-text" textAnchor="middle" dy="4">
              {m.id}
            </text>
          </g>
        ))}
      </svg>
      {hover && hovered && (
        <div className="map-tip" style={{ left: Math.min(hover.x + 12, 380), top: Math.max(hover.y - 8, 0) }} role="tooltip">
          <strong>
            {hovered.name} <span className="muted">({hovered.code})</span>
          </strong>
          <div>
            65+ coverage 2025–26: <b>{fmtPct(hovered.historical.vcr_65plus)}</b> <span className="tag public">Public</span>
          </div>
          <div>
            <span className="glyph" style={{ background: CLUSTER_BY_ID.get(hovered.illustrative.cluster_id)!.color }}>
              {CLUSTER_GLYPH[hovered.illustrative.cluster_id]}
            </span>{' '}
            {CLUSTER_BY_ID.get(hovered.illustrative.cluster_id)!.name} <span className="tag synthetic">Illustrative</span>
          </div>
          {view === 'opportunity' && (
            <div>
              Illustrative opportunity: <b>{fmtInt(opportunityOf(hovered))}</b> people
            </div>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {ctxKey(ctx)}
      </span>
    </div>
  );
}
