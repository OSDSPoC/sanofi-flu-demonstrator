import {
  CLUSTER_BY_ID,
  DEPT_BY_CODE,
  MONITOR_INTENTS,
  NATIONAL,
  PLAN_INTENTS,
  RESPONSE_BY_KEY,
  UI,
} from './data';
import {
  GAP_TO_TARGET,
  NATIONAL_CHANGE_PP,
  checkpointDates,
  clusterStats,
  combinedDoseDifference,
  ctxKey,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtPp,
  fmtSigned,
  gapTo75,
  scopedPackages,
  weekLabel,
} from './calc';
import type { Context, Mode, PackageId, PreparedResponse, RenderedResponse, Week } from './types';

export interface RenderInput {
  ctx: Context;
  mode: Mode;
  week: Week;
  intent: string;
  /** Packages in the simulation snapshot (monitor) or current draft (plan). */
  selected: PackageId[];
  hasSimulation: boolean;
}

/** Which prepared-response context key serves this selection. */
export function responseContextFor(ctx: Context): { key: string; clusterLevel: boolean } {
  if (ctx.kind === 'france') return { key: 'france', clusterLevel: false };
  if (ctx.kind === 'cluster') return { key: `cluster:${ctx.id}`, clusterLevel: false };
  const direct = `department:${ctx.code}`;
  if (RESPONSE_BY_KEY.has(`${direct}|plan|0|profile`)) return { key: direct, clusterLevel: false };
  const d = DEPT_BY_CODE.get(ctx.code);
  return { key: `cluster:${d?.illustrative.cluster_id ?? 'strong'}`, clusterLevel: true };
}

export function responseKey(ctx: Context, mode: Mode, week: Week, intent: string): string {
  const { key } = responseContextFor(ctx);
  return `${key}|${mode}|${mode === 'plan' ? 0 : week}|${intent}`;
}

export function localSummaryFor(code: string): string[] {
  const d = DEPT_BY_CODE.get(code);
  if (!d) return [];
  const h = d.historical;
  const i = d.illustrative;
  const cl = CLUSTER_BY_ID.get(i.cluster_id)!;
  const lines = [
    `Actual 2025–26 coverage among adults aged 65+: ${fmtPct(h.vcr_65plus)} (65–74: ${fmtPct(h.vcr_65_74)}; 75+: ${fmtPct(h.vcr_75plus)}), ${fmtPp(gapTo75(d))
      .replace('+', '')
      .replace('−', '')} below the 75% reference. Public data.`,
    `Illustrative profile: ${cl.name}. Expected coverage ${fmtPct(i.expected_vcr_65plus)}; observed minus expected ${fmtPp(i.observed_minus_expected_pp)}. Simulated model output.`,
    `Synthetic enhanced-vaccine share of observed 65+ dispensing: ${i.enhanced_share_of_65plus_dispensing_pct}%. Efluelda share within enhanced dispensing: ${i.efluelda_share_of_enhanced_dispensing_pct}%.`,
  ];
  return lines;
}

function emptyRendered(r: PreparedResponse, key: string): RenderedResponse {
  return {
    key,
    intent: r.intent,
    title: r.title,
    observation: r.observation,
    evidence: [],
    interpretation: r.interpretation,
    ownership: r.ownership,
    suggestedAction: r.suggested_action,
    decisions: [],
    measurement: r.measurement,
    sourceIds: r.source_ids,
    actions: [],
  };
}

