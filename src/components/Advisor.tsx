import { useEffect, useRef, useState } from 'react';
import { MONITOR_INTENTS, PLAN_INTENTS, UI } from '../lib/data';
import { ctxLabel } from '../lib/calc';
import type { RenderedResponse, TranscriptItem } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { SourceChips } from './ui';

function ActionButtons({ r }: { r: RenderedResponse }) {
  const s = useApp();
  const dispatch = useDispatch();
  if (!r.actions.length) return null;
  return (
    <div className="msg-actions">
      {r.actions.map((a) => {
        if (a === 'open_plan')
          return (
            <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
              Open plan
            </button>
          );
        if (a === 'open_sources')
          return (
            <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'sources' })}>
              Open sources
            </button>
          );
        if (a === 'open_outcome_review')
          return (
            <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'review' })}>
              Open outcome review
            </button>
          );
        if (a === 'print_outcome')
          return (
            <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
              Print outcome review
            </button>
          );
        if (a.startsWith('focus_package:')) {
          const id = a.split(':')[1] as 'P1' | 'P2' | 'P3';
          const inPlan = s.plan.packageIds.includes(id);
          return (
            <button
              key={a}
              type="button"
              className={`btn small${inPlan ? ' on' : ' primary'}`}
              aria-pressed={inPlan}
              onClick={() => dispatch({ type: 'togglePackage', id })}
            >
              {inPlan ? `${id} in plan ✓ (remove)` : `Add ${id} to plan`}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

function AdvisorMessage({ item, focused }: { item: Extract<TranscriptItem, { kind: 'advisor' }>; focused: boolean }) {
  const r = item.response;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focused]);
  return (
    <div className={`msg advisor${focused ? ' flash' : ''}`} ref={ref} data-intent={r.intent}>
      <div className="msg-scope">
        {item.scopeLabel} · {item.dateLabel}
      </div>
      <h3 className="msg-title">{r.title}</h3>
      {r.clusterNote && <p className="cluster-note">{r.clusterNote}</p>}
      {r.localSummary && (
        <ul className="evid local">
          {r.localSummary.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <p className="obs">{r.observation}</p>
      {r.evidence.length > 0 && (
        <ul className="evid">
          {r.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {r.combinedNote && <p className="combined">{r.combinedNote}</p>}
      {r.fallback && <p className="fallback">{r.fallback}</p>}
      {!r.fallback && r.interpretation && (
        <p className="interp">
          <b>Interpretation.</b> {r.interpretation}
        </p>
      )}
      {!r.fallback && (
        <details className="more">
          <summary>Ownership, action and measurement</summary>
          {r.ownership && (
            <p>
              <b>Who owns what.</b> {r.ownership}
            </p>
          )}
          {r.decisions.length > 0 ? (
            <>
              <p>
                <b>Suggested decisions for the selected packages.</b>
              </p>
              <ul className="evid">
                {r.decisions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          ) : (
            r.suggestedAction && (
              <p>
                <b>Suggested action.</b> {r.suggestedAction}
              </p>
            )
          )}
          {r.measurement && (
            <p>
              <b>Measurement.</b> {r.measurement}
            </p>
          )}
        </details>
      )}
      <ActionButtons r={r} />
      <SourceChips ids={r.sourceIds} />
    </div>
  );
}

function Item({ item, focusId }: { item: TranscriptItem; focusId: string | null }) {
  switch (item.kind) {
    case 'divider':
      return (
        <div className="divider" role="separator" aria-label={`${item.label}. ${item.sub}`}>
          <span className="divider-label">{item.label}</span>
          <span className="divider-sub">{item.sub}</span>
        </div>
      );
    case 'welcome':
      return (
        <div className="msg advisor welcome">
          {item.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <SourceChips ids={item.sourceIds} />
        </div>
      );
    case 'user':
      return <div className="msg user">{item.text}</div>;
    case 'system':
      return <div className="msg system">{item.text}</div>;
    case 'advisor':
      return <AdvisorMessage item={item} focused={focusId === item.id} />;
  }
}

export default function Advisor() {
  const s = useApp();
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reveal a prepared answer after a short, fixed delay. Cancelled by any context change (reducer clears pending).
  useEffect(() => {
    if (!s.pending) return;
    const id = s.pending.id;
    const t = window.setTimeout(() => dispatch({ type: 'resolve', id }), 320);
    return () => window.clearTimeout(t);
  }, [s.pending, dispatch]);

  useEffect(() => {
    if (s.focusId) {
      const t = window.setTimeout(() => dispatch({ type: 'clearFocus' }), 1600);
      return () => window.clearTimeout(t);
    }
  }, [s.focusId, dispatch]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || s.focusId) return;
    const last = s.transcript[s.transcript.length - 1];
    let top = el.scrollHeight;
    if (last.kind === 'advisor') {
      const users = el.querySelectorAll<HTMLElement>('.msg.user');
      const u = users[users.length - 1];
      if (u) top = u.offsetTop - 8;
    } else if (last.kind === 'welcome') {
      const ds = el.querySelectorAll<HTMLElement>('.divider');
      const d = ds[ds.length - 1];
      top = d ? d.offsetTop - 4 : 0;
    }
    el.scrollTo({ top, behavior: 'smooth' });
  }, [s.transcript.length, s.pending, s.focusId, s.transcript]);

  const intents = s.mode === 'plan' ? PLAN_INTENTS : MONITOR_INTENTS;
  const prompts = s.mode === 'plan' ? UI.prompts.plan : UI.prompts.monitor;
  const fresh = !s.transcript.some((t) => t.kind === 'user' || t.kind === 'advisor');

  return (
    <aside className="advisor-panel" aria-label="Advisor">
      <div className="advisor-head">
        <div>
          <h2>Advisor</h2>
          <p className="advisor-ctx">
            Context: <b>{ctxLabel(s.ctx)}</b> · {s.mode === 'plan' ? 'Plan the season' : 'Monitor'}
          </p>
        </div>
      </div>
      <div className="transcript" ref={listRef} role="log" aria-live="polite" aria-label="Advisor conversation">
        {s.transcript.map((t) => (
          <Item key={t.id} item={t} focusId={s.focusId} />
        ))}
        {fresh && !s.pending && (
          <div className="starter" role="group" aria-label="Suggested questions">
            <p className="starter-title">Start with a prepared question</p>
            {intents.map((i) => (
              <button key={i} type="button" className="starter-btn" onClick={() => dispatch({ type: 'ask', intent: i })}>
                {prompts[i]}
              </button>
            ))}
          </div>
        )}
        {s.pending && (
          <div className="msg advisor pending" aria-label="Preparing response">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="sr-only">Preparing response</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="prompt-area">
        {!fresh && (
          <div className="prompts" role="group" aria-label="Suggested questions">
            {intents.map((i) => (
              <button key={i} type="button" className="prompt" onClick={() => dispatch({ type: 'ask', intent: i })}>
                {prompts[i]}
              </button>
            ))}
          </div>
        )}
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'askFreeText', text });
            setText('');
          }}
        >
          <label className="sr-only" htmlFor="ask-input">
            Ask a question
          </label>
          <input id="ask-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about this area…" autoComplete="off" />
          <button type="submit" className="btn">
            Ask
          </button>
        </form>
        <p className="advisor-foot">{UI.advisor_footer}</p>
      </div>
    </aside>
  );
}
