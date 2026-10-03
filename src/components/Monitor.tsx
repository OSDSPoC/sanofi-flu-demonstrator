import { useEffect, useState } from 'react';
import { UI, PACKAGE_BY_ID, DEPT_BY_CODE } from '../lib/data';
import { checkpointDates, combinedDoseDifference, ctxLabel, fmtDate, fmtEst, fmtSigned, scopedPackages, weekLabel } from '../lib/calc';
import type { PackageId, Week } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { Breadcrumb, GeographyAndEvidence } from './PlanViews';
import { PackageCard, WEEK_NOTE } from './Outcome';

const WEEKS: Week[] = [0, 2, 4, 6];

export function planDiffers(a: string[], b: string[]) {
  return a.slice().sort().join() !== b.slice().sort().join();
}

/** Always-visible date strip, checkpoint controls and plan-drift warning. */
function DateStrip() {
  const s = useApp();
  const dispatch = useDispatch();
  const snap = s.snapshot!;
  const d = checkpointDates(s.week);
  const drift = planDiffers(s.plan.packageIds, snap.packageIds);
  const next = WEEKS[WEEKS.indexOf(s.week) + 1];
  return (
    <section className="card date-strip" aria-label="Review dates">
      <dl className="dates">
        <div>
          <dt>Campaign</dt>
          <dd>2026–27</dd>
        </div>
        <div>
          <dt>Review date</dt>
          <dd>
            {fmtDate(d.review_date)} <span className="muted">({weekLabel(s.week)})</span>
          </dd>
        </div>
        <div>
          <dt>Observations through</dt>
          <dd>{fmtDate(d.data_through)}</dd>
        </div>
      </dl>
      <div className="checkpoint-ctl">
        <div className="seg small" role="group" aria-label="Review checkpoint">
          {WEEKS.map((w) => (
            <button key={w} type="button" className={s.week === w ? 'active' : ''} aria-pressed={s.week === w} onClick={() => dispatch({ type: 'setWeek', week: w })}>
              {w === 0 ? 'Baseline' : `+${w} weeks`}
              <small>{fmtDate(checkpointDates(w).review_date).replace(' 2026', '')}</small>
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" disabled={next === undefined} onClick={() => next !== undefined && dispatch({ type: 'setWeek', week: next })}>
          {next === undefined ? 'Final review' : 'Next review'}
        </button>
      </div>
      {drift && (
        <div className="drift" role="alert">
          <p>
            <b>The plan has changed since follow-up started.</b> Results still describe {snap.packageIds.join(', ')}. The current draft has {s.plan.packageIds.length ? s.plan.packageIds.join(', ') : 'no packages'}.
          </p>
          <button type="button" className="btn primary" disabled={!s.plan.packageIds.length} onClick={() => dispatch({ type: 'startSimulation' })}>
            Restart follow-up with revised plan
          </button>
        </div>
      )}
    </section>
  );
}

function Results() {
  const s = useApp();
  const dispatch = useDispatch();
  const snap = s.snapshot!;
  const scoped = scopedPackages(s.ctx, snap.packageIds);
  const [picked, setPicked] = useState<PackageId | null>(null);
  const ids = scoped.map((p) => p.id);
  const current = picked && ids.includes(picked) ? picked : ids[0];
  useEffect(() => {
    if (picked && !ids.includes(picked)) setPicked(null);
  }, [ids.join(), picked]);

  if (!scoped.length) {
    return (
      <section className="card empty">
        <p>
          <b>No intervention was assigned here, so there is no intervention outcome to review.</b>
        </p>
        <div className="row-actions">
          {snap.packageIds.map((id) => {
            const p = PACKAGE_BY_ID.get(id)!;
            return (
              <button key={id} type="button" className="btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: p.department_code } })}>
                Review {id} · {DEPT_BY_CODE.get(p.department_code)?.name}
              </button>
            );
          })}
          <button type="button" className="btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' } })}>
            All packages
          </button>
        </div>
      </section>
    );
  }
  const pkg = PACKAGE_BY_ID.get(current as PackageId)!;
  const dose = scoped.filter((p) => p.metric_type === 'dose_rate').map((p) => p.id);
  const combined = dose.length === 2 && s.week > 0 ? combinedDoseDifference(dose, s.week) : null;
  return (
    <section className="results" aria-label="Package results">
      {scoped.length > 1 && (
        <div className="pkg-tabs" role="tablist" aria-label="Packages in follow-up">
          {scoped.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === current} className={p.id === current ? 'active' : ''} onClick={() => setPicked(p.id)}>
              <b>{p.id}</b> {p.title}
              <small>{DEPT_BY_CODE.get(p.department_code)?.name}</small>
            </button>
          ))}
        </div>
      )}
      <PackageCard pkg={pkg} week={s.week} />
      {combined && (
        <p className="combined-line">
          <b>Comparative dispensing difference for selected uptake packages ({combined.packageIds.join(' + ')}): {fmtSigned(combined.difference, 1)} per 10,000 adults aged 65+</b>, weighted by target population (about {fmtEst(combined.population)} adults). Percentage-point measures are reported separately.
        </p>
      )}
      <p className="week-note">{WEEK_NOTE[s.week]}</p>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'drawer', drawer: 'review' })}>
          Open outcome review
        </button>
        <button type="button" className="btn" disabled={s.week === 0} title={s.week === 0 ? 'Baseline has no outcomes to print' : ''} onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
          Print outcome review
        </button>
      </div>
    </section>
  );
}

export default function MonitorWorkspace() {
  const s = useApp();
  const dispatch = useDispatch();
  if (!s.snapshot) return null;
  const snap = s.snapshot;
  return (
    <>
      <div className="eyebrow-row">
        <span className="eyebrow">{UI.season_labels.monitor}</span>
      </div>
      <DateStrip />
      <div className="scope-row" role="group" aria-label="Scope">
        <span className="scope-label">Scope</span>
        <button type="button" className={s.ctx.kind === 'france' ? 'active' : ''} aria-pressed={s.ctx.kind === 'france'} onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' } })}>
          All packages
        </button>
        {snap.packageIds.map((id) => {
          const p = PACKAGE_BY_ID.get(id)!;
          const on = s.ctx.kind === 'department' && s.ctx.code === p.department_code;
          return (
            <button key={id} type="button" className={on ? 'active' : ''} aria-pressed={on} onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: p.department_code } })}>
              {id} · {DEPT_BY_CODE.get(p.department_code)?.name}
            </button>
          );
        })}
        <span className="muted-note">Viewing: {ctxLabel(s.ctx)}</span>
      </div>
      <Results />
      <details className="card geo-section">
        <summary>Geography and history</summary>
        <div className="geo-body">
          <GeographyAndEvidence />
        </div>
      </details>
    </>
  );
}

export { Breadcrumb };
