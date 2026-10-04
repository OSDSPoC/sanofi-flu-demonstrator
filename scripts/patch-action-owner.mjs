// Final content fix: one Action / Owner table per package (brief 10, section 3). Idempotent.
// Replaces the separate actions and roles lists with `action_rows`, and moves the patient-data point into `notes`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/data/interventions.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const by = Object.fromEntries(j.packages.map((p) => [p.id, p]));

const REVIEW_OWNER = 'Public Affairs coordinates the team review; participating sites record execution; Market Access supports delivery issues';
const REVIEW_ACTION = 'Record site activation and review execution and dispensing trends fortnightly';

by.P1.action_rows = [
  { action: 'Confirm appointment capacity with participating providers', owner: 'Market Access coordinates with providers' },
  { action: 'Share clear local appointment information through existing channels', owner: 'Public Affairs supports partners and local stakeholders' },
  { action: 'Review availability at participating pharmacies', owner: 'Participating pharmacies, with Market Access; Commercial separately checks product availability' },
  { action: REVIEW_ACTION, owner: REVIEW_OWNER },
];
by.P1.notes = [];

by.P2.action_rows = [
  {
    action: 'Brief participating pharmacies and practices on proactive recommendations to eligible adults aged 65+',
    owner: 'Medical supports the briefing; participating providers implement recommendations',
  },
  {
    action: 'Share clear eligibility and local vaccination-access information through existing community partners',
    owner: 'Public Affairs coordinates partners, with Medical input',
  },
  { action: 'Use providers’ existing reminder processes to help eligible adults follow through', owner: 'Participating providers' },
  { action: REVIEW_ACTION, owner: REVIEW_OWNER },
];
by.P2.notes = ['Patient-level reminder data stay with providers.'];

by.P3.action_rows = [
  { action: 'Brief participating teams on the equivalent HAS positioning of Efluelda and Fluad', owner: 'Medical leads; Market Access supports' },
  { action: 'Review the local pathway and availability of recommended options', owner: 'Market Access leads, with participating sites' },
  { action: 'Record questions that prevent consistent implementation', owner: 'Participating sites record; Public Affairs supports stakeholder follow-up' },
  { action: 'Investigate Efluelda account availability separately', owner: 'Commercial, separate from the Public Affairs implementation work' },
];
by.P3.notes = ['Efluelda availability and account execution are Commercial questions; Public Affairs is not assigned sales execution.'];

for (const p of j.packages) {
  p.actions = p.action_rows.map((r) => r.action);
  delete p.roles;
}

fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
console.log('action/owner rows:', j.packages.map((p) => `${p.id}=${p.action_rows.length}`).join(' '));
