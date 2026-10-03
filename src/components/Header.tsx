import logo from '../assets/sanofi-logo.svg';
import { UI } from '../lib/data';
import { useApp, useDispatch } from '../state';

export default function Header() {
  const s = useApp();
  const dispatch = useDispatch();
  const canMonitor = !!s.snapshot;
  return (
    <header className="app-header">
      <div className="brand">
        <img src={logo} alt="Sanofi" className="logo" width={96} height={26} />
        <div className="titles">
          <h1>{UI.title}</h1>
          <p>{UI.subtitle}</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="seg" role="group" aria-label="Mode">
          <button
            type="button"
            className={s.mode === 'plan' ? 'active' : ''}
            aria-pressed={s.mode === 'plan'}
            title="Plan the season"
            onClick={() => dispatch({ type: 'setMode', mode: 'plan' })}
          >
            Plan
          </button>
          <button
            type="button"
            className={s.mode === 'monitor' ? 'active' : ''}
            aria-pressed={s.mode === 'monitor'}
            aria-disabled={!canMonitor}
            title={canMonitor ? 'Monitor the season: review the simulated 2026–27 campaign' : 'Select an intervention package and start simulated follow-up from the plan'}
            onClick={() => dispatch({ type: 'setMode', mode: 'monitor' })}
          >
            Monitor
          </button>
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })} aria-label={`Open intervention plan, ${s.plan.packageIds.length} packages selected`}>
          Intervention plan{s.plan.packageIds.length ? ` (${s.plan.packageIds.length})` : ''}
        </button>
        <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'drawer', drawer: 'model' })}>
          How this works
        </button>
        <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'drawer', drawer: 'sources' })}>
          Sources
        </button>
        <button type="button" className="pill" onClick={() => dispatch({ type: 'drawer', drawer: 'status' })} aria-label="About this demonstrator: public and synthetic data">
          {UI.prototype_label}
        </button>
        <button type="button" className="btn reset" onClick={() => dispatch({ type: 'reset' })}>
          Reset demo
        </button>
      </div>
    </header>
  );
}
