import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { matchIntent, renderResponse, welcomeFor } from './lib/advisor';
import { checkpointDates, ctxKey, ctxLabel, fmtDate, weekLabel } from './lib/calc';
import { UI } from './lib/data';
import type {
  Context,
  MapView,
  Mode,
  PackageId,
  PlanDraft,
  PlanStatus,
  SimulationSnapshot,
  TranscriptItem,
  Week,
} from './lib/types';

export type Drawer = 'plan' | 'model' | 'sources' | 'history' | 'status' | 'review' | null;
export type PrintTarget = 'plan' | 'outcome' | null;

export interface AppState {
  mode: Mode;
  mapView: MapView;
  ctx: Context;
  week: Week;
  plan: PlanDraft;
  snapshot: SimulationSnapshot | null;
  transcript: TranscriptItem[];
  // transient
  pending: { id: string; intent: string } | null;
  focusId: string | null;
  drawer: Drawer;
  sourceFocus: string | null;
  print: PrintTarget;
  seq: number;
}

export type Action =
  | { type: 'setMode'; mode: Mode }
  | { type: 'setMapView'; view: MapView }
  | { type: 'setContext'; ctx: Context }
  | { type: 'setWeek'; week: Week }
  | { type: 'togglePackage'; id: PackageId }
  | { type: 'updatePlan'; patch: Partial<PlanDraft> }
  | { type: 'setStatus'; status: PlanStatus }
  | { type: 'startSimulation' }
  | { type: 'ask'; intent: string; text?: string }
  | { type: 'askFreeText'; text: string }
  | { type: 'resolve'; id: string }
  | { type: 'drawer'; drawer: Drawer; sourceFocus?: string | null }
  | { type: 'print'; target: PrintTarget }
  | { type: 'clearFocus' }
  | { type: 'reset' };

const STORAGE_KEY = 'sanofi-flu-demonstrator:v1';

const DEFAULT_PLAN: PlanDraft = {
  title: 'Draft 2026–27 influenza uptake plan',
  objective: 'Test a small set of local, cross-functional interventions to support uptake among adults aged 65+, and review the comparative signals together.',
  owner: 'Public Affairs (coordination)',
  notes: '',
  budget: '',
  packageIds: [],
  status: 'draft',
};

function nextId(s: AppState, prefix: string): [string, number] {
  return [`${prefix}${s.seq + 1}`, s.seq + 1];
}

function selectedFor(s: AppState): PackageId[] {
  return s.mode === 'monitor' && s.snapshot ? s.snapshot.packageIds : s.plan.packageIds;
}

function scopeDate(mode: Mode, week: Week): string {
  if (mode === 'plan') return 'Plan the season · 2025–26 historical data';
  const d = checkpointDates(week);
  return `${weekLabel(week)} · ${fmtDate(d.review_date)} · data through ${fmtDate(d.data_through)}`;
}

function contextItems(s: AppState, why: string, startSeq: number): { items: TranscriptItem[]; seq: number } {
  let seq = startSeq;
  const sel = selectedFor(s);
  const w = welcomeFor(s.ctx, s.mode, s.week, sel);
  const items: TranscriptItem[] = [
    { id: `t${++seq}`, kind: 'divider', label: `${why}${ctxLabel(s.ctx)}`, sub: scopeDate(s.mode, s.week) },
    { id: `t${++seq}`, kind: 'welcome', ctxKey: ctxKey(s.ctx), paragraphs: w.paragraphs, sourceIds: w.sourceIds },
  ];
  return { items, seq };
}

/** Append a context divider + intro; replace a previous untouched intro rather than stacking them. */
function withContext(s: AppState, why = ''): AppState {
  let t = s.transcript;
  const last = t[t.length - 1];
  const prev = t[t.length - 2];
  if (last && last.kind === 'welcome' && prev && prev.kind === 'divider') t = t.slice(0, -2);
  const { items, seq } = contextItems({ ...s, transcript: t }, why, s.seq);
  return { ...s, transcript: [...t, ...items], seq, pending: null };
}

