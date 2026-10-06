import logo from '../assets/opensky-logo.jpg';
import { UI } from '../lib/data';
import { useApp, useDispatch } from '../state';

export default function Header() {
  const s = useApp();
  const dispatch = useDispatch();
  const canMonitor = !!s.snapshot;
  return (
    <header className="app-header">
      <div className="brand">
        <img src={logo} alt="OpenSky" className="logo" width={94} height={38} />
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
            title="Prepare the campaign"
            onClick={() => dispatch({ type: 'setMode', mode: 'plan' })}
          >
            Plan
          </button>
          <button
            type="button"
            className={s.mode === 'monitor' ? 'active' : ''}
            aria-pressed={s.mode === 'monitor'}
            aria-disabled={!canMonitor}
            title={canMonitor ? 'Review in-season delivery' : 'Add an intervention to the plan and start follow-up first'}
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