export function renderResponse(input: RenderInput): RenderedResponse {
  const { ctx, mode, week, intent, selected, hasSimulation } = input;
  const key = responseKey(ctx, mode, week, intent);
  const r = RESPONSE_BY_KEY.get(key);
  const { clusterLevel } = responseContextFor(ctx);
  if (!r) {
    return {
      key,
      intent,
      title: intent,
      observation: UI.optional_free_text_fallback,
      evidence: [],
      interpretation: '',
      ownership: '',
      suggestedAction: '',
      decisions: [],
      measurement: '',
      sourceIds: [],
      actions: [],
    };
  }

  const out = emptyRendered(r, key);
  const deptCode = ctx.kind === 'department' ? ctx.code : null;
  if (clusterLevel && deptCode) {
    out.localSummary = localSummaryFor(deptCode);
    const d = DEPT_BY_CODE.get(deptCode)!;
    out.clusterNote = `Cluster-level interpretation. ${d.name} has no bespoke local evidence dossier in this demonstration; the text below is the prepared response for its illustrative profile (${CLUSTER_BY_ID.get(d.illustrative.cluster_id)!.name}).`;
    // Replace cluster-wide observation: avoid implying it describes only this department.
  }

  if (mode === 'plan') {
    out.evidence = r.evidence.map((e) => e.text);
    out.actions = r.action_ids.filter((a) => a !== 'print_outcome' && a !== 'open_outcome_review');
    return out;
  }

  // ---- monitor ----
  const scoped = scopedPackages(ctx, selected);
  const scopedIds = new Set(scoped.map((p) => p.id));
  const hasPackageEvidence = r.evidence.some((e) => e.package_id);
  out.evidence = r.evidence.filter((e) => !e.package_id || scopedIds.has(e.package_id)).map((e) => e.text);

  const packageEvidenceShown = r.evidence.some((e) => e.package_id && scopedIds.has(e.package_id));

  if (intent === 'commercial') {
    // Brand statement only when P3 is selected and in context; otherwise the supplied no-brand fallback.
    if (!packageEvidenceShown) {
      out.evidence = [];
      out.fallback = r.no_brand_outcome_fallback ?? r.empty_selection_fallback;
    }
  } else if (hasPackageEvidence && !packageEvidenceShown) {
    out.fallback = r.empty_selection_fallback;
    out.evidence = [];
  }

  if (r.package_decisions) {
    out.decisions = r.package_decisions.filter((d) => scopedIds.has(d.package_id)).map((d) => `${d.package_id}: ${d.text}`);
  }

  // Combined dose-rate difference for selected uptake packages (France scope only).
  if (ctx.kind === 'france' && week > 0 && !out.fallback && ['performance', 'change', 'adapt'].includes(intent)) {
    const doseIds = scoped.filter((p) => p.metric_type === 'dose_rate').map((p) => p.id);
    if (doseIds.length === 2) {
      const c = combinedDoseDifference(doseIds, week)!;
      out.combinedNote = `Comparative dispensing difference for selected uptake packages (P1 + P2): ${fmtSigned(c.difference, 1)} doses per 10,000 people aged 65+, weighted by the fixed target populations (${fmtInt(c.population)} people aged 65+; treated ${fmtSigned(c.treatedChange, 1)} vs comparison ${fmtSigned(c.comparisonChange, 1)}). Equivalent to a comparative difference of ${fmtInt(c.countDifference)} dispensing-proxy doses, not attributed vaccinations. P3 is reported separately in percentage points and is never added to this figure.`;
    }
  }

  out.actions = r.action_ids.filter((a) => {
    if (a === 'print_outcome') return hasSimulation && week > 0 && !out.fallback;
    if (a === 'open_outcome_review') return hasSimulation && !out.fallback;
    return true;
  });
  if (out.fallback && !out.actions.includes('open_plan')) out.actions = ['open_plan', ...out.actions];
  return out;
}

/* ---------- welcome / contextual introduction ---------- */

