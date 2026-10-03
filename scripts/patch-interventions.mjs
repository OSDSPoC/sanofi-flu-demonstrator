// One-off content revision of src/data/interventions.json (revision brief 08, sections 3 and 5).
// Numbers, checkpoints and populations are untouched; only visible copy and role lists change. Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/data/interventions.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const by = Object.fromEntries(j.packages.map((p) => [p.id, p]));

const COMPARATOR = 'Matched comparison catchments that are not participating. Matching uses baseline trajectory and relevant characteristics, not cluster membership alone.';
const FOOTPRINT = 'Defined participating catchments within the department, not the whole department. Package populations do not overlap.';
for (const p of j.packages) {
  p.comparator = COMPARATOR;
  p.footprint_note = FOOTPRINT;
}

Object.assign(by.P1, {
  rationale: 'Access index 35/100 and availability index 48/100 point to delivery conditions worth investigating. Coverage is 50.7%.',
  roles: [
    'Market Access coordinates delivery with local providers and partners',
    'Public Affairs supports stakeholder coordination',
    'Commercial separately checks product availability',
  ],
});

Object.assign(by.P2, {
  title: 'Strengthen recommendations and follow-through',
  lead: 'Public Affairs (coordination)',
  support: ['Medical', 'Participating pharmacies and practices', 'Market Access (delivery barriers where relevant)'],
  hypothesis:
    'Where access is available but recommendation and follow-through are weaker, coordinated provider recommendations, community information and reminders may help more eligible older adults complete vaccination.',
  actions: [
    'Medical supports a short briefing for participating pharmacies and practices on proactive recommendations to eligible adults aged 65+.',
    'Public Affairs coordinates existing community partners to share clear information about eligibility and local vaccination access.',
    'Participating providers use their own reminder processes to help eligible adults follow through.',
    'The team records which sites have started the activities and reviews execution and dispensing trends fortnightly.',
  ],
  roles: [
    'Public Affairs coordinates partners',
    'Medical supports accurate information',
    'Participating providers own recommendations, reminders and vaccination delivery',
    'Market Access supports delivery barriers where relevant',
    'Patient-level reminder data stay with providers',
  ],
  rationale:
    'Coverage is 46.4%, with a larger gap among adults aged 65–74 than those aged 75+. Access (66) and availability (86) are relatively strong, while provider engagement (34) and recommendation (40) are weak. Local partners should validate this interpretation.',
  final_decision:
    'Continue where delivery is established, complete the remaining site, and refine partner messaging or reminder execution. Whether to extend the approach to other Activation-gap departments is a decision for the team.',
});

Object.assign(by.P3, {
  rationale: 'Coverage is 59.3%. Enhanced vaccines account for 40% of observed 65+ flu dispensing at baseline.',
  roles: [
    'Medical and Market Access lead recommendation and pathway education',
    'Public Affairs supports stakeholder implementation',
    'Commercial separately investigates Efluelda availability and account execution',
  ],
});

for (const p of j.packages) for (const c of p.checkpoints) if (c.week === 0) c.execution = 'Baseline: no activity has started yet.';

fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
console.log('patched', j.packages.map((p) => `${p.id}: ${p.title}`).join(' | '));
