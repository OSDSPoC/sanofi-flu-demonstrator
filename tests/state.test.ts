import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../src/state';

const run = (s: AppState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, s);
const advisorItems = (s: AppState) => s.transcript.filter((t) => t.kind === 'advisor');
const D93 = { kind: 'department', code: '93' } as const;

describe('state contract', () => {
  it('starts at France overview, Coverage, no packages, no follow-up', () => {
    const s = initialState();
    expect(s.mode).toBe('plan');
    expect(s.ctx).toEqual({ kind: 'france' });
    expect(s.mapView).toBe('coverage');
    expect(s.plan.packageIds).toEqual([]);
    expect(s.plan.status).toBe('draft');
    expect(s.snapshot).toBeNull();
  });

  it('exploring a cluster sets the Clusters map view', () => {
    const s = run(initialState(), { type: 'setContext', ctx: { kind: 'cluster', id: 'activation' }, mapView: 'clusters' });
    expect(s.mapView).toBe('clusters');
    expect(s.ctx).toEqual({ kind: 'cluster', id: 'activation' });
  });

  it('a pending answer never lands under a different context', () => {
    let s = run(initialState(), { type: 'ask', intent: 'focus' });
    const id = s.pending!.id;
    s = run(s, { type: 'setContext', ctx: D93 });
    expect(s.pending).toBeNull();
    s = run(s, { type: 'resolve', id });
    expect(advisorItems(s)).toHaveLength(0);
  });

  it('a resolved answer carries its own scope and date', () => {
    let s = run(initialState(), { type: 'setContext', ctx: D93 }, { type: 'ask', intent: 'opportunity' });
    s = run(s, { type: 'resolve', id: s.pending!.id });
    const a = advisorItems(s)[0] as Extract<AppState['transcript'][number], { kind: 'advisor' }>;
    expect(a.scopeLabel).toBe('Seine-Saint-Denis (93)');
    expect(a.dateLabel).toMatch(/Prepare the campaign/);
    s = run(s, { type: 'setContext', ctx: { kind: 'france' } });
    expect((advisorItems(s)[0] as typeof a).scopeLabel).toBe('Seine-Saint-Denis (93)');
  });

  it('repeating a prompt focuses the existing answer instead of appending', () => {
    let s = run(initialState(), { type: 'ask', intent: 'focus' });
    s = run(s, { type: 'resolve', id: s.pending!.id }, { type: 'ask', intent: 'focus' });
    expect(advisorItems(s)).toHaveLength(1);
    expect(s.focusId).toBe(advisorItems(s)[0].id);
  });

  it('follow-up cannot start from an empty plan', () => {
    const s = run(initialState(), { type: 'startSimulation' });
    expect(s.snapshot).toBeNull();
    expect(s.mode).toBe('plan');
  });

  it('adding P2 is one action and is idempotent', () => {
    const s = run(initialState(), { type: 'addPackage', id: 'P2' }, { type: 'addPackage', id: 'P2' });
    expect(s.plan.packageIds).toEqual(['P2']);
  });

  it('printing never changes status and does not start follow-up', () => {
    let s = run(initialState(), { type: 'addPackage', id: 'P2' }, { type: 'setStatus', status: 'ready' });
    s = run(s, { type: 'print', target: 'plan' }, { type: 'print', target: null });
    expect(s.plan.status).toBe('ready');
    expect(s.snapshot).toBeNull();
  });

  it('plan lifecycle runs Draft, Ready, Follow-up started, Reviewed', () => {
    let s = run(initialState(), { type: 'addPackage', id: 'P2' });
    expect(s.plan.status).toBe('draft');
    s = run(s, { type: 'setStatus', status: 'ready' });
    expect(s.plan.status).toBe('ready');
    s = run(s, { type: 'startSimulation' });
    expect(s.plan.status).toBe('followup');
    expect(s.mode).toBe('monitor');
    expect(s.week).toBe(0);
    s = run(s, { type: 'setWeek', week: 6 });
    expect(s.plan.status).toBe('reviewed');
  });

  it('starting follow-up keeps the local department context', () => {
    let s = run(initialState(), { type: 'setContext', ctx: D93 }, { type: 'addPackage', id: 'P2' }, { type: 'startSimulation' });
    expect(s.ctx).toEqual(D93);
    expect(s.snapshot!.packageIds).toEqual(['P2']);
    s = run(s, { type: 'setWeek', week: 2 });
    expect(s.ctx).toEqual(D93);
  });

  it('changing packages after follow-up starts keeps the snapshot until an explicit restart', () => {
    let s = run(initialState(), { type: 'addPackage', id: 'P1' }, { type: 'startSimulation' });
    s = run(s, { type: 'addPackage', id: 'P3' });
    expect(s.snapshot!.packageIds).toEqual(['P1']);
    expect(s.plan.packageIds).toEqual(['P1', 'P3']);
    s = run(s, { type: 'startSimulation' });
    expect(s.snapshot!.packageIds).toEqual(['P1', 'P3']);
    expect(s.week).toBe(0);
  });

  it('reset restores the starting view completely', () => {
    let s = run(initialState(), { type: 'addPackage', id: 'P2' }, { type: 'startSimulation' }, { type: 'setWeek', week: 6 }, { type: 'ask', intent: 'progress' });
    s = run(s, { type: 'reset' });
    const f = initialState();
    expect(s.plan).toEqual(f.plan);
    expect(s.snapshot).toBeNull();
    expect(s.week).toBe(0);
    expect(s.mode).toBe('plan');
    expect(s.mapView).toBe('coverage');
    expect(s.pending).toBeNull();
    expect(s.transcript).toEqual(f.transcript);
  });

  it('unsupported free text gets the fixed fallback and no invented answer', () => {
    const s = run(initialState(), { type: 'askFreeText', text: 'what is the weather' });
    expect(s.pending).toBeNull();
    expect(advisorItems(s)).toHaveLength(0);
    expect(s.transcript[s.transcript.length - 1]).toMatchObject({ kind: 'system', text: expect.stringMatching(/prepared questions/) });
  });
});
