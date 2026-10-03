export type Mode = 'plan' | 'monitor';
export type MapView = 'coverage' | 'clusters' | 'opportunity';
export type Week = 0 | 2 | 4 | 6;
export type ClusterId = 'access' | 'activation' | 'enhanced' | 'strong';
export type PackageId = 'P1' | 'P2' | 'P3';
export type PlanStatus = 'draft' | 'ready' | 'simulation' | 'reviewed';

export type Context =
  | { kind: 'france' }
  | { kind: 'cluster'; id: ClusterId }
  | { kind: 'department'; code: string };

export interface Historical {
  season: string;
  vcr_65plus: number | null;
  vcr_65_74: number | null;
  vcr_75plus: number | null;
  vcr_under65_atrisk: number | null;
  provenance: string;
  source_id: string;
}

export interface Illustrative {
  cluster_id: ClusterId;
  eligible_population_65plus: number;
  unvaccinated_opportunity: number | null;
  expected_vcr_65plus: number;
  observed_minus_expected_pp: number | null;
  driver_indexes: {
    access_index: number;
    hcp_engagement_index: number;
    confidence_index: number;
    availability_index: number;
    recommendation_index: number;
  };
  enhanced_share_of_65plus_dispensing_pct: number;
  efluelda_share_of_enhanced_dispensing_pct: number;
  provenance: string;
  source_ids: string[];
}

export interface Department {
  code: string;
  name: string;
  region_code: string;
  region_name: string;
  featured: boolean;
  metropolitan: boolean;
  historical: Historical;
  illustrative: Illustrative;
}

export interface ClusterDef {
  id: ClusterId;
  name: string;
  color: string;
  description: string;
  defining_features: string[];
  potentially_influenceable: string[];
  context: string[];
  default_package: PackageId | null;
  expected_vcr: number;
  driver_template: number[];
  interpretation: string;
}

export interface Checkpoint {
  week: Week;
  review_date: string;
  data_through: string;
  treated_level?: number;
  comparison_level?: number;
  treated_change?: number;
  comparison_change?: number;
  comparative_change_difference?: number;
  sites_active?: number;
  sites_total?: number;
  execution?: string;
  efluelda_share_within_enhanced_pct?: number;
}

export interface Pkg {
  id: PackageId;
  title: string;
  department_code: string;
  cluster_id: ClusterId;
  lead: string;
  support: string[];
  target_population_65plus: number;
  target_sites: number;
  hypothesis: string;
  actions: string[];
  rationale: string;
  primary_metric: string;
  metric_type: 'dose_rate' | 'share_pct';
  final_decision: string;
  source_ids: string[];
  budget_eur: number | null;
  provenance: string;
  comparator: string;
  footprint_note: string;
  checkpoints: Checkpoint[];
}

export interface SourceItem {
  id: string;
  title: string;
  type: string;
  url?: string;
  owner: string;
  geography: string;
  period: string;
  cadence: string;
  provenance: string;
  purpose: string;
  limitation: string;
}

export interface EvidenceItem {
  text: string;
  package_id: PackageId | null;
}

export interface PreparedResponse {
  id: string;
  context: string;
  mode: Mode;
  week: Week;
  intent: string;
  title: string;
  observation: string;
  evidence: EvidenceItem[];
  interpretation: string;
  ownership: string;
  suggested_action: string;
  measurement: string;
  source_ids: string[];
  action_ids: string[];
  scripted: boolean;
  empty_selection_fallback?: string;
  no_brand_outcome_fallback?: string;
  package_decisions?: { package_id: PackageId; text: string }[];
}

export interface RenderedResponse {
  key: string;
  intent: string;
  title: string;
  observation: string;
  localSummary?: string[];
  clusterNote?: string;
  evidence: string[];
  combinedNote?: string;
  fallback?: string;
  interpretation: string;
  ownership: string;
  suggestedAction: string;
  decisions: string[];
  measurement: string;
  sourceIds: string[];
  actions: string[];
  ruleNote?: string;
}

export type TranscriptItem =
  | { id: string; kind: 'divider'; label: string; sub: string }
  | { id: string; kind: 'welcome'; ctxKey: string; paragraphs: string[]; sourceIds: string[] }
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'advisor'; key: string; scopeLabel: string; dateLabel: string; response: RenderedResponse }
  | { id: string; kind: 'system'; text: string };

export interface PlanDraft {
  title: string;
  objective: string;
  owner: string;
  notes: string;
  budget: string;
  packageIds: PackageId[];
  status: PlanStatus;
}

export interface SimulationSnapshot {
  packageIds: PackageId[];
  title: string;
  objective: string;
  owner: string;
  notes: string;
  budget: string;
}
