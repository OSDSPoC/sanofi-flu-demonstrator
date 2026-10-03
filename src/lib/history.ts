import vcrRaw from '../data/vcr_history.json';
import iqviaRaw from '../data/iqvia_daily_normalized.json';
import medicamRaw from '../data/medicam_flu_pack_counts.json';
import { median } from './calc';
import { METRO_DEPARTMENTS } from './data';

interface VcrRec {
  an_mesure: string;
  dep: string;
  grip_65plus: number | null;
}
const vcr = (vcrRaw as unknown as { records: VcrRec[] }).records;
const metroCodes = new Set(METRO_DEPARTMENTS.map((d) => d.code));

export const SEASONS = Array.from(new Set(vcr.map((r) => Number(r.an_mesure)))).sort();

/** 65+ coverage by campaign-start year for one department; null stays null. */
export function departmentSeries(code: string): { year: number; v: number | null }[] {
  return SEASONS.map((year) => {
    const r = vcr.find((x) => x.dep === code && Number(x.an_mesure) === year);
    return { year, v: r?.grip_65plus ?? null };
  });
}

/** Median across metropolitan departments with data (not a national or weighted figure). */
export function medianSeries(): { year: number; v: number | null }[] {
  return SEASONS.map((year) => {
    const vals = vcr
      .filter((x) => Number(x.an_mesure) === year && metroCodes.has(x.dep) && x.grip_65plus != null)
      .map((x) => x.grip_65plus as number);
    return { year, v: median(vals) };
  });
}

export const seasonLabel = (y: number) => `${String(y).slice(2)}–${String(y + 1).slice(2)}`;

interface IqRec {
  campagne: string;
  jour: number;
  variable: string;
  groupe: string;
  valeur: number;
  date_iso: string;
}
const iq = (iqviaRaw as unknown as { records: IqRec[] }).records;

/** Cumulative national pharmacy series for adults 65+, by elapsed campaign day. Acts and doses stay separate. */
export function iqviaCumulative(campagne: string, variable: 'ACTE(VGP)' | 'DOSES(J07E1)') {
  const rows = iq
    .filter((r) => r.campagne === campagne && r.variable === variable && r.groupe === '65 ans et plus')
    .sort((a, b) => a.jour - b.jour);
  let run = 0;
  return rows.map((r) => {
    run += r.valeur;
    return { jour: r.jour, v: run, date: r.date_iso };
  });
}

interface McRec {
  product: string;
  reimbursement_month: string;
  reimbursed_packs: number;
}
const mc = medicamRaw as unknown as McRec[];

export const MEDICAM_MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];

export function medicamPacks(family: RegExp, months = MEDICAM_MONTHS) {
  return months.map((m) => ({
    month: m,
    packs: mc.filter((r) => family.test(r.product) && r.reimbursement_month === m).reduce((s, r) => s + r.reimbursed_packs, 0),
  }));
}
