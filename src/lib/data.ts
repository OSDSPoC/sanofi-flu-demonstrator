import departmentsRaw from '../data/departments.json';
import clustersRaw from '../data/clusters.json';
import interventionsRaw from '../data/interventions.json';
import sourcesRaw from '../data/sources.json';
import playbooksRaw from '../data/illustrative_playbooks.json';
import uiRaw from '../data/ui_config.json';
import type { ClusterDef, ClusterId, Department, PackageId, Pkg, SourceItem } from './types';

export const NATIONAL = departmentsRaw.national_reference as {
  season: string;
  vcr_65plus: number;
  previous_season_vcr_65plus: number;
  target_pct: number;
  scope: string;
};

export const DEPARTMENTS = departmentsRaw.departments as unknown as Department[];
export const METRO_DEPARTMENTS = DEPARTMENTS.filter((d) => d.metropolitan);
export const DEPT_BY_CODE = new Map(DEPARTMENTS.map((d) => [d.code, d]));

export const CLUSTERS = clustersRaw.clusters as unknown as ClusterDef[];
export const CLUSTER_BY_ID = new Map(CLUSTERS.map((c) => [c.id, c]));
export const DRIVER_SCALE = clustersRaw.driver_scale;

export const SCENARIO = interventionsRaw as unknown as {
  scenario: string;
  start_date: string;
  checkpoints: { week: 0 | 2 | 4 | 6; review_date: string; data_through: string }[];
  packages: Pkg[];
  aggregation: string;
};
export const PACKAGES = SCENARIO.packages;
export const PACKAGE_BY_ID = new Map(PACKAGES.map((p) => [p.id, p]));

export const SOURCES = (sourcesRaw as unknown as { sources: SourceItem[] }).sources;
export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
export const SOURCES_CUTOFF = (sourcesRaw as unknown as { research_cutoff: string }).research_cutoff;

export const PLAYBOOKS = playbooksRaw as { id: string; title: string; status: string; rules: string[] }[];
export const PLAYBOOK_BY_ID = new Map(PLAYBOOKS.map((p) => [p.id, p]));

export const UI = uiRaw as unknown as {
  title: string;
  subtitle: string;
  prototype_label: string;
  monitor_label: string;
  optional_free_text_fallback: string;
  featured_department_codes: string[];
  season_labels: { plan: string; monitor: string };
};

export const FEATURED_CODES = UI.featured_department_codes;
export const FEATURED = FEATURED_CODES.map((c) => DEPT_BY_CODE.get(c)!).filter(Boolean);

export const CLUSTER_ORDER: ClusterId[] = ['access', 'activation', 'enhanced', 'strong'];

/** Non-colour cue for each cluster: letter badge. */
export const CLUSTER_GLYPH: Record<ClusterId, string> = {
  access: 'A',
  activation: 'B',
  enhanced: 'C',
  strong: 'D',
};

export const PACKAGE_IDS: PackageId[] = ['P1', 'P2', 'P3'];

/** Order matches clusters.json `driver_template`. */
export const DRIVER_LABELS: { key: keyof Department['illustrative']['driver_indexes']; label: string; influenceable: boolean }[] = [
  { key: 'access_index', label: 'Access', influenceable: true },
  { key: 'hcp_engagement_index', label: 'Provider engagement', influenceable: true },
  { key: 'confidence_index', label: 'Public confidence', influenceable: false },
  { key: 'availability_index', label: 'Local availability', influenceable: true },
  { key: 'recommendation_index', label: 'Recommendation', influenceable: true },
];

/** The package prepared for a department, if any. */
export function packageForDepartment(code: string): Pkg | undefined {
  return PACKAGES.find((p) => p.department_code === code);
}
