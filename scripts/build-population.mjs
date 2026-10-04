// Builds src/data/population_65plus.json from the INSEE departmental population release, and applies it to departments.json.
//
// Source: INSEE, "Estimation de la population au 1er janvier 2026", table "Estimation de population au 1er janvier, par département,
// sexe et âge quinquennal" (https://www.insee.fr/fr/statistiques/8721456, file estim-pop-dep-sexe-aq-1975-2026.xlsx).
// Run:   npm i --no-save xlsx   (not a project dependency)
//        node scripts/build-population.mjs path/to/estim-pop-dep-sexe-aq-1975-2026.xlsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/build-population.mjs <insee xlsx>');

const buf = fs.readFileSync(file);
const sha = crypto.createHash('sha256').update(buf).digest('hex');
const wb = XLSX.read(buf);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['2026'], { header: 1 });
const header = rows[4]; // age bands for "Ensemble" start at column 2
const bands = header.slice(2, 23);
const first65 = bands.indexOf('65 à 69 ans') + 2;
const last = bands.indexOf('95 ans et plus') + 2;
const totalCol = bands.indexOf('Total') + 2;
if (first65 < 2 || last < first65 || totalCol < last) throw new Error('unexpected column layout');

const out = {};
for (const r of rows) {
  if (r[0] == null || r[1] == null || typeof r[totalCol] !== 'number') continue;
  const code = String(r[0]);
  let pop65 = 0;
  for (let c = first65; c <= last; c++) {
    if (typeof r[c] !== 'number') {
      pop65 = null;
      break;
    }
    pop65 += r[c];
  }
  out[code] = { name: r[1], pop_65plus: pop65, pop_total: r[totalCol] };
}

const depFile = path.join(root, 'src/data/departments.json');
const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
let missing = 0;
for (const d of dep.departments) {
  const p = out[d.code];
  if (!p || p.pop_65plus == null) {
    missing++;
    d.illustrative.eligible_population_65plus = null;
    d.illustrative.unvaccinated_opportunity = null;
    continue;
  }
  if (!(p.pop_65plus > 0 && p.pop_65plus < p.pop_total)) throw new Error(`implausible 65+ population for ${d.code}`);
  d.illustrative.eligible_population_65plus = p.pop_65plus;
  d.illustrative.unvaccinated_opportunity =
    d.historical.vcr_65plus == null ? null : p.pop_65plus * (1 - d.historical.vcr_65plus / 100);
}
fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + '\n');

const meta = {
  source: 'INSEE, Estimation de la population au 1er janvier 2026',
  table: 'Estimation de population au 1er janvier, par département, sexe et âge quinquennal',
  page_url: 'https://www.insee.fr/fr/statistiques/8721456',
  file_url: 'https://www.insee.fr/fr/statistiques/fichier/8721456/estim-pop-dep-sexe-aq-1975-2026.xlsx',
  file_sha256: sha,
  reference_date: '2026-01-01',
  data_updated: '2025-12-23 (early results to end 2025)',
  acquired: '2026-10-04',
  definition: 'Population aged 65 and over = sum of the age bands 65–69, 70–74, 75–79, 80–84, 85–89, 90–94 and 95+, both sexes. Age is the age reached on 1 January.',
  geography: 'Department codes as published by INSEE; Rhône (69) covers the whole department including the Métropole de Lyon; Corsica as 2A and 2B.',
  coverage_season_paired: '2025–26',
  departments: out,
};
fs.writeFileSync(path.join(root, 'src/data/population_65plus.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`population for ${Object.keys(out).length} departments; ${missing} department records without a value`);
