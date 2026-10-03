export interface Series {
  name: string;
  color: string;
  dash?: string;
  points: { x: number; y: number | null }[];
}

export function LineChart({
  series,
  width = 460,
  height = 200,
  xTicks,
  xLabel,
  yLabel,
  yFormat = (v: number) => String(v),
  yMin,
  yMax,
  title,
  desc,
}: {
  series: Series[];
  width?: number;
  height?: number;
  xTicks: { x: number; label: string }[];
  xLabel?: string;
  yLabel?: string;
  yFormat?: (v: number) => string;
  yMin?: number;
  yMax?: number;
  title: string;
  desc: string;
}) {
  const m = { l: 46, r: 12, t: yLabel ? 26 : 10, b: 30 };
  const all = series.flatMap((s) => s.points.filter((p) => p.y != null).map((p) => p.y as number));
  const lo = yMin ?? Math.min(...all);
  const hi = yMax ?? Math.max(...all);
  const xs = xTicks.map((t) => t.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (width - m.l - m.r);
  const sy = (y: number) => height - m.b - ((y - lo) / (hi - lo || 1)) * (height - m.t - m.b);
  const yTicks = [0, 0.5, 1].map((t) => lo + t * (hi - lo));
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} width="100%">
        <title>{title}</title>
        <desc>{desc}</desc>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="axis">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.x} x={sx(t.x)} y={height - 10} textAnchor="middle" className="axis">
            {t.label}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.points.filter((p) => p.y != null) as { x: number; y: number }[];
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeDasharray={s.dash} strokeLinejoin="round" />
              {pts.length <= 12 &&
                pts.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="3.4" fill="#fff" stroke={s.color} strokeWidth="2" />)}
            </g>
          );
        })}
        {yLabel && (
          <text x={4} y={10} className="axis-title">
            {yLabel}
          </text>
        )}
        {xLabel && (
          <text x={width - m.r} y={height - 1} textAnchor="end" className="axis-title">
            {xLabel}
          </text>
        )}
      </svg>
      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2.6" strokeDasharray={s.dash} />
            </svg>{' '}
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
