// Drives the presenter walkthrough in a real browser (Chrome/Edge via puppeteer-core), saves screenshots and PDFs,
// and checks that the key evidence and the advisor are visible together. Dev-only; not part of the shipped site.
// Usage: start the app (npm run dev, or serve dist/ at the URL), then: node scripts/qa-journey.mjs [url] [outDir]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const URL_ = process.argv[2] || 'http://localhost:5173/';
const OUT = path.resolve(process.argv[3] || 'qa-output');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pdfPages = (f) => (fs.readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
async function printLayout(page, name) {
  await page.emulateMediaType('print');
  const vp = page.viewport();
  await page.setViewport({ ...vp, width: 718, height: 1000 });
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  await page.emulateMediaType('screen');
  await page.setViewport(vp);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function session(width, height, tag, withPdf) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const external = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(new URL(URL_).origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
  });
  await page.goto(URL_ + (withPdf ? '?printpreview=1' : ''), { waitUntil: 'networkidle0' });
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  const click = async (sel, text) => {
    const ok = await page.evaluate(
      (sel, text) => {
        const el = [...document.querySelectorAll(sel)].find((x) => x.textContent.replace(/\s+/g, ' ').includes(text) && !x.disabled);
        if (!el) return false;
        el.click();
        return true;
      },
      sel,
      text,
    );
    if (!ok) throw new Error(`click failed: ${sel} "${text}"`);
    await sleep(700);
  };
  const ask = async (label) => click('.starter-btn, .prompt', label);
  const rect = (sel, last = false) =>
    page.evaluate(
      (sel, last) => {
        const els = [...document.querySelectorAll(sel)];
        const el = last ? els[els.length - 1] : els[0];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth };
      },
      sel,
      last,
    );
  const visible = async (sel, last = false) => {
    const r = await rect(sel, last);
    return !!r && r.top >= 0 && r.bottom <= r.vh + 1 && r.right <= r.vw + 1;
  };
  const text = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText).join('\n'), sel);
  const lastAnswer = () => page.evaluate(() => [...document.querySelectorAll('.msg.advisor:not(.welcome)')].pop()?.innerText ?? '');
  // The latest advisor recommendation must be inside the transcript's visible area.
  const advisorVisible = () =>
    page.evaluate(() => {
      const t = document.querySelector('.transcript').getBoundingClientRect();
      const m = [...document.querySelectorAll('.msg.advisor:not(.welcome) .recommendation, .msg.advisor:not(.welcome) .fallback')].pop()?.getBoundingClientRect();
      return !!m && m.top >= t.top - 1 && m.bottom <= t.bottom + 1;
    });
  return { page, shot, click, ask, rect, visible, text, lastAnswer, advisorVisible, errors, external };
}