function initial(): AppState {
  const base: AppState = {
    mode: 'plan',
    mapView: 'clusters',
    ctx: { kind: 'france' },
    week: 0,
    plan: { ...DEFAULT_PLAN, packageIds: [] },
    snapshot: null,
    transcript: [],
    pending: null,
    focusId: null,
    drawer: null,
    sourceFocus: null,
    print: null,
    seq: 0,
  };
  const w = welcomeFor(base.ctx, base.mode, base.week, []);
  return {
    ...base,
    transcript: [{ id: 't1', kind: 'welcome', ctxKey: 'france', paragraphs: w.paragraphs, sourceIds: w.sourceIds }],
    seq: 1,
  };
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'reset':
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
      return initial();

    case 'setMapView':
      return { ...s, mapView: a.view };

    case 'setMode': {
      if (a.mode === s.mode) return s;
      if (a.mode === 'monitor' && !s.snapshot) return { ...s, drawer: 'plan' };
      const next = { ...s, mode: a.mode };
      return withContext(next, a.mode === 'monitor' ? 'Monitor · ' : 'Plan · ');
    }

    case 'setContext': {
      if (ctxKey(a.ctx) === ctxKey(s.ctx)) return { ...s, ctx: a.ctx };
      return withContext({ ...s, ctx: a.ctx });
    }

    case 'setWeek': {
      if (!s.snapshot || a.week === s.week) return s;
      let status = s.plan.status;
      if (a.week === 6 && status === 'simulation') status = 'reviewed';
      return withContext({ ...s, week: a.week, plan: { ...s.plan, status } });
    }

    case 'togglePackage': {
      const has = s.plan.packageIds.includes(a.id);
      const packageIds = has ? s.plan.packageIds.filter((x) => x !== a.id) : [...s.plan.packageIds, a.id].sort() as PackageId[];
      // Editing a draft returns it to Draft unless a simulation snapshot already governs outcomes.
      const status: PlanStatus = s.snapshot ? s.plan.status : 'draft';
      return { ...s, plan: { ...s.plan, packageIds, status } };
    }

    case 'updatePlan':
      return { ...s, plan: { ...s.plan, ...a.patch } };

    case 'setStatus':
      return { ...s, plan: { ...s.plan, status: a.status } };

    case 'startSimulation': {
      if (!s.plan.packageIds.length) return s;
      const snapshot: SimulationSnapshot = {
        packageIds: [...s.plan.packageIds],
        title: s.plan.title,
        objective: s.plan.objective,
        owner: s.plan.owner,
        notes: s.plan.notes,
        budget: s.plan.budget,
      };
      const restarted = !!s.snapshot;
      const next: AppState = {
        ...s,
        snapshot,
        mode: 'monitor',
        week: 0,
        plan: { ...s.plan, status: 'simulation' },
        drawer: null,
        ctx: { kind: 'france' },
        mapView: s.mapView,
        transcript: s.transcript,
      };
      const note: TranscriptItem = {
        id: `t${s.seq + 1}`,
        kind: 'system',
        text: restarted
          ? `Simulation restarted with revised plan: ${snapshot.packageIds.join(', ')}. Earlier messages keep their original scope.`
          : `Simulated follow-up started with ${snapshot.packageIds.join(', ')}. The 27 October 2026 start, review dates and results are fictional scenario checkpoints, not forecasts or live data.`,
      };
      return withContext({ ...next, transcript: [...s.transcript, note], seq: s.seq + 1 }, 'Monitor · ');
    }

    case 'ask': {
      const sel = selectedFor(s);
      const rendered = renderResponse({ ctx: s.ctx, mode: s.mode, week: s.week, intent: a.intent, selected: sel, hasSimulation: !!s.snapshot });
      const sig = `${rendered.key}#${[...sel].join(',')}`;
      const existing = s.transcript.find((t) => t.kind === 'advisor' && t.key === sig);
      if (existing) return { ...s, focusId: existing.id, pending: null };
      const prompts = s.mode === 'plan' ? UI.prompts.plan : UI.prompts.monitor;
      const [uid, seq] = nextId(s, 't');
      const user: TranscriptItem = { id: uid, kind: 'user', text: a.text ?? prompts[a.intent] };
      const [pid, seq2] = [`p${seq + 1}`, seq + 1];
      return { ...s, transcript: [...s.transcript, user], seq: seq2, pending: { id: pid, intent: a.intent }, focusId: null };
    }

    case 'askFreeText': {
      const text = a.text.trim();
      if (!text) return s;
      const intent = matchIntent(text, s.mode);
      if (intent) return reducer(s, { type: 'ask', intent, text });
      const [uid, seq] = nextId(s, 't');
      return {
        ...s,
        transcript: [
          ...s.transcript,
          { id: uid, kind: 'user', text },
          { id: `t${seq + 1}`, kind: 'system', text: UI.optional_free_text_fallback },
        ],
        seq: seq + 1,
      };
    }

    case 'resolve': {
      if (!s.pending || s.pending.id !== a.id) return s;
      const sel = selectedFor(s);
      const rendered = renderResponse({ ctx: s.ctx, mode: s.mode, week: s.week, intent: s.pending.intent, selected: sel, hasSimulation: !!s.snapshot });
      const id = `t${s.seq + 1}`;
      return {
        ...s,
        pending: null,
        seq: s.seq + 1,
        transcript: [
          ...s.transcript,
          { id, kind: 'advisor', key: `${rendered.key}#${[...sel].join(',')}`, scopeLabel: ctxLabel(s.ctx), dateLabel: scopeDate(s.mode, s.week), response: rendered },
        ],
        focusId: id,
      };
    }

    case 'drawer':
      return { ...s, drawer: a.drawer, sourceFocus: a.sourceFocus ?? null };

    case 'print':
      return { ...s, print: a.target };

    case 'clearFocus':
      return { ...s, focusId: null };
  }
}

function load(): AppState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      if (p && p.plan && p.ctx && p.transcript) {
        return { ...initial(), ...p, pending: null, focusId: null, drawer: null, sourceFocus: null, print: null } as AppState;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return initial();
}

const StateCtx = createContext<AppState>(initial());
const DispatchCtx = createContext<Dispatch<Action>>(() => undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      const { pending, focusId, drawer, sourceFocus, print, ...persist } = state;
      void pending; void focusId; void drawer; void sourceFocus; void print;
      const { pending: p0, focusId: f0, drawer: d0, sourceFocus: s0, print: r0, ...fresh } = initial();
      void p0; void f0; void d0; void s0; void r0;
      // A pristine state is not persisted, so Reset leaves no stored data behind.
      if (JSON.stringify(persist) === JSON.stringify(fresh)) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch {
      /* storage unavailable: app still works */
    }
  }, [state]);
  const memo = useMemo(() => state, [state]);
  return (
    <StateCtx.Provider value={memo}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export const useApp = () => useContext(StateCtx);
export const useDispatch = () => useContext(DispatchCtx);
export { initial as initialState };
