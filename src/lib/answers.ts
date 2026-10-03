import { CLUSTER_BY_ID, DEPT_BY_CODE, DRIVER_LABELS, NATIONAL, PACKAGE_BY_ID, UI, packageForDepartment } from './data';
import {
  GAP_TO_TARGET,
  NATIONAL_CHANGE_PP,
  checkpointDates,
  clusterStats,
  combinedDoseDifference,
  fmtDate,
  fmtEst,
  fmtInt,
  fmtPct,
  fmtSigned,
  packageAt,
  scopedPackages,
  weekLabel,
} from './calc';
import type { Answer, ClusterId, Context, Department, Mode, PackageId, Pkg, Week } from './types';

/* =========================================================================================
   Prepared, scripted answers. Each answer leads with the decision, then the reasoning, then a
   visible next action; evidence, definitions and uncertainty sit in an expandable section.
   No model call is made: copy is authored here and numbers are read from the data files.
   ========================================================================================= */

export interface PromptDef {
  intent: string;
  label: string;
}

export interface AnswerInput {
  ctx: Context;
  mode: Mode;
  week: Week;
  intent: string;
  /** Plan: the draft package set. Monitor: the follow-up snapshot. */
  selected: PackageId[];
  hasSimulation: boolean;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = (n: number) => (n >= 0 && n <= 20 ? WORDS[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- prompts offered for each context ---------- */

export function promptsFor(ctx: Context, mode: Mode, selected: PackageId[]): PromptDef[] {
  if (mode === 'monitor') {
    const scoped = scopedPackages(ctx, selected);
    const out: PromptDef[] = [
      { intent: 'progress', label: 'How is the plan progressing?' },
      { intent: 'performance', label: 'How did the intervention perform?' },
      { intent: 'next', label: 'What should the team do next?' },
      { intent: 'uncertain', label: 'What remains uncertain?' },
    ];
    if (scoped.some((p) => p.id === 'P3')) out.push({ intent: 'commercial', label: 'How is Efluelda performing?' });
    out.push({ intent: 'sources', label: 'Which sources support this review?' });
    return out;
  }
  if (ctx.kind === 'france')
    return [
      { intent: 'focus', label: 'Where should we focus?' },
      { intent: 'clusters', label: 'How do clusters help?' },
      { intent: 'efluelda', label: 'How should we examine Efluelda performance?' },
      { intent: 'sources', label: 'Which evidence informs this?' },
    ];
  if (ctx.kind === 'cluster') {
    const out: PromptDef[] = [
      { intent: 'common', label: 'What do these areas have in common?' },
      { intent: 'approach', label: 'What approach could work across this cluster?' },
    ];
    if (ctx.id === 'enhanced') out.push({ intent: 'efluelda', label: 'How should we examine Efluelda performance?' });
    out.push({ intent: 'sources', label: 'Which evidence informs this?' });
    return out;
  }
  const d = DEPT_BY_CODE.get(ctx.code);
  const out: PromptDef[] = [
    { intent: 'opportunity', label: 'Where is the opportunity?' },
    { intent: 'public_affairs', label: 'What can Public Affairs do?' },
    { intent: 'design', label: 'Help us design an intervention' },
  ];
  if (d?.illustrative.cluster_id === 'enhanced') out.push({ intent: 'efluelda', label: 'How should we examine Efluelda performance?' });
  out.push({ intent: 'sources', label: 'Which evidence informs this?' });
  return out;
}

export function answerKey(i: Pick<AnswerInput, 'ctx' | 'mode' | 'week' | 'intent'>): string {
  const c = i.ctx.kind === 'france' ? 'france' : i.ctx.kind === 'cluster' ? `cluster:${i.ctx.id}` : `department:${i.ctx.code}`;
  return `${c}|${i.mode}|${i.mode === 'plan' ? 0 : i.week}|${i.intent}`;
}

/* ---------- shared helpers ---------- */

function driverEvidence(d: Department): string {
  return DRIVER_LABELS.map((l) => `${l.label} ${d.illustrative.driver_indexes[l.key]}`).join(', ');
}

function ageLine(d: Department): string {
  const h = d.historical;
  const gap = h.vcr_65_74 != null && h.vcr_75plus != null && h.vcr_65_74 < h.vcr_75plus ? ', with a larger gap among adults aged 65–74 than those aged 75+' : '';
  return `Coverage is ${fmtPct(h.vcr_65plus)}${gap}.`;
}

function design(pkg: Pkg): { rec: string; body: string } {
  const pop = fmtEst(pkg.target_population_65plus);
  if (pkg.id === 'P2')
    return {
      rec: 'Run a six-week package through 20 participating sites.',
      body: 'Brief pharmacies and practices, equip existing community partners with clear local information, and support provider-managed reminders. Review delivery after two weeks, then comparative dispensing trends at four and six weeks.',
    };
  if (pkg.id === 'P1')
    return {
      rec: `Run a six-week package through ${pkg.target_sites} participating sites.`,
      body: `Confirm appointment capacity, simplify appointment information and review pharmacy availability, starting with catchments covering about ${pop} adults aged 65+. Review delivery after two weeks, then comparative dispensing trends at four and six weeks.`,
    };
  return {
    rec: `Run a six-week package through ${pkg.target_sites} participating sites.`,
    body: `Brief teams on the equivalent HAS positioning of Efluelda and Fluad, review the local pathway and availability, and record what prevents consistent implementation. Review delivery after two weeks, then enhanced-category share at four and six weeks.`,
  };
}

const CLUSTER_ACTION = (id: ClusterId): string => `explore_department:${CLUSTER_BY_ID.get(id)!.featured_department}`;

/* ---------- plan-mode answers ---------- */

function franceAnswer(intent: string): Answer {
  const key = `france|plan|0|${intent}`;
  const base = { key, intent, evidence: [] as string[], sourceIds: ['spf_bulletin', 'synthetic_model'], actions: [] as string[] };
  const members = (id: ClusterId) => clusterStats(id).count;
  if (intent === 'focus')
    return {
      ...base,
      title: 'Where should we focus?',
      recommendation: 'Explore the Activation-gap profile.',
      body: [
        'Coverage alone tells us where uptake is lower; clusters help us decide what kind of response to consider.',
        'Activation gap covers areas where access looks relatively stronger than recommendation and engagement.',
      ],
      actions: ['explore_cluster:activation'],
      evidence: [
        `France-wide coverage among adults aged 65+ was ${fmtPct(NATIONAL.vcr_65plus)} in ${NATIONAL.season}, against ${fmtPct(NATIONAL.previous_season_vcr_65plus)} in 2024–25 (${fmtSigned(NATIONAL_CHANGE_PP, 1)} pp) and a 75% reference: a gap of ${GAP_TO_TARGET.toFixed(1)} pp.`,
        `Four profiles group the 96 metropolitan departments: Access-constrained (${members('access')}), Activation gap (${members('activation')}), Enhanced-vaccine adoption gap (${members('enhanced')}) and Strong delivery (${members('strong')}).`,
      ],
    };
  if (intent === 'clusters')
    return {
      ...base,
      title: 'How do clusters help?',
      recommendation: 'Use clusters to share a starting approach, then adapt it locally.',
      body: [
        'Areas with similar enabling conditions and barriers can start from the same intervention framework, so the team does not design a separate strategy for each of 96 departments.',
        'Members need not be neighbours. Local teams adapt the partners, sites and messages.',
      ],
      actions: ['explore_cluster:activation'],
      evidence: ['Profiles are built from outcomes, population and context, access and delivery, product and supply, and activity.'],
    };
  if (intent === 'efluelda')
    return {
      ...base,
      title: 'How should we examine Efluelda performance?',
      recommendation: 'Treat Efluelda performance as a separate question from overall uptake.',
      body: [
        'Three measures are related but distinct: how many eligible people are vaccinated, how many receive an enhanced vaccine (Efluelda or Fluad, positioned equivalently by HAS for adults 65+), and Efluelda’s share within that category.',
        'Commercial owns the brand question; Public Affairs and Medical focus on recommendation and access. Vaxigrip, also a Sanofi product, belongs in the franchise picture.',
      ],
      actions: ['explore_department:69'],
      evidence: ['Public Medic’AM reimbursed packs are national and are not doses or a 65+ market share.'],
      sourceIds: ['has_policy', 'medicam', 'synthetic_commercial'],
    };
  return {
    ...base,
    title: 'Which evidence informs this?',
    recommendation: 'Start from the public coverage series, then see how each source is used.',
    body: [
      'Departmental coverage, the national bulletin, IQVIA pharmacy series and Medic’AM packs are public. Profiles, driver scores and the intervention follow-up come from the demonstration model.',
    ],
    actions: ['open_sources'],
    sourceIds: ['spf_vcr', 'spf_bulletin', 'iqvia_public', 'medicam', 'has_policy', 'synthetic_model'],
  };
}

function clusterAnswer(id: ClusterId, intent: string): Answer {
  const c = CLUSTER_BY_ID.get(id)!;
  const st = clusterStats(id);
  const fd = DEPT_BY_CODE.get(c.featured_department)!;
  const key = `cluster:${id}|plan|0|${intent}`;
  const act = id === 'strong' ? [CLUSTER_ACTION(id)] : [CLUSTER_ACTION(id)];
  const evidence = [
    `${st.count} metropolitan departments; observed coverage ${fmtPct(st.min)}–${fmtPct(st.max)} (department median ${fmtPct(st.medianVcr)}).`,
    `Driver profile: ${DRIVER_LABELS.map((l, i) => `${l.label} ${c.driver_template[i]}`).join(', ')}.`,
  ];
  const base = { key, intent, evidence, sourceIds: ['spf_vcr', 'synthetic_model'], actions: act };
  if (intent === 'common') {
    const body: Record<ClusterId, string> = {
      activation:
        'These areas share a pattern of relatively stronger access and availability, with weaker provider engagement and proactive recommendation. That suggests a shared starting approach: strengthen recommendations, trusted community information and follow-through. Local teams should check the pattern before choosing activities.',
      access:
        'These areas share weaker access and availability, with provider engagement and recommendation closer to average. That suggests starting with delivery: appointment information, capacity and pharmacy availability. Local teams should confirm the barrier before choosing activities.',
      enhanced:
        'These areas have reasonable coverage and delivery conditions, but enhanced vaccines account for a lower share of 65+ dispensing. That points to how the recommendation is being implemented locally. Efluelda’s own performance is a separate question for Commercial.',
      strong:
        'These areas combine favourable access, engagement and recommendation with generally stronger uptake. They are a source of delivery practices to examine, not an automatic comparator for other areas.',
    };
    return {
      ...base,
      title: 'What do these areas have in common?',
      recommendation: id === 'strong' ? 'Look at what is working before looking for gaps.' : `Start from a shared approach, then check it locally.`,
      body: [body[id]],
    };
  }
  if (intent === 'approach') {
    const body: Record<ClusterId, string> = {
      activation:
        'Use a common intervention framework across similar areas, then adapt the partner network, sites and messages locally. Public Affairs can coordinate existing partners; Medical supports accurate information; providers deliver recommendations and reminders. Start with a defined local footprint and review delivery before deciding whether to extend it.',
      access:
        'Use a common delivery framework across similar areas: confirm capacity, simplify appointment information and review pharmacy availability, then adapt sites and channels locally. Market Access coordinates with providers; Public Affairs supports stakeholders. Start with a defined local footprint and review delivery before deciding whether to extend it.',
      enhanced:
        'Use a common implementation framework: brief teams on the equivalent HAS positioning of Efluelda and Fluad, review the local pathway and availability, and record what prevents consistent implementation. Medical and Market Access lead; Commercial examines brand questions separately.',
      strong:
        'No intervention package is proposed here. Document the practices behind stronger uptake, test whether they transfer to areas with different conditions, and keep monitoring remaining cohort gaps.',
    };
    return {
      ...base,
      title: 'What approach could work across this cluster?',
      recommendation: id === 'strong' ? 'Share practices, not packages.' : 'Use one framework, adapt it locally.',
      body: [body[id]],
      bullets: c.shared_approach,
    };
  }
  if (intent === 'efluelda') return { ...franceAnswer('efluelda'), key, actions: ['explore_department:69'] };
  return {
    ...base,
    title: 'Which evidence informs this?',
    recommendation: `Coverage ranges are public; the ${c.name} profile is a designed grouping.`,
    body: [
      `Membership follows an authored rule using public coverage, the age profile and area type. Driver scores and the shared approach are demonstration inputs, not fitted results. ${fd.name} is the worked example.`,
    ],
    actions: ['open_sources'],
  };
}

function departmentAnswer(code: string, intent: string, selected: PackageId[]): Answer {
  const d = DEPT_BY_CODE.get(code)!;
  const c = CLUSTER_BY_ID.get(d.illustrative.cluster_id)!;
  const pkg = packageForDepartment(code);
  const key = `department:${code}|plan|0|${intent}`;
  const tail = !d.featured ? `This interpretation uses the ${c.name} profile; no local package is prepared for ${d.name}.` : '';
  const evidence = [
    `Coverage by age: 65–74 ${fmtPct(d.historical.vcr_65_74)}; 75+ ${fmtPct(d.historical.vcr_75plus)}. France-wide 65+ coverage: ${fmtPct(NATIONAL.vcr_65plus)}.`,
    `Driver scores: ${driverEvidence(d)}.`,
    `Expected coverage ${fmtPct(d.illustrative.expected_vcr_65plus)}; observed ${fmtSigned(d.illustrative.observed_minus_expected_pp ?? 0, 1)} pp against it.`,
  ];
  const base = { key, intent, evidence, sourceIds: ['spf_vcr', 'synthetic_model'], actions: ['design_local'] as string[] };
  const withTail = (b: string[]) => (tail ? [...b, tail] : b);

  if (intent === 'opportunity') {
    const focus: Record<ClusterId, string> = {
      activation: 'Focus first on recommendation and follow-through.',
      access: 'Focus first on delivery conditions: access and availability.',
      enhanced: 'Focus first on how the 65+ recommendation is being implemented.',
      strong: 'Learn from what is working, and watch the remaining cohort gaps.',
    };
    const reading: Record<ClusterId, string> = {
      activation: 'The driver profile suggests that access alone may not explain the shortfall.',
      access: 'The driver profile points to access and availability as the first conditions to check.',
      enhanced: 'Delivery conditions look reasonable, but enhanced vaccines account for a lower share of dispensing.',
      strong: 'Enabling conditions are favourable.',
    };
    const next: Record<ClusterId, string> = {
      activation: 'Validate that interpretation with local partners, then concentrate the first package on existing delivery sites.',
      access: 'Validate the barrier with local providers, then concentrate the first package on existing delivery sites.',
      enhanced: 'Validate the pathway with local teams before choosing activities. Efluelda performance is a separate Commercial question.',
      strong: 'Check whether practices here would transfer to areas with different conditions.',
    };
    return {
      ...base,
      title: 'Where is the opportunity?',
      recommendation: focus[d.illustrative.cluster_id],
      body: withTail([`${ageLine(d)} ${reading[d.illustrative.cluster_id]}`, next[d.illustrative.cluster_id]]),
      actions: pkg ? ['design_local'] : ['design_local'],
    };
  }
  if (intent === 'public_affairs') {
    const body: Record<ClusterId, string> = {
      activation:
        'Convene existing community partners and participating providers around a clear local plan. Public Affairs coordinates trusted information and partner engagement; Medical supports the briefing; providers own recommendations, reminders and delivery. Agree who records execution and who reviews the fortnightly signals.',
      access:
        'Convene local providers and partners to confirm delivery capacity and clear appointment information. Public Affairs supports stakeholder coordination; Market Access leads delivery coordination; Commercial separately checks product availability. Agree who records execution and who reviews the fortnightly signals.',
      enhanced:
        'Support stakeholders in implementing the 65+ recommendation. Medical and Market Access lead the education and pathway work; Public Affairs supports implementation with partners; Commercial separately examines Efluelda availability and account execution.',
      strong:
        'Share what works through existing partners, and agree how another area would test those practices. Public Affairs coordinates; providers decide what is feasible locally.',
    };
    return {
      ...base,
      title: 'What can Public Affairs do?',
      recommendation: d.illustrative.cluster_id === 'enhanced' ? 'Support implementation; leave brand questions to Commercial.' : 'Convene the partners and agree who owns what.',
      body: withTail([body[d.illustrative.cluster_id]]),
    };
  }
  if (intent === 'design') {
    if (pkg) {
      const g = design(pkg);
      return {
        ...base,
        title: 'Help us design an intervention',
        recommendation: g.rec,
        body: withTail([g.body]),
        bullets: pkg.actions,
        roles: pkg.roles,
        actions: [`add_plan:${pkg.id}`, 'review_plan'],
        evidence: [`${pkg.target_sites} participating sites; ${fmtEst(pkg.target_population_65plus)} adults aged 65+ in the defined catchments. Start 27 October 2026; reviews on 10 November, 24 November and 8 December.`, ...evidence],
        sourceIds: pkg.source_ids,
      };
    }
    const fd = DEPT_BY_CODE.get(c.featured_department)!;
    const worked = c.default_package ? `${fd.name} is the worked example.` : '';
    return {
      ...base,
      title: 'Help us design an intervention',
      recommendation: c.default_package ? `Adapt the ${c.name} approach to ${d.name}.` : 'No intervention is proposed here.',
      body: withTail([
        c.default_package
          ? `No package is prepared for ${d.name}. Start from the shared approach for this cluster, then adapt partners, sites and messages locally. ${worked}`
          : `No package is prepared for ${d.name}. Use it as a reference for discussion, not as a comparator for other areas.`,
      ]),
      bullets: c.shared_approach,
      actions: c.default_package ? [`explore_department:${c.featured_department}`] : [],
    };
  }
  if (intent === 'efluelda') {
    return {
      ...base,
      title: 'How should we examine Efluelda performance?',
      recommendation: 'Examine Efluelda performance separately from category adoption.',
      body: withTail([
        'Enhanced vaccines (Efluelda and Fluad, positioned equivalently by HAS for adults 65+) are the category the recommendation addresses. Efluelda’s share within the category is a commercial question owned by Commercial.',
      ]),
      evidence: [
        `Enhanced vaccines are ${d.illustrative.enhanced_share_of_65plus_dispensing_pct}% of observed 65+ flu dispensing; Efluelda is ${d.illustrative.efluelda_share_of_enhanced_dispensing_pct}% of enhanced dispensing. Different denominators.`,
        ...evidence,
      ],
      sourceIds: ['has_policy', 'synthetic_commercial', 'playbook_commercial'],
    };
  }
  return {
    ...base,
    title: 'Which evidence informs this?',
    recommendation: `Coverage for ${d.name} is public; the profile and driver scores are designed inputs.`,
    body: withTail([
      'Coverage by age comes from the departmental series. Driver scores, expected coverage and the proposed package come from the demonstration model and the access playbook.',
    ]),
    actions: ['open_sources'],
    sourceIds: ['spf_vcr', 'synthetic_model', 'playbook_access'],
  };
}

/* ---------- monitor-mode answers ---------- */

function packageLine(pkg: Pkg, week: Week): string {
  const cp = packageAt(pkg, week);
  const active = `${cap(word(cp.sites_active ?? 0))} of ${word(cp.sites_total ?? 0)} sites ${pkg.id === 'P3' ? 'are briefed or active' : 'are active'}.`;
  const t = cp.treated_change ?? 0;
  const c = cp.comparison_change ?? 0;
  const diff = cp.comparative_change_difference ?? 0;
  if (week === 0) return 'Baseline is set; no activity has started yet.';
  if (pkg.metric_type === 'dose_rate') {
    if (diff === 0)
      return `${active} Dispensing has increased by ${t} per 10,000 adults aged 65+ in both participating and comparison catchments, so there is no comparative separation yet.`;
    const lead = week === 6 ? 'a favourable comparative difference of' : 'a comparative difference of';
    return `${active} Dispensing ${week === 6 ? 'increased' : 'has increased'} by ${t} per 10,000 adults aged 65+ in participating catchments, compared with ${c} in the comparison catchments: ${lead} ${diff}.`;
  }
  const ef = cp.efluelda_share_within_enhanced_pct;
  if (diff === 0)
    return `${active} Enhanced-category share has risen by ${t} percentage points in both participating and comparison catchments, so there is no comparative separation yet. Efluelda’s share within enhanced dispensing is ${ef}%.`;
  return `${active} Enhanced-category share rose ${t} percentage points in participating catchments, against ${c} in comparison catchments: a difference of ${diff}. Efluelda’s share within enhanced dispensing stays at ${ef}%.`;
}

export function weekRecommendation(pkg: Pkg, week: Week, intent: string): string {
  if (week === 0) return intent === 'next' ? 'Confirm the participating sites and start dates before follow-up begins.' : 'Confirm sites and start dates.';
  if (week === 2) return 'Complete rollout and check execution before judging outcomes.';
  if (week === 4) return 'Keep delivery on track and hold judgement until the six-week review.';
  if (pkg.id === 'P2') return 'Complete the remaining site and review which audiences are still being missed.';
  if (pkg.id === 'P1') return 'Resolve the remaining site barrier and collect administration evidence before attributing gains.';
  return 'Retain the category education, and ask Commercial to examine absolute Efluelda dispensing, availability and account execution.';
}

const NEXT_P2_6 =
  'Complete the remaining site, examine which audiences have not been reached, and refine partner messaging or reminder execution where needed. Review the comparative signal and concurrent activity with the team. If the evidence and delivery capacity support it, consider adapting the approach in other Activation-gap departments.';

function evidenceFor(pkgs: Pkg[], week: Week): string[] {
  const d = checkpointDates(week);
  const lines: string[] = [`Review ${fmtDate(d.review_date)} (${weekLabel(week)}); observations through ${fmtDate(d.data_through)}.`];
  for (const p of pkgs) {
    const cp = packageAt(p, week);
    const b = packageAt(p, 0);
    if (p.metric_type === 'dose_rate')
      lines.push(
        `${p.id}: participating ${fmtInt(b.treated_level)} → ${fmtInt(cp.treated_level)} (${fmtSigned(cp.treated_change ?? 0)}); comparison ${fmtInt(b.comparison_level)} → ${fmtInt(cp.comparison_level)} (${fmtSigned(cp.comparison_change ?? 0)}); difference ${fmtSigned(cp.comparative_change_difference ?? 0)}. Dispensing proxy per 10,000 adults aged 65+ in fixed participating catchments.`,
      );
    else
      lines.push(
        `${p.id}: enhanced share of observed 65+ flu dispensing ${b.treated_level}% → ${cp.treated_level}% (${fmtSigned(cp.treated_change ?? 0)} pp) vs comparison ${b.comparison_level}% → ${cp.comparison_level}% (${fmtSigned(cp.comparison_change ?? 0)} pp); difference ${fmtSigned(cp.comparative_change_difference ?? 0)} pp. Efluelda share within enhanced dispensing ${cp.efluelda_share_within_enhanced_pct}% (enhanced doses are the denominator).`,
      );
  }
  lines.push('Comparison group: matched catchments that are not participating, matched on baseline trajectory and relevant characteristics.');
  return lines;
}

function monitorAnswer(input: AnswerInput): Answer {
  const { ctx, week, intent, selected } = input;
  const scoped = scopedPackages(ctx, selected);
  const key = answerKey({ ctx, mode: 'monitor', week, intent });
  const dates = checkpointDates(week);
  const base: Answer = {
    key,
    intent,
    title: '',
    recommendation: '',
    body: [],
    actions: [],
    evidence: [],
    sourceIds: ['synthetic_activity', 'synthetic_commercial'],
  };
  const titles: Record<string, string> = {
    progress: 'How is the plan progressing?',
    performance: 'How did the intervention perform?',
    next: 'What should the team do next?',
    uncertain: 'What remains uncertain?',
    commercial: 'How is Efluelda performing?',
    sources: 'Which sources support this review?',
  };
  base.title = titles[intent] ?? intent;

  if (intent === 'sources') {
    return {
      ...base,
      recommendation: 'Check the data-through date before reading any figure.',
      body: [
        `This review uses ${fmtDate(dates.data_through)} as its data-through date, three days before the ${fmtDate(dates.review_date)} review. Dispensing and execution observations follow a fortnightly refresh, a scenario assumption described in Sources. Historical coverage and policy sources provide context.`,
      ],
      actions: ['open_sources'],
      sourceIds: ['synthetic_activity', 'synthetic_commercial', 'spf_vcr', 'iqvia_public', 'gers'],
    };
  }
  if (intent === 'uncertain') {
    return {
      ...base,
      recommendation: 'Treat the comparison as a signal to discuss, not proof.',
      body: [
        'Dispensing is a useful short-cycle signal, but it does not confirm administration. Comparison catchments help interpret seasonal movement; they do not establish causation. Review other campaign activity, data completeness and delivery differences, and reconcile with coverage evidence when available.',
      ],
      evidence: scoped.length ? evidenceFor(scoped, week) : [],
      uncertainty: 'Other professionals also administer vaccines, so dispensing and administration can differ. Official coverage may be reconciled later.',
    };
  }
  if (!scoped.length) {
    return { ...base, recommendation: '', fallback: 'No intervention was assigned here, so there is no intervention outcome to review.', actions: ctx.kind === 'france' ? [] : ['review_plan'] };
  }
  if (intent === 'commercial') {
    const p3 = scoped.find((p) => p.id === 'P3');
    if (!p3)
      return { ...base, recommendation: '', fallback: 'No brand-share outcome is assigned to the selected packages. Efluelda share cannot be read from a dispensing increase.' };
    const cp = packageAt(p3, week);
    if (week === 6)
      return {
        ...base,
        recommendation: 'Examine absolute Efluelda dispensing, availability and account execution before judging performance.',
        body: [
          'Enhanced-category adoption is progressing, while Efluelda retains its share within the category. Stable share in a growing category can still mean higher brand volume.',
          'Commercial owns that investigation. These share figures alone do not establish volume or financial results.',
        ],
        evidence: evidenceFor([p3], week),
        sourceIds: ['synthetic_activity', 'synthetic_commercial', 'playbook_commercial', 'has_policy'],
      };
    return {
      ...base,
      recommendation: 'Keep category adoption and brand share apart.',
      body: [
        `Enhanced-category share is ${cp.treated_level}% in participating catchments and ${cp.comparison_level}% in comparison catchments. Efluelda’s share within enhanced dispensing is ${cp.efluelda_share_within_enhanced_pct}%.`,
      ],
      evidence: evidenceFor([p3], week),
      sourceIds: ['synthetic_activity', 'synthetic_commercial', 'playbook_commercial', 'has_policy'],
    };
  }

  // progress / performance / next
  const multi = scoped.length > 1;
  const body: string[] = [];
  const bullets: string[] = [];
  let rec: string;
  if (!multi) {
    const p = scoped[0];
    rec = weekRecommendation(p, week, intent);
    if (intent === 'next' && week === 6 && p.id === 'P2') body.push(NEXT_P2_6);
    else if (intent === 'next' && week === 6) body.push(p.final_decision);
    else if (intent === 'next') body.push(`${packageLine(p, week)}`);
    else body.push(packageLine(p, week));
    if (week === 2 && intent !== 'next')
      body.push(
        p.metric_type === 'dose_rate'
          ? 'Focus the next review on activating the remaining sites and checking that recommendations and reminders are being delivered consistently.'
          : 'Focus the next review on briefing the remaining sites and checking that the pathway questions are being recorded.',
      );
    if (week === 6 && intent !== 'next') body.push('This supports a team discussion about continuing the approach, while checking remaining delivery gaps and other campaign activity.');
  } else {
    rec = intent === 'next' ? 'Review each package with its owner, starting with execution.' : 'Review each package with its owner before comparing them.';
    for (const p of scoped) bullets.push(`${p.id} ${p.title}: ${intent === 'next' && week === 6 ? p.final_decision : packageLine(p, week)}`);
    const dose = scoped.filter((p) => p.metric_type === 'dose_rate').map((p) => p.id);
    if (dose.length === 2 && week > 0) {
      const c = combinedDoseDifference(dose, week)!;
      body.push(
        `Comparative dispensing difference for selected uptake packages: ${fmtSigned(c.difference, 1)} doses per 10,000 adults aged 65+, weighted by target population. Percentage-point measures are reported separately.`,
      );
    }
  }
  const actions: string[] = [];
  if (week > 0) actions.push('open_outcome_review');
  if (intent === 'next' && week === 6) actions.unshift('print_outcome');
  return {
    ...base,
    recommendation: rec,
    body,
    bullets: bullets.length ? bullets : undefined,
    actions,
    evidence: evidenceFor(scoped, week),
    sourceIds: Array.from(new Set(scoped.flatMap((p) => p.source_ids))),
  };
}

/* ---------- entry point ---------- */

export function buildAnswer(input: AnswerInput): Answer {
  const { ctx, mode, intent, selected, hasSimulation } = input;
  void hasSimulation;
  if (mode === 'monitor') return monitorAnswer(input);
  if (ctx.kind === 'france') return franceAnswer(intent);
  if (ctx.kind === 'cluster') return clusterAnswer(ctx.id, intent);
  return departmentAnswer(ctx.code, intent, selected);
}

/* ---------- context introductions ---------- */

export function welcomeFor(ctx: Context, mode: Mode, week: Week, selected: PackageId[]): string[] {
  if (mode === 'plan') {
    if (ctx.kind === 'france') return ['Ask where to focus, or explore a cluster on the map.'];
    if (ctx.kind === 'cluster') return [`${CLUSTER_BY_ID.get(ctx.id)!.name}. Ask what these areas have in common and what approach could work across them.`];
    const d = DEPT_BY_CODE.get(ctx.code);
    return [`${d?.name ?? ctx.code}. Ask where the opportunity is, or how to design a local intervention.`];
  }
  const dates = checkpointDates(week);
  const scoped = scopedPackages(ctx, selected);
  const first = `Review ${weekLabel(week)}, ${fmtDate(dates.review_date)}. Observations run through ${fmtDate(dates.data_through)}.`;
  if (ctx.kind === 'france') return [first, `${selected.length} package${selected.length === 1 ? '' : 's'} in follow-up: ${selected.join(', ')}.`];
  if (scoped.length) return [first, `${scoped.map((p) => `${p.id} ${p.title}`).join('; ')}.`];
  return [first, 'No intervention was assigned here, so there is no intervention outcome to review.'];
}

/* ---------- optional free text: deterministic keyword intents ---------- */

const KEYWORDS: Record<string, string[]> = {
  focus: ['focus', 'where should', 'prioritis', 'prioritiz', 'start', 'which area'],
  clusters: ['cluster', 'group', 'segment', 'profile'],
  common: ['common', 'similar', 'distinguish', 'pattern', 'characteris', 'share a', 'profile'],
  approach: ['approach', 'framework', 'across', 'strategy', 'what could work'],
  opportunity: ['opportunity', 'gap', 'why', 'driver', 'explain', 'low coverage', 'lower'],
  public_affairs: ['public affairs', 'influence', 'role', 'partner', 'convene', 'stakeholder'],
  design: ['design', 'intervention', 'package', 'plan', 'activit', 'action'],
  efluelda: ['efluelda', 'brand', 'commercial', 'fluad', 'vaxigrip', 'sales', 'share'],
  commercial: ['efluelda', 'brand', 'commercial', 'fluad', 'vaxigrip', 'sales', 'share'],
  sources: ['source', 'evidence', 'data', 'reference', 'cite', 'inform'],
  progress: ['progress', 'rollout', 'status', 'going', 'changed', 'so far', 'sites'],
  performance: ['perform', 'result', 'outcome', 'signal', 'effective', 'work'],
  next: ['next', 'should', 'adapt', 'recommend', 'decide', 'adjust', 'extend', 'change'],
  uncertain: ['uncertain', 'caveat', 'limit', 'causal', 'confident', 'reliable', 'prove', 'risk'],
};

export function matchIntent(text: string, available: PromptDef[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[?.!]/g, '').trim();
  const t = norm(text);
  const exact = available.find((p) => norm(p.label) === t);
  if (exact) return exact.intent;
  let best: string | null = null;
  let bestScore = 0;
  for (const p of available) {
    let score = 0;
    for (const kw of KEYWORDS[p.intent] ?? []) if (t.includes(kw)) score += kw.length > 6 ? 2 : 1;
    if (score > bestScore) {
      best = p.intent;
      bestScore = score;
    }
  }
  return best;
}

export const FALLBACK_TEXT = UI.optional_free_text_fallback;
export { PACKAGE_BY_ID };