/* ======================= main journey at 1440x900 ======================= */
{
  const s = await session(1440, 900, '1440', true);
  const { page } = s;
  await s.click('.btn', 'Reset demo');
  check('Reset: France overview, Coverage tab, no packages', (await s.text('.seg.small button.active')).includes('Coverage') && (await s.text('.crumbs .current')).trim() === 'France' && (await s.text('.header-actions .btn')).includes('Intervention plan') && !(await s.text('.header-actions')).includes('Intervention plan ('));
  await s.shot('01-france');

  check('Header has exactly one demonstration notice', (await s.text('.pill')).trim() === 'Demonstrator · public and synthetic data');
  const badges = await page.evaluate(() => document.querySelectorAll('.tag').length);
  check('No provenance badges on the main workspace', badges === 0, `tags=${badges}`);

  await s.ask('Where should we focus?');
  check('Focus answer shows Explore Activation gap', (await s.lastAnswer()).includes('Explore Activation gap'));
  await s.click('.msg-actions .btn', 'Explore Activation gap');
  await s.shot('02-cluster');
  const muted = await page.evaluate(() => document.querySelectorAll('.dept.muted').length);
  const members = await page.evaluate(() => document.querySelectorAll('.dept:not(.muted)').length);
  check('Cluster members highlighted on the map', muted > 0 && members > 5, `members=${members} muted=${muted}`);
  check('Cluster view shows common traits, shared approach and Explore button without scrolling', (await s.visible('.cluster-view .btn.primary.big')) && (await s.text('.cluster-view')).includes('Shared approach'));
  check('Advisor panel visible beside the cluster view', await s.visible('.advisor-panel'));

  await s.ask('What do these areas have in common?');
  await s.ask('What approach could work across this cluster?');
  check('Cluster answer offers Explore Seine-Saint-Denis', (await s.lastAnswer()).includes('Explore Seine-Saint-Denis'));
  await s.shot('03-cluster-advisor');
  await s.click('.msg-actions .btn', 'Explore Seine-Saint-Denis');
  await s.shot('04-dept');
  check('Breadcrumb France → Activation gap → Seine-Saint-Denis', (await s.text('.crumbs')).replace(/\s+/g, ' ').includes('France → B Activation gap → Seine-Saint-Denis'), (await s.text('.crumbs')).replace(/\s+/g, ' '));
  check('1440x900: local evidence visible without scrolling', await s.visible('.dept-main .tiles'));
  check('1440x900: proposed intervention and its buttons visible without scrolling', (await s.visible('.intervention')) && (await s.visible('.intervention .btn.primary')));
  check('1440x900: left workspace does not need scrolling to show intervention', await page.evaluate(() => document.querySelector('.left').scrollTop === 0));

  await s.ask('Where is the opportunity?');
  check('Opportunity answer: coverage 46.4% and age figures', /46\.4%/.test(await s.lastAnswer()) && /Focus first on recommendation and follow-through/.test(await s.lastAnswer()));
  check('Advisor recommendation visible beside local evidence', await s.advisorVisible());
  await s.shot('05-dept-advisor');
  await s.ask('What can Public Affairs do?');
  await s.ask('Help us design an intervention');
  const design = await s.lastAnswer();
  check('Design answer: four actions open (no accordion) and owners', (await s.page.evaluate(() => [...document.querySelectorAll('.msg.advisor:not(.welcome)')].pop().querySelectorAll('.actions-list li').length)) === 4 && /Patient-level reminder data stay with providers/.test(design));
  check('Design answer advisor content visible', await s.advisorVisible());
  await s.shot('06-design');
  await s.click('.msg-actions .btn', 'Add to plan');
  check('Add to plan: header shows 1 package', (await s.text('.header-actions')).includes('Intervention plan (1)'));
  await s.click('.msg-actions .btn', 'Review plan');
  await s.shot('07-plan');
  const planText = await s.text('.drawer');
  check('Plan summary shows P2 title, actions, owners, footprint, dates', /Strengthen recommendations and follow-through/.test(planText) && /20 participating sites/.test(planText) && /Medical supports a short briefing/.test(planText) && /Patient-level reminder data stay with providers/.test(planText) && /27 Oct 2026/.test(planText));
  check('Only P2 selected; budget blank', (await page.evaluate(() => document.querySelectorAll('.plan-pkg').length)) === 1 && /Budget: not set/.test(planText));
  check('Edit plan details and Other options are secondary', (await page.evaluate(() => [...document.querySelectorAll('details.fold')].every((d) => !d.open))));

  // print plan -> PDF
  await s.click('.drawer .btn', 'Print plan');
  await sleep(400);
  await page.pdf({ path: path.join(OUT, '1440-plan.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const planPages = pdfPages(path.join(OUT, '1440-plan.pdf'));
  check('Plan PDF is 2 or 3 A4 pages', planPages >= 2 && planPages <= 3, `pages=${planPages}`);
  await printLayout(page, '1440-plan-print.png');
  const statusAfterPrint = await s.text('.stepper li.current');
  check('Printing does not change plan status (still Draft)', /Draft/.test(statusAfterPrint) || statusAfterPrint === '', statusAfterPrint);
  await page.reload({ waitUntil: 'networkidle0' });
  check('Reload after print returns to the same app state (P2 still in plan)', (await s.text('.header-actions')).includes('Intervention plan (1)'));

  await s.click('.header-actions .btn', 'Intervention plan');
  await s.click('.drawer .btn', 'Start follow-up');
  await s.shot('08-followup-baseline');
  check('Follow-up keeps Seine-Saint-Denis context', (await s.text('.crumbs, .scope-row')).includes('Seine-Saint-Denis'));
  check('Date strip shows campaign, review date and observations-through date', /2026–27/.test(await s.text('.date-strip')) && /27 Oct 2026/.test(await s.text('.date-strip')) && /24 Oct 2026/.test(await s.text('.date-strip')));
  check('Results come before geography (package card above the collapsed map)', await page.evaluate(() => { const c = document.querySelector('.pkg-card').getBoundingClientRect(); const g = document.querySelector('.geo-section').getBoundingClientRect(); return c.top < g.top && !document.querySelector('.geo-section').open; }));

  await s.click('.checkpoint-ctl .seg button', '+2 weeks');
  await s.ask('How is the plan progressing?');
  await s.shot('09-plus2');
  const a2 = await s.lastAnswer();
  check('+2: Ten of twenty sites, 160 in both groups, rollout recommendation', /Ten of twenty sites/.test(a2) && /160 per 10,000/.test(a2) && /Complete rollout and check execution before judging outcomes/.test(a2));
  check('+2: date strip shows 10 Nov and 7 Nov', /10 Nov 2026/.test(await s.text('.date-strip')) && /7 Nov 2026/.test(await s.text('.date-strip')));
  const card2 = await s.text('.pkg-card');
  check('+2: card shows 10 of 20, +160, +160, difference 0', /10 of 20/.test(card2) && (card2.match(/\+160/g) || []).length >= 2 && /No separation yet/.test(card2));
  check('+2: result card and advisor visible together at 1440x900', (await s.visible('.pkg-card .tiles')) && (await s.advisorVisible()));

  await s.click('.checkpoint-ctl .seg button', '+4 weeks');
  const card4 = await s.text('.pkg-card');
  check('+4: 17 of 20, +380 vs +280, difference +100', /17 of 20/.test(card4) && /\+380/.test(card4) && /\+280/.test(card4) && /\+100/.test(card4));

  await s.click('.checkpoint-ctl .seg button', '+6 weeks');
  await s.ask('How did the intervention perform?');
  await s.shot('10-plus6');
  const a6 = await s.lastAnswer();
  const card6 = await s.text('.pkg-card');
  check('+6: 19 of 20, +600 vs +450, difference +150', /19 of 20/.test(card6) && /\+600/.test(card6) && /\+450/.test(card6) && /\+150/.test(card6));
  check('+6 answer: wording and recommendation', /Nineteen of twenty sites/.test(a6) && /favourable comparative difference of 150/.test(a6) && /Complete the remaining site and review which audiences are still being missed/.test(a6));
  check('+6: result card and advisor visible together', (await s.visible('.pkg-card .tiles')) && (await s.advisorVisible()));
  await s.ask('What should the team do next?');
  const next = await s.lastAnswer();
  check('Next answer proposes human-reviewed extension, no whole-cluster claim', /consider adapting the approach in other Activation-gap departments/.test(next) && !/the whole cluster|all cluster members/i.test(next));
  await s.shot('11-next');
  check('Status becomes Reviewed after the +6 review', await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanofi-flu-demonstrator:v2')).plan.status === 'reviewed'));
  await s.ask('What remains uncertain?');
  check('Uncertainty answer', /does not confirm administration/.test(await s.lastAnswer()));

  // other areas show no outcomes
  await s.click('.scope-row button', 'All packages');
  check('All packages scope still shows only P2', (await page.evaluate(() => document.querySelectorAll('.pkg-card').length)) === 1);

  // outcome print -> PDF
  await s.click('.results .btn', 'Print outcome review');
  await sleep(400);
  await page.pdf({ path: path.join(OUT, '1440-outcome.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const outPages = pdfPages(path.join(OUT, '1440-outcome.pdf'));
  check('Outcome PDF is 1 to 3 A4 pages', outPages >= 1 && outPages <= 3, `pages=${outPages}`);
  await printLayout(page, '1440-outcome-print.png');
  await page.reload({ waitUntil: 'networkidle0' });
  check('Reload after outcome print keeps follow-up at +6 weeks with P2', /\+6 weeks/.test(await s.text('.date-strip')) && (await s.text('.pkg-card')).includes('P2'));
  await s.click('.btn', 'Reset demo');
  check('Reset after follow-up restores starting state', (await s.text('.crumbs .current')).trim() === 'France' && (await s.text('.header-actions')).includes('Intervention plan') && !(await s.text('.header-actions')).includes('(1)') && (await page.evaluate(() => sessionStorage.length)) === 0);
  check('1440: no console errors', s.errors.length === 0, s.errors.join(' | '));
  check('1440: no external requests', s.external.length === 0, s.external.join(' '));
  await page.close();
}

/* ======================= 1280x800 and mobile fallback ======================= */
for (const [w, h, tag] of [[1280, 800, '1280'], [1920, 1080, '1920'], [390, 800, 'mobile']]) {
  const s = await session(w, h, tag, false);
  const { page } = s;
  await s.click('.btn', 'Reset demo');
  await s.shot('01-france');
  check(`${tag}: no horizontal overflow (France)`, await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
  await s.click('.explore-btn', 'Activation gap');
  await s.shot('02-cluster');
  await s.click('.cluster-view .btn.primary.big', 'Explore Seine-Saint-Denis');
  await s.shot('03-dept');
  if (tag === '1280') {
    check('1280: key finding (coverage tiles) visible', await s.visible('.dept-main .tiles'));
    check('1280: Add to plan visible', await s.visible('.intervention .btn.primary'));
  }
  if (tag === '1920') check('1920: intervention visible without scrolling', await s.visible('.intervention .btn.primary'));
  check(`${tag}: no horizontal overflow (department)`, await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
  await s.click('.intervention .btn', 'Add to plan');
  await s.click('.header-actions .btn', 'Intervention plan');
  await s.click('.drawer .btn', 'Start follow-up');
  await s.click('.checkpoint-ctl .seg button', '+2 weeks');
  await s.shot('04-plus2');
  if (tag === '1280') check('1280: result and next decision visible', (await s.visible('.pkg-card .tiles')) && (await s.visible('.next-decision')));
  check(`${tag}: no horizontal overflow (follow-up)`, await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1));
  check(`${tag}: no console errors`, s.errors.length === 0, s.errors.join(' | '));
  await page.close();
}


/* ======================= optional Rhône / Efluelda branch ======================= */
{
  const s = await session(1440, 900, 'branch', false);
  const { page } = s;
  await s.click('.btn', 'Reset demo');
  // main journey first with P2, then revise the package set
  await page.evaluate(() => {});
  const search = await page.$('.search input');
  await search.type('Seine-Saint-Denis (93)');
  await sleep(500);
  await s.click('.intervention .btn', 'Add to plan');
  await s.click('.header-actions .btn', 'Intervention plan');
  await s.click('.drawer .btn', 'Start follow-up');
  await s.click('.checkpoint-ctl .seg button', '+6 weeks');
  // back to Plan, add P3 in Rhône
  await s.click('.header-actions .seg button', 'Plan');
  await s.click('.crumbs button', 'France');
  const search2 = await page.$('.search input');
  await search2.type('Rhône (69)');
  await sleep(500);
  await s.click('.intervention .btn', 'Add to plan');
  await s.click('.header-actions .seg button', 'Monitor');
  check('Branch: revised package set prompts an explicit restart', (await s.text('.date-strip')).includes('Restart follow-up with revised plan'));
  await s.click('.date-strip .btn', 'Restart follow-up with revised plan');
  check('Branch: restart returns to baseline with P2 and P3', (await s.text('.date-strip')).includes('Baseline') && (await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanofi-flu-demonstrator:v2')).snapshot.packageIds.join())) === 'P2,P3');
  await s.click('.scope-row button', 'P3');
  await s.click('.checkpoint-ctl .seg button', '+6 weeks');
  const c3 = await s.text('.pkg-card');
  check('Branch: P3 +6 weeks shows 48% vs 45%, difference 3 pp, Efluelda 70%', /\+8 pp/.test(c3) && /\+5 pp/.test(c3) && /\+3 pp/.test(c3) && /70%/.test(c3));
  check('Branch: P3 card does not show P2 results', !/Strengthen recommendations/.test(c3));
  await s.ask('How is Efluelda performing?');
  const e = await s.lastAnswer();
  check('Branch: Efluelda answer wording', /retains its share within the category/.test(e) && /higher brand volume/.test(e) && /absolute Efluelda dispensing/.test(e) && !/preferential|better than Fluad/i.test(e));
  await s.shot('01-efluelda');
  await s.click('.scope-row button', 'All packages');
  check('Branch: All packages shows package tabs for P2 and P3', (await page.evaluate(() => document.querySelectorAll('.pkg-tabs button').length)) === 2);
  await s.click('.header-actions .btn', 'Reset demo');
  check('Branch: no console errors', s.errors.length === 0, s.errors.join(' | '));
  await page.close();
}
/* ======================= drawers, ordinary departments, reference areas ======================= */
{
  const s = await session(1440, 900, 'misc', false);
  const { page } = s;
  await s.click('.btn', 'Reset demo');
  await s.click('.header-actions .btn', 'How this works');
  const how = await s.text('.drawer');
  check('How this works explains the annual cycle and designed profiles', /Prepare/.test(how) && /Deliver/.test(how) && /Review/.test(how) && /authored and precomputed/.test(how));
  await s.click('.drawer .btn', 'Close');
  await s.click('.header-actions .btn', 'Sources');
  const src = await s.text('.drawer');
  check('Sources keep provenance, acquired vs potential and the refresh assumption', /Not acquired/.test(src) && /Limitation/.test(src) && /scenario assumption/.test(src) && /Synthetic/.test(src));
  await s.click('.drawer .btn', 'Close');
  await s.click('.header-actions .pill', 'Demonstrator');
  check('Header notice opens the About explanation', /About this demonstrator/.test(await s.text('.drawer')));
  await s.click('.drawer .btn', 'Close');
  // ordinary department (Ariège) gets a numerical summary and cluster-level interpretation
  const search = await page.$('.search input');
  await search.type('Ariège (09)');
  await sleep(500);
  await s.ask('Where is the opportunity?');
  const ar = await s.lastAnswer();
  check('Ordinary department: own coverage figure and cluster-level note', /Coverage is \d\d\.\d%/.test(ar) && /no local package is prepared/.test(ar));
  check('Ordinary department: no Add to plan for another area’s package', !(await s.text('.intervention')).includes('Add to plan'));
  // Finistère reference area
  await s.click('.crumbs button', 'France');
  const search2 = await page.$('.search input');
  await search2.type('Finistère (29)');
  await sleep(500);
  check('Finistère shows no intervention proposal', /No intervention proposed/.test(await s.text('.intervention')));
  // historical evidence drawer from More evidence
  await page.evaluate(() => document.querySelector('.more-evidence summary').click());
  await sleep(300);
  await s.click('.more-evidence .btn', 'Historical evidence');
  check('Historical evidence drawer opens', /Historical evidence/.test(await s.text('.drawer h2')));
  await s.click('.drawer .btn', 'Close');
  check('Misc: no console errors', s.errors.length === 0, s.errors.join(' | '));
  await page.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Output: ${OUT}`);
process.exitCode = failed.length ? 1 : 0;
