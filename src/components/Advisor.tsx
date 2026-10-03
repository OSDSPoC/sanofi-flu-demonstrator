import { useEffect, useRef, useState } from 'react';
import { CLUSTER_BY_ID, DEPT_BY_CODE, PACKAGE_BY_ID } from '../lib/data';
import { ctxLabel } from '../lib/calc';
import { promptsFor } from '../lib/answers';
import type { Answer, ClusterId, PackageId, TranscriptItem } from '../lib/types';
import { useApp, useDispatch } from '../state';
import { SourceChips } from './ui';

function ActionButtons({ answer }: { answer: Answer }) {
  const s = useApp();
  const dispatch = useDispatch();
  if (!answer.actions.length) return null;
  return (
    <div className="msg-actions">
      {answer.actions.map((a) => {
        const [kind, arg] = a.split(':');
        switch (kind) {
          case 'explore_cluster': {
            const c = CLUSTER_BY_ID.get(arg as ClusterId)!;
            return (
              <button key={a} type="button" className="btn small primary" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'cluster', id: c.id }, mapView: 'clusters' })}>
                Explore {c.name}
              </button>
            );
          }
          case 'explore_department': {
            const d = DEPT_BY_CODE.get(arg)!;
            return (
              <button key={a} type="button" className="btn small primary" onClick={() => dispatch({ type: 'setContext', ctx: { kind: 'department', code: d.code }, mapView: 'clusters' })}>
                Explore {d.name}
              </button>
            );
          }
          case 'design_local':
            return (
              <button key={a} type="button" className="btn small primary" onClick={() => dispatch({ type: 'ask', intent: 'design' })}>
                Design local intervention
              </button>
            );
          case 'add_plan': {
            const id = arg as PackageId;
            const inPlan = s.plan.packageIds.includes(id);
            return inPlan ? (
              <button key={a} type="button" className="btn small on" aria-pressed="true" onClick={() => dispatch({ type: 'togglePackage', id })} title="Remove from plan">
                ✓ {id} in plan (remove)
              </button>
            ) : (
              <button key={a} type="button" className="btn small primary" onClick={() => dispatch({ type: 'addPackage', id })}>
                Add to plan
              </button>
            );
          }
          case 'review_plan':
            return (
              <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'plan' })}>
                Review plan
              </button>
            );
          case 'open_sources':
            return (
              <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'sources' })}>
                Open sources
              </button>
            );
          case 'open_outcome_review':
            return (
              <button key={a} type="button" className="btn small" onClick={() => dispatch({ type: 'drawer', drawer: 'review' })}>
                Open outcome review
              </button>
            );
          case 'print_outcome':
            return (
              <button key={a} type="button" className="btn small primary" onClick={() => dispatch({ type: 'print', target: 'outcome' })}>
                Print outcome review
              </button>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function AdvisorMessage({ item, focused }: { item: Extract<TranscriptItem, { kind: 'advisor' }>; focused: boolean }) {
  const a = item.answer;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focused]);
  const hasDetail = a.evidence.length > 0 || !!a.uncertainty || a.sourceIds.length > 0;
  return (
    <div className={`msg advisor${focused ? ' flash' : ''}`} ref={ref} data-intent={a.intent}>
      <div className="msg-scope">
        {item.scopeLabel} · {item.dateLabel}
      </div>
      {a.fallback ? (
        <>
          <h3 className="msg-title">{a.title}</h3>
          <p className="fallback">{a.fallback}</p>
        </>
      ) : (
        <>
          <p className="recommendation">{a.recommendation}</p>
          {a.body.map((p) => (
            <p key={p} className="body">
              {p}
            </p>
          ))}
          {a.bullets && (
            <ol className="actions-list">
              {a.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
          )}
          {a.roles && (
            <ul className="roles">
              {a.roles.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <ActionButtons answer={a} />
      {hasDetail && (
        <details className="more">
          <summary>Evidence and assumptions</summary>
          {a.evidence.length > 0 && (
            <ul className="evid">
              {a.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {a.uncertainty && <p>{a.uncertainty}</p>}
          <SourceChips ids={a.sourceIds} />
        </details>
      )}
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
  }, [s.transcript, s.pending, s.focusId]);

  const selected = s.mode === 'monitor' && s.snapshot ? s.snapshot.packageIds : s.plan.packageIds;
  const prompts = promptsFor(s.ctx, s.mode, selected);
  const fresh = !s.transcript.some((t) => t.kind === 'user' || t.kind === 'advisor');

  return (
    <aside className="advisor-panel" aria-label="Advisor">
      <div className="advisor-head">
        <h2>Advisor</h2>
        <p className="advisor-ctx">
          <b>{ctxLabel(s.ctx)}</b> · {s.mode === 'plan' ? 'Prepare the campaign' : 'Review in-season delivery'}
        </p>
      </div>
      <div className="transcript" ref={listRef} role="log" aria-live="polite" aria-label="Advisor conversation">
        {s.transcript.map((t) => (
          <Item key={t.id} item={t} focusId={s.focusId} />
        ))}
        {fresh && !s.pending && (
          <div className="starter" role="group" aria-label="Suggested questions">
            <p className="starter-title">Start with a prepared question</p>
            {prompts.map((p) => (
              <button key={p.intent} type="button" className="starter-btn" onClick={() => dispatch({ type: 'ask', intent: p.intent })}>
                {p.label}
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
      </div>
      <div className="prompt-area">
        {!fresh && (
          <div className="prompts" role="group" aria-label="Suggested questions">
            {prompts.map((p) => (
              <button key={p.intent} type="button" className="prompt" onClick={() => dispatch({ type: 'ask', intent: p.intent })}>
                {p.label}
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
      </div>
    </aside>
  );
}

export { PACKAGE_BY_ID };
