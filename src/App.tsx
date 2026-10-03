import { useEffect } from 'react';
import Header from './components/Header';
import KpiStrip from './components/KpiStrip';
import MapPanel, { ClusterCards } from './components/MapPanel';
import EvidencePanel from './components/EvidencePanel';
import Advisor from './components/Advisor';
import Monitor, { MonitorBar } from './components/Monitor';
import PrintViews from './components/PrintViews';
import { HistoryDrawer, ModelDrawer, PlanDrawer, ReviewDrawer, SourcesDrawer, StatusDrawer } from './components/Drawers';
import { useApp, useDispatch } from './state';

function Drawers() {
  const s = useApp();
  const dispatch = useDispatch();
  const close = () => dispatch({ type: 'drawer', drawer: null });
  switch (s.drawer) {
    case 'plan':
      return <PlanDrawer onClose={close} />;
    case 'model':
      return <ModelDrawer onClose={close} />;
    case 'sources':
      return <SourcesDrawer onClose={close} />;
    case 'history':
      return <HistoryDrawer onClose={close} />;
    case 'status':
      return <StatusDrawer onClose={close} />;
    case 'review':
      return <ReviewDrawer onClose={close} />;
    default:
      return null;
  }
}

export default function App() {
  const s = useApp();
  const dispatch = useDispatch();

  // Browser print: set the print layout, open the dialog, then restore the same app state.
  useEffect(() => {
    if (!s.print) return;
    // QA aid: ?printpreview shows the print layout on screen instead of opening the print dialog.
    if (new URLSearchParams(window.location.search).has('printpreview')) {
      document.body.classList.add('preview-print');
      return () => document.body.classList.remove('preview-print');
    }
    const done = () => dispatch({ type: 'print', target: null });
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [s.print, dispatch]);

  return (
    <>
      <div id="app" className={s.print ? 'printing' : ''}>
        <Header />
        <main className="layout">
          <div className="left">
            {s.mode === 'monitor' && <MonitorBar />}
            <KpiStrip />
            <MapPanel />
            <ClusterCards />
            {s.mode === 'monitor' && <Monitor />}
            <EvidencePanel />
            <footer className="app-footer">Demonstrator developed by OpenSky · public data plus synthetic scenarios · not a Sanofi system</footer>
          </div>
          <Advisor />
        </main>
        <Drawers />
      </div>
      <PrintViews />
    </>
  );
}
