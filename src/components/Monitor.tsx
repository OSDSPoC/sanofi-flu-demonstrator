import { UI } from '../lib/data';
import { checkpointDates, ctxLabel, fmtDate, scopedPackages, weekLabel } from '../lib/calc';
import type { Week } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { OutcomeBlock } from './Outcome';
import { Tag } from './ui';

const WEEKS: Week[] = [0, 2, 4, 6];

export function planDiffers(a: string[], b: string[]) {
  return a.slice().sort().join() !== b.slice().sort().join();
}

/** Simulation banner, checkpoint control and plan-drift warning. */
export function MonitorBar() {
  const s = useApp();
  const dispatch = useDispatch();
  if (!s.snapshot) return null;
  const snap = s.snapshot;
  const drift = planDiffers(s.plan.packageIds, snap.packageIds);
  const next = WEEKS[WEEKS.indexOf(s.week) + 1];
  return (
    <section className="card monitor-bar" aria-label="Simulation controls">
      <div className="sim-banner">
        <div>
          <span className="sim-flag">{UI.monitor_label}</span>
          <span className="sim-sub">
            Hypothetical intervention start 27 October 2026. Fictional scenario checkpoints, not forecasts or live observations. <Tag kind="synthetic" />
          </span>
        </div>
        <div className="checkpoint-ctl">
          <div className="seg small" role="group" aria-label="Review checkpoint">
            {WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                className={s.week === w ? 'active' : ''}
                aria-pressed={s.week === w}
                onClick={() => dispatch({ type: 'setWeek', week: w })}
              >
                {w === 0 ? 'Baseline' : `+${w} weeks`}
                <small>{fmtDate(checkpointDates(w).review_date).replace(' 2026', '')}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={next === undefined}
            onClick={() => next !== undefined && dispatch({ type: 'setWeek', week: next })}
          >
            {next === undefined ? 'Final checkpoint' : `Fast-forward to ${weekLabel(next)}`}
          </button>
        </div>
      </div>
      {drift && (
        <div className="drift" role="alert">
          <p>
            <b>The plan has changed since the simulation started.</b> Results still describe the snapshot ({snap.packageIds.join(', ')}). Your current draft has {s.plan.packageIds.length ? s.plan.packageIds.join(', ') : 'no packages'}.
          </p>
          <button type="button" className="btn primary" disabled={!s.plan.packageIds.length} onClick={() => dispatch({ type: 'startSimulation' })}>
            Restart simulation with revised plan
          </button>
        </div>
      )}
    </section>
  );
}

/** Outcome cards scoped to the selected context. */
export default function Monitor() {
  const s = useApp();
  const dispatch = useDispatch();
  if (!s.snapshot) return null;
  const snap = s.snapshot;
  const scoped = scopedPackages(s.ctx, snap.packageIds);
  return (
    <section className="card monitor" aria-label="Outcome review for the selected area">
      <div className="monitor-head">
        <h2 className="panel-title">Outcome review — {ctxLabel(s.ctx)}</h2>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'drawer', drawer: 'review' })}>
            Open outcome review
          </button>
          <button type="button" className="btn" disabled={s.week === 0} title={s.week === 0 ? 'Baseline has no outcomes to print' : ''} onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
            Print outcome review
          </button>
        </div>
      </div>
      {scoped.length ? (
        <OutcomeBlock ids={scoped.map((p) => p.id)} week={s.week} />
      ) : (
        <div className="empty">
          <p>
            <b>No selected intervention in this area.</b> {s.ctx.kind === 'department' && s.ctx.code === '29' ? 'Finistère is a strong-delivery reference area; no treated result is shown. ' : ''}
            Return to France to review the selected package set, or open the plan to choose a package.
          </p>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'france' } })}>
              France overview
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
              Open plan
            </button>
          </div>
        </div>
      )}
      <p className="note">
        Packages in this simulation: {snap.packageIds.join(', ')}. Historical VCR and cluster membership do not change as the simulated season advances.
      </p>
    </section>
  );
}
