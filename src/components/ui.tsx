import { useEffect, useRef, type ReactNode } from 'react';
import { CLUSTER_BY_ID, CLUSTER_GLYPH, SOURCE_BY_ID } from '../lib/data';
import type { ClusterId } from '../lib/types';
import { useDispatch } from '../state';

export type Prov = 'public' | 'synthetic' | 'derived' | 'simulated';

const PROV: Record<Prov, { label: string; title: string }> = {
  public: { label: 'Public', title: 'Public data: publisher, season and observation date are in the source details.' },
  synthetic: { label: 'Synthetic', title: 'Synthetic: invented to illustrate a capability; not Sanofi performance.' },
  derived: { label: 'Derived', title: 'Derived from public data: the formula is stated beside the value.' },
  simulated: { label: 'Simulated', title: 'Simulated model output: expected uptake, drivers or cluster assignment. Not a fitted model.' },
};

export function Tag({ kind, label }: { kind: Prov; label?: string }) {
  const p = PROV[kind];
  return (
    <span className={`tag ${kind}`} title={p.title}>
      {label ?? p.label}
    </span>
  );
}

export function Glyph({ id, size = 'sm' }: { id: ClusterId; size?: 'sm' | 'md' }) {
  const c = CLUSTER_BY_ID.get(id)!;
  return (
    <span className={`glyph ${size}`} style={{ background: c.color }} aria-hidden="true">
      {CLUSTER_GLYPH[id]}
    </span>
  );
}

export function SourceChips({ ids }: { ids: string[] }) {
  const dispatch = useDispatch();
  const seen = Array.from(new Set(ids));
  return (
    <div className="chips" aria-label="Sources">
      {seen.map((id) => {
        const s = SOURCE_BY_ID.get(id);
        const short = s ? s.title.split(' — ')[0].replace(/^SPF .*bulletin$/, 'SPF bulletin') : id;
        return (
          <button
            key={id}
            type="button"
            className={`chip ${s?.provenance === 'synthetic' ? 'synthetic' : s?.provenance === 'not_acquired' ? 'future' : 'public'}`}
            onClick={() => dispatch({ type: 'drawer', drawer: 'sources', sourceFocus: id })}
            title={s ? `${s.title} (${s.provenance === 'synthetic' ? 'synthetic' : s.provenance === 'not_acquired' ? 'not acquired' : 'public'})` : id}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

export function Drawer({ title, onClose, children, width = 560, label }: { title: string; onClose: () => void; children: ReactNode; width?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="drawer-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={label ?? title} ref={ref} tabIndex={-1}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function ValueBar({ value, max = 100, color, label, display, marker }: { value: number; max?: number; color?: string; label: string; display: string; marker?: number }) {
  return (
    <div className="vbar" role="img" aria-label={`${label}: ${display}${marker != null ? `; profile reference ${marker}` : ''}`}>
      <span className="vbar-label">{label}</span>
      <span className="vbar-track">
        <span className="vbar-fill" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
        {marker != null && <span className="vbar-marker" style={{ left: `${(marker / max) * 100}%` }} title={`Profile reference ${marker}`} />}
      </span>
      <span className="vbar-val">{display}</span>
    </div>
  );
}