export function welcomeFor(ctx: Context, mode: Mode, week: Week, selected: PackageId[]): { paragraphs: string[]; sourceIds: string[] } {
  const paras: string[] = [];
  const sourceIds: string[] = [];
  if (mode === 'plan') {
    if (ctx.kind === 'france') {
      paras.push(
        `Official coverage among adults aged 65+ was ${fmtPct(NATIONAL.vcr_65plus)} in ${NATIONAL.season} (France-wide), up ${Math.abs(NATIONAL_CHANGE_PP).toFixed(1)} pp on ${fmtPct(NATIONAL.previous_season_vcr_65plus)} in 2024–25 and ${GAP_TO_TARGET.toFixed(1)} pp below the 75% policy reference.`,
        'The map covers 96 metropolitan departments grouped into four illustrative profiles. Total uptake, enhanced-vaccine adoption and Efluelda performance are three related but separate questions.',
      );
      sourceIds.push('spf_bulletin', 'synthetic_model');
    } else if (ctx.kind === 'cluster') {
      const c = CLUSTER_BY_ID.get(ctx.id)!;
      const s = clusterStats(ctx.id);
      paras.push(
        `${c.name}: ${c.description} ${s.count} metropolitan departments; observed 2025–26 coverage ranges from ${fmtPct(s.min)} to ${fmtPct(s.max)} (department median ${fmtPct(s.medianVcr)}).`,
        'Illustrative cluster: a designed assignment, not a fitted French model.',
      );
      sourceIds.push('spf_vcr', 'synthetic_model');
    } else {
      const d = DEPT_BY_CODE.get(ctx.code);
      if (d) {
        paras.push(...localSummaryFor(d.code));
        if (!d.featured) paras.push('Prepared interpretation for this department is cluster-level; featured departments have fuller scenarios.');
      }
      sourceIds.push('spf_vcr', 'synthetic_model');
    }
    paras.push('Choose a prepared question below.');
  } else {
    const dates = checkpointDates(week);
    paras.push(
      `Simulated 2026–27 review, ${weekLabel(week)} (${fmtDate(dates.review_date)}). Commercial observations run to ${fmtDate(dates.data_through)}.`,
    );
    const scoped = scopedPackages(ctx, selected);
    if (ctx.kind === 'france') paras.push(`${selected.length} package${selected.length === 1 ? '' : 's'} in the simulation snapshot: ${selected.join(', ')}.`);
    else if (scoped.length) paras.push(`Selected package in this area: ${scoped.map((p) => `${p.id} ${p.title}`).join('; ')}.`);
    else paras.push('No selected intervention in this area.');
    sourceIds.push('synthetic_activity', 'synthetic_commercial');
  }
  return { paragraphs: paras, sourceIds };
}

/* ---------- optional free text: deterministic keyword intents ---------- */

const PLAN_KEYWORDS: Record<string, string[]> = {
  profile: ['profile', 'distinguish', 'cluster', 'describe', 'overview', 'what is this', 'tell me about', 'summary', 'summarise', 'summarize'],
  explain_gap: ['gap', 'explain', 'why', 'reason', 'driver', 'cause', 'low coverage', 'lower', 'barrier'],
  public_affairs: ['public affairs', 'influence', 'control', 'affairs', 'stakeholder', 'advocacy'],
  commercial: ['efluelda', 'commercial', 'brand', 'share', 'sales', 'vaxigrip', 'fluad', 'marketing', 'market access'],
  design_plan: ['design', 'plan', 'intervention', 'package', 'action', 'activity', 'activate', 'what should we do', 'propose'],
  sources: ['source', 'evidence', 'data', 'reference', 'cite', 'citation', 'inform', 'document'],
};

const MONITOR_KEYWORDS: Record<string, string[]> = {
  adapt: ['adapt', 'next step', 'next steps', 'should', 'recommend', 'improve', 'change the team', 'do next', 'decision', 'adjust'],
  performance: ['perform', 'result', 'outcome', 'work', 'effective', 'success', 'signal'],
  uncertainty: ['uncertain', 'caveat', 'limitation', 'confident', 'causal', 'cause', 'reliable', 'proof', 'prove', 'risk'],
  commercial: ['efluelda', 'commercial', 'brand', 'share', 'sales', 'vaxigrip', 'fluad'],
  sources: ['source', 'evidence', 'data', 'reference', 'cite', 'support'],
  change: ['change', 'changed', 'happen', 'update', 'new', 'progress', 'season', 'so far'],
};

export function matchIntent(text: string, mode: Mode): string | null {
  const t = text.toLowerCase();
  const table = mode === 'plan' ? PLAN_KEYWORDS : MONITOR_KEYWORDS;
  const order: readonly string[] = mode === 'plan' ? PLAN_INTENTS : MONITOR_INTENTS;
  const prompts = mode === 'plan' ? UI.prompts.plan : UI.prompts.monitor;
  for (const i of order) {
    if (prompts[i].toLowerCase().replace(/[?.]/g, '') === t.replace(/[?.]/g, '').trim()) return i;
  }
  let best: string | null = null;
  let bestScore = 0;
  const keys = Object.keys(table);
  for (const intent of keys) {
    let score = 0;
    for (const kw of table[intent]) if (t.includes(kw)) score += kw.length > 6 ? 2 : 1;
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

export { ctxKey };
