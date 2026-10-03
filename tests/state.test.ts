import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../src/state';

const run = (s: AppState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, s);
const advisorItems = (s: AppState) => s.transcript.filter((t) => t.kind === 'advisor');

describe('state contract', () => {
  it('starts at Plan the season, France overview, Clusters, no packages', () => {
    const s = initialState();
    expect(s.mode).toBe('plan');
    expect(s.ctx).toEqual({ kind: 'france' });
    expect(s.mapView).toBe('clusters');
    expect(s.plan.packageIds).toEqual([]);
    expect(s.plan.status).toBe('draft');
    expect(s.snapshot).toBeNull();
  });

  it('a pending answer never lands under a different context', () => {
    let s = run(initialState(), { type: 'ask', intent: 'profile' });
    const id = s.pending!.id;
    s = run(s, { type: 'setContext', ctx: { kind: 'department', code: '93' } });
    expect(s.pending).toBeNull();
    s = run(s, { type: 'resolve', id });
    expect(advisorItems(s)).toHaveLength(0);
  });

  it('a resolved answer carries its own scope and date', () => {
    let s = run(initialState(), { type: 'setContext', ctx: { kind: 'department', code: '93' } }, { type: 'ask', intent: 'explain_gap' });
    s = run(s, { type: 'resolve', id: s.pending!.id });
    const a = advisorItems(s)[0] as Extract<AppState['transcript'][number], { kind: 'advisor' }>;
    expect(a.scopeLabel).toBe('Seine-Saint-Denis (93)');
    expect(a.dateLabel).toMatch(/Plan the season/);
    // later context changes do not rewrite it
    s = run(s, { type: 'setContext', ctx: { kind: 'france' } });
    expect((advisorItems(s)[0] as typeof a).scopeLabel).toBe('Seine-Saint-Denis (93)');
  });

  it('repeating a prompt focuses the existing answer instead of appending', () => {
    let s = run(initialState(), { type: 'ask', intent: 'profile' });
    s = run(s, { type: 'resolve', id: s.pending!.id }, { type: 'ask', intent: 'profile' });
    expect(advisorItems(s)).toHaveLength(1);
    expect(s.focusId).toBe(advisorItems(s)[0].id);
  });

  it('simulation cannot start from an empty plan', () => {
    const s = run(initialState(), { type: 'startSimulation' });
    expect(s.snapshot).toBeNull();
    expect(s.mode).toBe('plan');
  });

  it('printing never changes status and does not start a simulation', () => {
    let s = run(initialState(), { type: 'togglePackage', id: 'P1' }, { type: 'setStatus', status: 'ready' });
    s = run(s, { type: 'print', target: 'plan' }, { type: 'print', target: null });
    expect(s.plan.status).toBe('ready');
    expect(s.snapshot).toBeNull();
  });

  it('plan lifecycle runs Draft → Ready → Simulation started → Reviewed', () => {
    let s = run(initialState(), { type: 'togglePackage', id: 'P2' });
    expect(s.plan.status).toBe('draft');
    s = run(s, { type: 'setStatus', status: 'ready' });
    expect(s.plan.status).toBe('ready');
    s = run(s, { type: 'startSimulation' });
    expect(s.plan.status).toBe('simulation');
    expect(s.mode).toBe('monitor');
    expect(s.week).toBe(0);
    s = run(s, { type: 'setWeek', week: 6 });
    expect(s.plan.status).toBe('reviewed');
  });

  it('changing packages after the simulation starts keeps the snapshot until an explicit restart', () => {
    let s = run(initialState(), { type: 'togglePackage', id: 'P1' }, { type: 'startSimulation' });
    s = run(s, { type: 'togglePackage', id: 'P3' });
    expect(s.snapshot!.packageIds).toEqual(['P1']);
    expect(s.plan.packageIds).toEqual(['P1', 'P3']);
    s = run(s, { type: 'startSimulation' });
    expect(s.snapshot!.packageIds).toEqual(['P1', 'P3']);
    expect(s.week).toBe(0);
  });

  it('advancing the simulation does not change the selected context or cluster', () => {
    let s = run(initialState(), { type: 'togglePackage', id: 'P1' }, { type: 'startSimulation' }, { type: 'setContext', ctx: { kind: 'cluster', id: 'access' } });
    s = run(s, { type: 'setWeek', week: 2 }, { type: 'setWeek', week: 4 });
    expect(s.ctx).toEqual({ kind: 'cluster', id: 'access' });
  });

  it('reset restores the starting view completely', () => {
    let s = run(initialState(), { type: 'togglePackage', id: 'P1' }, { type: 'startSimulation' }, { type: 'setWeek', week: 6 }, { type: 'ask', intent: 'change' });
    s = run(s, { type: 'reset' });
    const f = initialState();
    expect(s.plan).toEqual(f.plan);
    expect(s.snapshot).toBeNull();
    expect(s.week).toBe(0);
    expect(s.mode).toBe('plan');
    expect(s.pending).toBeNull();
    expect(s.transcript).toEqual(f.transcript);
  });

  it('unsupported free text gets the fixed fallback and no invented answer', () => {
    const s = run(initialState(), { type: 'askFreeText', text: 'what is the weather' });
    expect(s.pending).toBeNull();
    expect(advisorItems(s)).toHaveLength(0);
    expect(s.transcript[s.transcript.length - 1]).toMatchObject({ kind: 'system' });
  });
});
