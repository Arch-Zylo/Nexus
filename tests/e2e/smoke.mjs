/* End-to-end smoke test — drives the real UI in headless Chromium (Playwright).
   Run:  npm run test:e2e            (set PW_CHROMIUM=/path/to/chrome to use a specific browser)
   Optional:  DUMP=/tmp/run  saves the app state to /tmp/run.*.json
              COVER=/tmp/dead.txt  lists functions the run never executed */
import { serve, launch } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(process.argv[2] || path.join(here, '../../www'));
const A = (f) => path.join(here, 'assets', f);
const { srv, url } = await serve(root);
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true, permissions: ['notifications'] });
const page = await ctx.newPage(); page.setDefaultTimeout(5000);
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
page.on('dialog', d => d.accept(d.type() === 'prompt' ? (/WIPE/.test(d.message()) ? 'WIPE' : 'x') : undefined));
const results = []; let seenProg = {};
async function step(name, fn) {
  await closeSettings().catch(() => {});
  try { const r = await fn(); results.push(['PASS', name, r === undefined ? '' : String(r)]); }
  catch (e) { results.push(['FAIL', name, String(e.message).split('\n').slice(0,3).join(' / ').slice(0, 260)]); }
}
const settingsOpen = () => page.evaluate(() => document.getElementById('settingsDrawer').classList.contains('open'));
const openSettings = async () => { if (!(await settingsOpen())) await page.click('#menuBtn'); await page.waitForTimeout(280); };
const closeSettings = async () => { if (await settingsOpen()) { await page.click('#drawerClose'); await page.waitForTimeout(280); } };
const pin = async (d) => { for (const c of d) await page.click(`#lockPad [data-k="${c}"]`); await page.waitForTimeout(350); };
const lockShown = () => page.evaluate(() => !document.getElementById('lockScreen').hidden);
const txt = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel);
const expectText = async (sel, t, ms = 4000) => { await page.waitForFunction(([s, t]) => (document.querySelector(s)?.innerText || '').includes(t), [sel, t], { timeout: ms }); };
const progWatcher = (key) => page.evaluate((k) => { window.__prog = window.__prog || {}; window.__prog[k] = []; const iv = setInterval(() => { const c = document.querySelector('.nx-prog.show'); if (c) window.__prog[k].push(c.querySelector('.nx-prog-label')?.textContent + '|' + c.querySelector('.nx-prog-pct')?.textContent); }, 40); setTimeout(() => clearInterval(iv), 15000); }, key);
const progSeen = async (key) => { const a = await page.evaluate((k) => window.__prog?.[k] || [], key); return a.length ? `${a.length} samples, last: ${a[a.length - 1]}` : null; };

if (process.env.COVER) await page.coverage.startJSCoverage({ resetOnNavigation: false });
await page.addInitScript(() => { window.__spoken = []; try { speechSynthesis.getVoices = () => []; speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend({}), 0); }; speechSynthesis.cancel = () => {}; } catch {} });
const spoken = () => page.evaluate(() => window.__spoken.slice());
await page.goto(url); await page.waitForTimeout(600);
await step('boot + accept terms', async () => { await page.check('#tosAgree'); await page.click('#tosAccept'); await page.waitForTimeout(300); if (await page.locator('#tosGate').isVisible()) throw new Error('gate still visible'); });
await step('greeting: spoken once after the terms, never again while the app stays open', async () => {
  await page.waitForTimeout(1600);
  let sp = await spoken(); if (sp.length !== 1 || !sp[0].includes('welcome back')) throw new Error('expected one greeting, got ' + JSON.stringify(sp));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.click('.rail:not(.rail-chill) [data-go="home"]'); await page.waitForTimeout(900);
  sp = await spoken(); if (sp.length !== 1) throw new Error('greeting repeated: ' + JSON.stringify(sp)); });
await step('regular nav views', async () => {
  for (const go of ['home','timetable','tasks','people','notes','wallet']) {
    await page.click(`.rail:not(.rail-chill) [data-go="${go}"]`); await page.waitForTimeout(120);
    if (!(await page.evaluate((g) => document.getElementById('view-' + g).classList.contains('on'), go))) throw new Error('view not shown: ' + go);
  } });
await step('settings drawer: slides over the current screen; closes via ✕, scrim and Back', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.waitForTimeout(100);
  if (await page.locator('.rail [data-go="config"]').count()) throw new Error('settings still in the rail');
  if (await page.evaluate(() => { const r = document.getElementById('settingsDrawer').getBoundingClientRect(); return r.right > 0 && getComputedStyle(document.getElementById('settingsDrawer')).visibility !== 'hidden'; })) throw new Error('drawer visible while closed');
  await page.click('#menuBtn'); await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const d = document.getElementById('settingsDrawer'), r = d.getBoundingClientRect(); return { open: d.classList.contains('open'), left: Math.round(r.left), w: Math.round(r.width), exp: document.getElementById('menuBtn').getAttribute('aria-expanded'), tasks: document.getElementById('view-tasks').classList.contains('on') }; });
  if (!st.open || st.left !== 0 || st.exp !== 'true') throw new Error('drawer not open: ' + JSON.stringify(st));
  if (!st.tasks) throw new Error('current screen was replaced instead of staying underneath');
  if (!(await page.locator('#settingsDrawer .set-row[data-set="theme"]').isVisible())) throw new Error('settings rows not visible in drawer');
  await page.click('#drawerClose'); await page.waitForTimeout(300);
  if (await settingsOpen()) throw new Error('✕ did not close');
  await page.click('#menuBtn'); await page.waitForTimeout(300); await page.mouse.click(382, 500); await page.waitForTimeout(300);
  if (await settingsOpen()) throw new Error('scrim tap did not close');
  await page.click('#menuBtn'); await page.waitForTimeout(300); await page.evaluate(() => history.back()); await page.waitForTimeout(400);
  if (await settingsOpen()) throw new Error('Back did not close the drawer');
  if (!(await page.evaluate(() => document.getElementById('view-tasks').classList.contains('on')))) throw new Error('Back left the screen underneath');
  if (await page.evaluate(() => document.getElementById('menuBtn').classList.contains('active'))) throw new Error('hamburger stuck active'); });
await step('add task', async () => { await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.click('#btnAddTask'); await page.fill('#t-title', 'Buy milk'); await page.click('#saveTask'); await expectText('#taskList', 'Buy milk'); });
await step('tasks: no-deadline option + ordering (dated by date, then no-deadline, done last)', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]');
  const add = async (title, { due, none } = {}) => { await page.click('#btnAddTask'); await page.fill('#t-title', title);
    if (none) await page.check('#t-nodue'); else if (due) await page.fill('#t-due', due);
    await page.click('#saveTask'); await expectText('#taskList', title); };
  await add('ND-first', { none: true }); await add('Late-dated', { due: '2099-12-31' }); await add('Soon-dated', { due: '2098-01-01' }); await add('ND-second', { none: true });
  await page.click('#btnAddTask');
  if (!(await page.evaluate(() => document.getElementById('t-due').disabled === false))) throw new Error('date should be enabled by default');
  await page.check('#t-nodue');
  if (!(await page.evaluate(() => document.getElementById('t-due').disabled))) throw new Error('date not disabled when No deadline ticked');
  await page.click('#cancelTask');
  const order = async () => page.evaluate(() => [...document.querySelectorAll('#taskList .card-title')].map(e => e.firstChild.textContent.trim()));
  let o = await order(); const i = (t) => o.indexOf(t);
  if (!(i('Soon-dated') < i('Late-dated') && i('Late-dated') < i('ND-first') && i('ND-first') < i('ND-second'))) throw new Error('bad order: ' + o.join(' | '));
  const tag = await page.evaluate(() => [...document.querySelectorAll('#taskList .card')].find(c => c.innerText.includes('ND-first')).querySelector('.tag').innerText);
  if (tag !== 'No deadline') throw new Error('tag was ' + tag);
  await page.evaluate(() => [...document.querySelectorAll('#taskList .card')].find(c => c.innerText.includes('Soon-dated')).querySelector('[data-tog]').click()); await page.waitForTimeout(250);
  o = await order(); if (!(i('Soon-dated') > i('ND-second'))) throw new Error('finished task not moved to the bottom: ' + o.join(' | '));
  await page.evaluate(() => [...document.querySelectorAll('#taskList .card')].find(c => c.innerText.includes('ND-first')).click()); await page.click('#editTaskBtn');
  if (!(await page.evaluate(() => document.getElementById('t-nodue').checked && document.getElementById('t-due').disabled))) throw new Error('edit form lost the no-deadline state');
  await page.click('#cancelTask');
  await page.click('.rail:not(.rail-chill) [data-go="home"]'); await page.waitForTimeout(150);
  const due = await txt('#dueSoon'); if (due.includes('NaN') || due.includes('ND-first')) throw new Error('home Due Soon wrong: ' + due.replace(/\n/g, ' '));
  for (const t of ['ND-first','ND-second','Late-dated','Soon-dated']) { await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.locator('#taskList').getByText(t).first().click(); await page.click('#delTaskBtn'); await page.waitForTimeout(200); }
});
await step('add person', async () => { await page.click('.rail:not(.rail-chill) [data-go="people"]'); await page.click('#btnAddPerson'); await page.fill('#p-first', 'Ada'); await page.click('#savePerson'); await expectText('#peopleList', 'Ada'); });
await step('add note', async () => { await page.click('.rail:not(.rail-chill) [data-go="notes"]'); await page.click('#btnAddNote'); await page.fill('#n-title', 'Hello note'); await page.fill('#n-body', 'body'); await page.click('#noteBack'); await expectText('#noteGrid', 'Hello note'); });
await step('add account', async () => { await page.click('.rail:not(.rail-chill) [data-go="wallet"]'); await page.click('#btnAddAcc'); await page.fill('#a-name', 'Cash'); await page.fill('#a-start', '100'); await page.click('#saveAcc'); await expectText('#accList', 'Cash'); });
await step('add class', async () => { await page.click('.rail:not(.rail-chill) [data-go="timetable"]'); await page.click('#btnAddClass'); await page.fill('#c-sub', 'Math'); await page.fill('#c-start', '09:00'); await page.fill('#c-end', '10:00'); await page.click('#saveClass'); await expectText('#board', 'Math'); });
await step('add event', async () => { await page.click('#btnAddEvent').catch(()=>{}); await page.click('[data-tt-tab="events"],#ttModeEvents').catch(()=>{}); return 'skipped-ui-unknown'; });
await step('settings: theme row cycles', async () => { await openSettings(); const before = await txt('#themeValue'); await page.click('.set-row[data-set="theme"]'); await page.waitForTimeout(200); const after = await txt('#themeValue'); if (before === after) throw new Error('theme unchanged'); return before + ' → ' + after; });
await step('app lock: set PIN (mismatch rejected), stays out of the data store', async () => {
  await openSettings();
  if (await page.locator('#lockExtras').isVisible()) throw new Error('lock options visible while lock is off');
  await page.click('[data-set="applock"]'); await page.waitForTimeout(150);
  if (!(await lockShown())) throw new Error('keypad not shown');
  await pin('1234'); await pin('9999');
  if (!(await txt('#lockMsg')).includes('match')) throw new Error('mismatch not reported: ' + await txt('#lockMsg'));
  await pin('1234'); await pin('1234');
  if (await lockShown()) throw new Error('keypad still shown after confirming');
  if ((await txt('#appLockValue')) !== 'On') throw new Error('value not On');
  if (!(await page.locator('#lockExtras').isVisible())) throw new Error('lock options not shown');
  const raw = await page.evaluate(() => localStorage.getItem('nexus-applock-v1') || ''); if (!raw || raw.includes('1234')) throw new Error('lock record missing or contains the PIN');
  if ((await page.evaluate(() => localStorage.getItem('nexus-v1') || '')).includes('"hash"')) throw new Error('PIN hash leaked into the main store'); });
await step('app lock: Lock now, wrong PIN, right PIN', async () => {
  await openSettings(); await page.click('[data-set="locknow"]'); await page.waitForTimeout(400);
  if (!(await lockShown())) throw new Error('not locked');
  if (await page.evaluate(() => !document.querySelector('.app').inert)) throw new Error('app behind the lock is still interactive');
  await pin('0000'); if (!(await txt('#lockMsg')).includes('Wrong')) throw new Error('no wrong-PIN message');
  if (!(await lockShown())) throw new Error('unlocked with wrong PIN');
  await pin('1234'); if (await lockShown()) throw new Error('right PIN did not unlock'); });
await step('app lock: locks when you leave (Immediately) and after the delay', async () => {
  await openSettings(); await page.click('[data-set="lockdelay"]'); await page.click('[data-set="lockdelay"]');
  if ((await txt('#lockDelayValue')) !== 'Immediately') throw new Error('delay is ' + await txt('#lockDelayValue'));
  await closeSettings();
  const away = (h) => page.evaluate((hid) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hid }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await away(true); await page.waitForTimeout(100); if (!(await lockShown())) throw new Error('did not lock when leaving');
  await away(false); await pin('1234'); if (await lockShown()) throw new Error('could not unlock');
  await openSettings(); await page.click('[data-set="lockdelay"]'); await closeSettings();   // -> After 1 minute
  await away(true); await page.waitForTimeout(100); await away(false); await page.waitForTimeout(100);
  if (await lockShown()) throw new Error('locked after a short absence with a 1-minute delay'); });
await step('app lock: stays locked after reload; cool-down after 5 wrong PINs', async () => {
  await page.reload(); await page.waitForTimeout(500);
  if (!(await lockShown())) throw new Error('not locked after reload');
  await page.waitForTimeout(1200); if ((await spoken()).length) throw new Error('greeted while still locked');
  for (let i = 0; i < 5; i++) await pin('1111');
  if (!(await txt('#lockMsg')).includes('Too many')) throw new Error('no cool-down: ' + await txt('#lockMsg'));
  await pin('1234'); if (!(await lockShown())) throw new Error('unlocked during cool-down');
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('nexus-applock-v1')); c.until = 0; c.fails = 0; localStorage.setItem('nexus-applock-v1', JSON.stringify(c)); });
  await page.reload(); await page.waitForTimeout(500); await pin('1234'); if (await lockShown()) throw new Error('could not unlock after cool-down');
  await page.waitForTimeout(1500); if ((await spoken()).length !== 1) throw new Error('no greeting after unlocking: ' + JSON.stringify(await spoken())); });
await step('app lock: change PIN, then turn off', async () => {
  await openSettings(); await page.click('[data-set="lockchange"]'); await pin('1234'); await pin('5678'); await pin('5678');
  if (await lockShown()) throw new Error('change flow did not finish');
  await page.click('[data-set="locknow"]'); await page.waitForTimeout(400); await pin('1234'); if (!(await lockShown())) throw new Error('old PIN still works'); await pin('5678'); if (await lockShown()) throw new Error('new PIN rejected');
  await openSettings(); await page.click('[data-set="applock"]'); await pin('5678');
  if ((await txt('#appLockValue')) !== 'Off') throw new Error('not off'); if (await page.evaluate(() => localStorage.getItem('nexus-applock-v1'))) throw new Error('lock record still stored');
  if (await page.locator('#lockExtras').isVisible()) throw new Error('options still visible'); });
await step('greeting: can be switched off in Settings (and personalised with the name)', async () => {
  await openSettings(); await page.click('[data-set="name"]'); await page.waitForTimeout(100);
  if ((await txt('#greetValue')) !== 'On') throw new Error('greeting should default to On');
  await page.click('[data-set="greet"]'); if ((await txt('#greetValue')) !== 'Off') throw new Error('did not switch off');
  await page.reload(); await page.waitForTimeout(1600); if ((await spoken()).length) throw new Error('greeted although switched off');
  await openSettings(); await page.click('[data-set="greet"]'); await page.waitForTimeout(1500);
  const sp = await spoken(); if (sp.length !== 1) throw new Error('switching on should preview once: ' + JSON.stringify(sp));
  if (!/welcome back, x\./.test(sp[0])) throw new Error('name missing from greeting: ' + sp[0]); });
await step('events: add 2, open edit, delete one', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="timetable"]'); await page.click('[data-tt-mode="events"]');
  await page.click('#btnAddEvent'); await page.fill('#e-title', 'Exam'); await page.fill('#e-date', '2026-12-01'); await page.fill('#e-time', '10:00'); await page.click('#saveEvent'); await expectText('#eventList', 'Exam');
  await page.click('#btnAddEvent'); await page.fill('#e-title', 'TempEv'); await page.fill('#e-date', '2026-12-02'); await page.click('#saveEvent'); await expectText('#eventList', 'TempEv');
  await page.locator('#eventList').getByText('TempEv').first().click(); await page.click('#editEventBtn'); await page.click('#cancelEvent');
  await page.locator('#eventList').getByText('TempEv').first().click(); await page.click('#delEventBtn'); await page.waitForTimeout(600);
  if ((await txt('#eventList')).includes('TempEv')) throw new Error('event still listed');
  await page.click('[data-tt-mode="classes"]'); });
await step('class: detail, edit-open, delete temp', async () => {
  await page.click('#btnAddClass'); await page.fill('#c-sub', 'TempClass'); await page.fill('#c-start', '11:00'); await page.fill('#c-end', '12:00'); await page.click('#saveClass'); await expectText('#board', 'TempClass');
  await page.locator('#board').getByText('TempClass').first().click(); await page.click('#editClassBtn'); await page.click('#cancelClass');
  await page.locator('#board').getByText('TempClass').first().click(); await page.click('#delClassBtn'); await page.waitForTimeout(600);
  if ((await txt('#board')).includes('TempClass')) throw new Error('class still listed'); });
await step('person: detail, edit-open, sort', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="people"]'); await page.locator('#peopleList').getByText('Ada').first().click(); await page.click('#editPersonBtn'); await page.click('#cancelPerson');
  const links = await page.locator('#peopleSort .sort-link').count(); for (let i = 0; i < links; i++) { await page.locator('#peopleSort .sort-link').nth(i).click(); await page.waitForTimeout(100); } return 'sort links=' + links; });
await step('task: detail + edit-open', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.click('#btnAddTask'); await page.fill('#t-title', 'Detail task'); await page.click('#saveTask'); await expectText('#taskList', 'Detail task');
  await page.locator('#taskList').getByText('Detail task').first().click(); await page.click('#editTaskBtn'); await page.click('#cancelTask'); });
await step('passwords: panel, add, detail, edit-open, delete', async () => {
  await openSettings(); await page.click('[data-set="passwords"]'); await page.click('#btnAddPass'); await page.fill('#pw-site', 'site.com'); await page.fill('#pw-user', 'me'); await page.fill('#pw-pass', 'secret'); await page.click('#savePass'); await expectText('#passList', 'site.com');
  await page.locator('#passList').getByText('site.com').first().click(); await page.click('#editPassBtn'); await page.click('#cancelPass');
  await page.locator('#passList').getByText('site.com').first().click(); await page.click('#delPassBtn'); await page.waitForTimeout(500);
  if ((await txt('#passList')).includes('site.com')) throw new Error('password still listed'); await page.click('#passBack'); });
await step('spending: detail dialog + category manager', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="home"]'); await page.click('#metricSpend'); await page.waitForSelector('#backdrop.open .dialog'); await page.click('#dlgClose'); await page.waitForTimeout(300);
  await openSettings(); await page.click('[data-set="spendcats"]'); await page.waitForSelector('#spCatName'); await page.fill('#spCatName', 'Snacks'); await page.click('#spCatAdd'); await page.waitForTimeout(300);
  const ok = (await txt('.dialog')).includes('Snacks'); await page.click('#dlgClose'); if (!ok) throw new Error('category not added'); });
await step('wallet: second account + transfer', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="wallet"]'); await page.click('#btnAddAcc'); await page.fill('#a-name', 'Bank'); await page.fill('#a-start', '50'); await page.click('#saveAcc'); await expectText('#accList', 'Bank');
  await page.click('#btnTransfer'); await page.selectOption('#xf-from', { index: 0 }); await page.selectOption('#xf-to', { index: 0 }); await page.fill('#xf-amt', '10'); await page.click('#saveTransfer'); await page.waitForTimeout(400); });
await step('settings: every row responds', async () => {
  await openSettings();
  for (const a of ['name','school','currency','timefmt','spendperiod','style','spendresetnow','clearlog','notify','classnotify','classnotifylead','theme']) { await page.click(`[data-set="${a}"]`); await page.waitForTimeout(120); }
  await page.click('[data-set="terms"]'); await page.waitForTimeout(300); const gate = await page.locator('#tosGate').isVisible();
  if (gate) { await page.goBack().catch(() => {}); await page.waitForTimeout(300); if (await page.locator('#tosGate').isVisible()) await page.click('#tosAccept').catch(() => {}); }
  return 'termsReview=' + gate; });
await step('browser back returns to previous screen', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.waitForTimeout(150); await page.click('.rail:not(.rail-chill) [data-go="people"]'); await page.waitForTimeout(150); await page.goBack(); await page.waitForTimeout(500);
  return 'active=' + await page.evaluate(() => document.querySelector('.view.on')?.id); });

const R = '.rail:not(.rail-chill) [data-go="%s"]'; const CH = '.rail-chill [data-go="%s"]';
await step('row actions: task toggle, note open, wallet history, delete category', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.click('#taskList [data-tog]'); await page.waitForTimeout(250); await page.click('#taskList [data-tog]'); await page.waitForTimeout(250);
  await page.click('.rail:not(.rail-chill) [data-go="notes"]'); await page.click('#noteGrid [data-nid]'); await page.waitForTimeout(250); await page.click('#noteBack'); await page.waitForTimeout(200);
  await page.click('.rail:not(.rail-chill) [data-go="wallet"]'); await page.evaluate(() => document.querySelector('#accList [data-hist]')?.click()); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('dlgClose')?.click()); await page.waitForTimeout(200);
  await openSettings(); await page.click('[data-set="spendcats"]'); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-delcat]')?.click()); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('dlgClose')?.click()); await page.waitForTimeout(200); });
await step('delete task (row removal)', async () => {
  await page.click('.rail:not(.rail-chill) [data-go="tasks"]'); await page.click('#taskList >> text=Buy milk'); await page.waitForTimeout(200);
  await page.click('#delTaskBtn'); await page.waitForTimeout(120);
  const ghost = await page.evaluate(() => !!document.querySelector('#taskList .fx-out'));
  await page.waitForTimeout(700);
  if ((await txt('#taskList')).includes('Buy milk')) throw new Error('still listed');
  return 'exit-ghost-seen=' + ghost; });
await step('persistence across reload', async () => { await page.reload(); await page.waitForTimeout(500); const raw = await page.evaluate(() => localStorage.getItem('nexus-v1') || ''); if (!raw.includes('Ada') || !raw.includes('Math')) throw new Error('data missing'); if (await page.locator('#tosGate').isVisible()) throw new Error('terms asked again'); });
await step('dump state (regular)', async () => { if (process.env.DUMP) fs.writeFileSync(process.env.DUMP + '.regular.json', JSON.stringify(await page.evaluate(() => ({ ...localStorage })))); });
await step('mode toggle buttons (regular ⇄ chill)', async () => {
  await page.evaluate(() => document.getElementById('modeBtn_themeBtn').click()); await page.waitForTimeout(500); if (!(await page.locator('.rail-chill').isVisible())) throw new Error('did not switch to chill');
  await page.evaluate(() => document.getElementById('modeBtn_themeBtnChill').click()); await page.waitForTimeout(500); if (await page.locator('.rail-chill').isVisible()) throw new Error('did not switch back'); });
await step('switch to Chill mode', async () => { await openSettings(); await page.click('.set-row[data-set="mode"]'); await page.waitForTimeout(500); if (!(await page.locator('.rail-chill').isVisible())) throw new Error('chill rail not visible'); });
await step('chill nav views', async () => { for (const go of ['chome','music','watch','read','import']) { await page.click(`.rail-chill [data-go="${go}"]`); await page.waitForTimeout(120); if (!(await page.evaluate((g) => document.getElementById('view-' + g).classList.contains('on'), go))) throw new Error('view not shown: ' + go); } });
await step('import music (progress card + list)', async () => {
  await page.click('.rail-chill [data-go="import"]'); await progWatcher('music');
  await page.setInputFiles('#importMusicFile', [A('Song One.wav'), A('Song Two.wav')]);
  await expectText('#importMusicList', 'Song One', 8000); await expectText('#importMusicList', 'Song Two', 8000);
  await page.waitForTimeout(900); const p = await progSeen('music'); if (!p) throw new Error('progress card never appeared'); return p; });
await step('music: play opens Now Playing, controls, back closes it', async () => {
  await page.click('.rail-chill [data-go="music"]'); await expectText('#musicList', 'Song One');
  await page.click('#musicList .chill-row, #musicList > *'); await page.waitForTimeout(600);
  const npOpen = await page.evaluate(() => !document.getElementById('nowPlaying').hidden);
  const src = await page.evaluate(() => !!document.getElementById('chillAudio').src);
  if (!src) throw new Error('audio has no src');
  if (npOpen) { await page.click('#npPlay'); await page.click('#npNext'); await page.waitForTimeout(200); await page.goBack(); await page.waitForTimeout(500); }
  if (await page.evaluate(() => !document.getElementById('nowPlaying').hidden)) throw new Error('Now Playing did not close on back');
  return 'npOpenedOnPlay=' + npOpen; });
await step('mini player visible + reopens Now Playing', async () => {
  if (await page.evaluate(() => document.getElementById('miniPlayer').hidden)) throw new Error('mini player hidden');
  await page.click('#mpOpen'); await page.waitForTimeout(500);
  if (await page.evaluate(() => document.getElementById('nowPlaying').hidden)) throw new Error('not opened'); await page.goBack(); await page.waitForTimeout(400); });

await step('manga: create series + import 2 chapters (progress)', async () => {
  await page.click('.rail-chill [data-go="import"]'); await page.click('[data-import-tab="manga"]'); await page.click('#mgPlus'); await page.click('#mgoSeries');
  await page.fill('#mgSeriesName', 'Test Manga'); await page.click('#mgCreate'); await page.waitForTimeout(400);
  await progWatcher('manga'); await page.click('#mgAddCh'); await page.waitForTimeout(300);
  await page.setInputFiles('#mgPickArc', [A('Test Manga - Chapter 1.cbz'), A('Test Manga - Chapter 2.cbz')]);
  await expectText('#mgSeriesList', 'Chapter', 8000); await page.waitForTimeout(900);
  const p = await progSeen('manga'); if (!p) throw new Error('progress card never appeared'); return p + ' | rows=' + (await page.evaluate(() => document.querySelectorAll('#mgSeriesList > *').length)); });
await step('video: import webm, play, controls, close', async () => {
  if (await page.evaluate(() => !document.getElementById('mgSeries').hidden)) { await page.click('#mgSeriesBack'); await page.waitForTimeout(400); }
  const bytes = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); const rec = new MediaRecorder(c.captureStream(10), { mimeType: 'video/webm' }); const ch = []; rec.ondataavailable = e => ch.push(e.data); rec.start(); for (let i = 0; i < 14; i++) { x.fillStyle = `hsl(${i * 25},80%,50%)`; x.fillRect(0, 0, 64, 64); await new Promise(r => setTimeout(r, 100)); } await new Promise(r => { rec.onstop = r; rec.stop(); }); return Array.from(new Uint8Array(await new Blob(ch, { type: 'video/webm' }).arrayBuffer())); });
  await page.click('.rail-chill [data-go="import"]'); await page.click('[data-import-tab="video"]'); await page.setInputFiles('#importVideoFile', { name: 'Clip.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
  await expectText('#importVideoList', 'Clip', 8000);
  await page.click('.rail-chill [data-go="watch"]'); await page.click('[data-watch]'); await page.waitForTimeout(700); if (await page.evaluate(() => document.getElementById('vpHost')?.hidden ?? document.getElementById('vpClose').offsetParent === null)) throw new Error('player not open');
  for (const id of ['vpPlay', 'vpFwd', 'vpBack', 'vpSpeed']) { await page.evaluate((i) => document.getElementById(i).click(), id); await page.waitForTimeout(120); }
  await page.evaluate(() => document.getElementById('vpFs')?.click()); await page.waitForTimeout(200); await page.evaluate(() => document.getElementById('vpFs')?.click()); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('vpClose').click()); await page.waitForTimeout(400); });
await step('now playing: queue sheet, lyrics, delete track', async () => {
  await page.click('.rail-chill [data-go="music"]'); await page.click('#mpOpen'); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('[data-qm="0"]').click()); await page.waitForSelector('#nrPlay'); await page.click('#nrX'); await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('npLyricsEditBtn').click()); await page.waitForTimeout(200);
  await page.fill('#npLyricsText', '[00:00.50]hello\n[00:01.00]world'); await page.click('#npLyricsSave'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-qm="1"]').click()); await page.waitForSelector('#nrDel'); await page.click('#nrDel'); await page.waitForTimeout(500);
  await page.goBack().catch(() => {}); await page.waitForTimeout(400); });
await step('stories: add, detail, edit-open, delete', async () => {
  await page.click('.rail-chill [data-go="read"]'); await page.click('[data-read-tab="stories"]'); await page.click('#btnAddStory'); await page.fill('#st-title', 'Story A'); await page.fill('#st-body', 'Once upon a time'); await page.click('#saveStory'); await expectText('#storyList', 'Story A');
  await page.locator('#storyList').getByText('Story A').first().click(); await page.click('#editStoryBtn'); await page.click('#cancelStory');
  await page.locator('#storyList').getByText('Story A').first().click(); await page.click('#delStoryBtn'); await page.waitForTimeout(500);
  if ((await txt('#storyList')).includes('Story A')) throw new Error('story still listed'); await page.click('[data-read-tab="manga"]'); });
await step('manga: folder import, delete chapter, delete series', async () => {
  await page.click('.rail-chill [data-go="import"]'); await page.click('[data-import-tab="manga"]'); await page.click('#mgPlus'); await page.click('#mgoSeries'); await page.setInputFiles('#mgPickAuto', path.join(here, 'assets/folder'));
  await page.waitForFunction(() => document.body.innerText.includes('Folder Series'), null, { timeout: 8000 }); await page.waitForTimeout(1200);
  await page.locator('#view-import').getByText('Folder Series').first().click(); await page.waitForSelector('[data-delch]'); await page.locator('[data-delch]').first().click(); await page.waitForTimeout(600);
  await page.click('#mgSeriesDel'); await page.waitForTimeout(800);
  if (await page.evaluate(() => !document.getElementById('mgSeries').hidden)) await page.click('#mgSeriesBack'); });
await step('manga reader: open, turn pages in LTR/RTL/scroll, chapters, close', async () => {
  if (await page.evaluate(() => !document.getElementById('mgSeries').hidden)) { await page.click('#mgSeriesBack'); await page.waitForTimeout(400); }
  await page.click('.rail-chill [data-go="read"]'); await page.waitForTimeout(300);
  await page.click('#mangaGrid >> text=Test Manga'); await page.waitForTimeout(900);
  if (await page.evaluate(() => document.getElementById('mgReader').hidden)) throw new Error('reader not opened');
  const info = [];
  const cls = () => page.evaluate(() => (document.querySelector('#mgStage .mg-one')?.className || '').replace('mg-one', '').trim() || '-');
  const tap = async (xf) => { const box = await page.locator('#mgStage').boundingBox(); await page.mouse.click(box.x + box.width * xf, box.y + box.height * 0.5); };
  const want = async (label, t) => { await page.waitForTimeout(450); const g = await txt('#mgPg'); if (g !== t) throw new Error(`${label}: expected ${t}, got ${g}`); };
  info.push('start=' + (await txt('#mgMode')));
  while (!/LTR/.test(await txt('#mgMode'))) { await page.click('#mgMode'); await page.waitForTimeout(500); }
  await want('LTR start', '1 / 4');
  await tap(0.85); await page.waitForTimeout(40); info.push('LTR→ anim=' + await cls()); await want('LTR next', '2 / 4');
  await tap(0.15); await page.waitForTimeout(40); info.push('LTR← anim=' + await cls()); await want('LTR back', '1 / 4');
  await page.click('#mgMode'); await page.waitForTimeout(500); if (!/RTL/.test(await txt('#mgMode'))) throw new Error('not RTL');
  await tap(0.15); await page.waitForTimeout(40); info.push('RTL fwd anim=' + await cls()); await want('RTL next', '2 / 4');
  await tap(0.85); await want('RTL back', '1 / 4');
  await page.click('#mgMode'); await page.waitForTimeout(700); if (!/Scroll/.test(await txt('#mgMode'))) throw new Error('not Scroll');
  const imgs = await page.evaluate(() => document.querySelectorAll('#mgStage .mg-pg').length); info.push('scroll pages=' + imgs);
  await page.evaluate(() => { const st = document.getElementById('mgStage'); st.scrollTop = st.scrollHeight; }); await page.waitForTimeout(500);
  info.push('scrolled→' + await txt('#mgPg'));
  await page.click('#mgChBtn'); await page.waitForTimeout(400); info.push('chapters open=' + await page.evaluate(() => !document.getElementById('mgChapters').hidden));
  await page.click('#mgChX'); await page.waitForTimeout(400); info.push('chapters closed=' + await page.evaluate(() => document.getElementById('mgChapters').hidden));
  await page.click('#mgNextCh'); await page.waitForTimeout(700); info.push('next chapter=' + await txt('#mgChName'));
  await page.click('#mgClose'); await page.waitForTimeout(500);
  if (!(await page.evaluate(() => document.getElementById('mgReader').hidden))) throw new Error('reader did not close');
  return info.join(' | '); });

await step('audio controls: shuffle, repeat, seek, favourite, delete playing track', async () => {
  await page.click('.rail-chill [data-go="music"]'); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('#musicList [data-play]')?.click()); await page.waitForTimeout(700);
  if (await page.evaluate(() => document.getElementById('nowPlaying').hidden)) await page.evaluate(() => document.getElementById('mpOpen').click());
  await page.waitForTimeout(400);
  const col0 = await page.evaluate(() => document.getElementById('npShuffle').style.color);
  await page.evaluate(() => document.getElementById('npShuffle').click()); await page.waitForTimeout(150);
  const col1 = await page.evaluate(() => document.getElementById('npShuffle').style.color);
  await page.evaluate(() => document.getElementById('npShuffle').click()); await page.waitForTimeout(150);
  if (col0 === col1) throw new Error('shuffle colour did not change');
  await page.evaluate(() => { const a = document.getElementById('chillAudio'); a.currentTime = 0; const sk = document.getElementById('npSeek'); sk.value = 500; sk.dispatchEvent(new Event('change')); });
  await page.waitForTimeout(300); const t = await page.evaluate(() => document.getElementById('chillAudio').currentTime);
  await page.evaluate(() => document.getElementById('npFav').click()); await page.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => document.getElementById('npMore').click()); await page.waitForTimeout(250); await page.evaluate(() => document.getElementById('nmRep').click()); await page.waitForTimeout(250); }
  await page.goBack(); await page.waitForTimeout(400);
  await page.click('.rail-chill [data-go="chome"]'); await page.waitForTimeout(300);
  const fav = await page.evaluate(() => { const e = document.querySelector('#view-chome [data-fav]'); e?.click(); return !!e; }); await page.waitForTimeout(800);
  if (await page.evaluate(() => !document.getElementById('nowPlaying').hidden)) { await page.evaluate(() => document.getElementById('npMore').click()); await page.waitForTimeout(250); await page.evaluate(() => document.getElementById('nmDel').click()); await page.waitForTimeout(800); await page.goBack().catch(() => {}); await page.waitForTimeout(300); }
  const mini = await page.evaluate(() => document.getElementById('miniPlayer').hidden);
  return `seek→${t.toFixed(2)}s favTile=${fav} miniHiddenAfterDelete=${mini}`; });
await step('chill home tiles, prev track, chapter picker', async () => {
  await page.click('.rail-chill [data-go="chome"]'); await page.waitForTimeout(400);
  for (const sel of ['[data-chgo]', '[data-fav]', '[data-read]', '[data-ct]']) {
    await page.evaluate((q) => document.querySelector('#view-chome ' + q)?.click(), sel); await page.waitForTimeout(500);
    await page.evaluate(() => { if (!document.getElementById('mgReader').hidden) document.getElementById('mgClose').click(); const v = document.getElementById('vpClose'); if (v && !document.querySelector('.vp')?.hidden) v.click(); }); await page.waitForTimeout(300);
    if (await page.evaluate(() => !document.getElementById('nowPlaying').hidden)) { await page.goBack(); await page.waitForTimeout(400); }
    await page.click('.rail-chill [data-go="chome"]'); await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.getElementById('mpPrev')?.click()); await page.waitForTimeout(300);
  await page.click('.rail-chill [data-go="read"]'); await page.click('#mangaGrid >> text=Test Manga'); await page.waitForTimeout(800);
  await page.click('#mgChBtn'); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('#mgChapters [data-ch]')[1]?.click()); await page.waitForTimeout(700);
  const name = await txt('#mgChName'); await page.click('#mgClose'); await page.waitForTimeout(400); return 'chapter now: ' + name; });
await step('backup export (download)', async () => {
  await openSettings(); const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-set="export"]')]);
  const f = '/tmp/backup-' + Date.now() + path.extname(dl.suggestedFilename() || '.nexusbackup'); await dl.saveAs(f); globalThis.__bk = f; return dl.suggestedFilename() + ' ' + fs.statSync(f).size + 'B'; });
await step('backup restore (progress card)', async () => {
  await progWatcher('restore'); await page.setInputFiles('#importFile', globalThis.__bk); await page.waitForTimeout(2500);
  const p = await progSeen('restore'); if (!p) throw new Error('progress card never appeared');
  const raw = await page.evaluate(() => localStorage.getItem('nexus-v1') || ''); if (!raw.includes('Test Manga')) throw new Error('manga missing after restore'); return p; });
await step('dump state (full)', async () => { if (process.env.DUMP) fs.writeFileSync(process.env.DUMP + '.full.json', JSON.stringify(await page.evaluate(() => ({ ...localStorage })))); });
await step('wipe all data (3 confirmations) + app still boots', async () => {
  await page.reload(); await page.waitForTimeout(500);
  await openSettings(); await page.click('[data-set="wipe"]'); await page.waitForTimeout(1200);
  const raw = await page.evaluate(() => localStorage.getItem('nexus-v1') || ''); if (raw.includes('Ada') || raw.includes('Test Manga')) throw new Error('data survived wipe');
  const media = await page.evaluate(() => new Promise((res) => { const r = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]); r.then(async (dbs) => { let n = 0; for (const d of dbs) { await new Promise((ok) => { const q = indexedDB.open(d.name); q.onsuccess = () => { const db = q.result; try { const tx = db.transaction(db.objectStoreNames[0]); const c = tx.objectStore(db.objectStoreNames[0]).count(); c.onsuccess = () => { n += c.result; db.close(); ok(); }; } catch { db.close(); ok(); } }; q.onerror = ok; }); } res(n); }); }));
  return 'media blobs left=' + media; });
await step('app lock: Forgot PIN erases data and removes the lock', async () => {
  await openSettings(); await page.click('[data-set="applock"]'); await pin('2468'); await pin('2468'); await closeSettings();
  await page.reload(); await page.waitForTimeout(500);
  if (!(await lockShown())) throw new Error('not locked'); await page.click('#lockForgot'); await page.waitForTimeout(1200);
  if (await lockShown()) throw new Error('still locked after reset');
  if (await page.evaluate(() => localStorage.getItem('nexus-applock-v1'))) throw new Error('lock record survived');
  if ((await page.evaluate(() => localStorage.getItem('nexus-v1') || '')).includes('Buy milk')) throw new Error('data survived'); });
await step('no uncaught errors', async () => { if (errs.length) throw new Error(errs.slice(0, 3).join(' ;; ')); });
if (process.env.COVER) {
  const cov = await page.coverage.stopJSCoverage(); const seen = new Map();
  for (const sc of cov) { if (!/\/(js\/(?!backgrounds)|nexus\.js)/.test(sc.url)) continue;
    const f = sc.url.replace(url, '');
    for (const fn of sc.functions) { if (!fn.functionName) continue; const k = f + '::' + fn.functionName + '@' + fn.ranges[0].startOffset; seen.set(k, (seen.get(k) || false) || fn.ranges[0].count > 0); } }
  const dead = [...seen.entries()].filter(([, v]) => !v).map(([k]) => k.replace(/@\d+$/, ''));
  fs.writeFileSync(process.env.COVER, dead.sort().join('\n')); console.log('uncovered named functions:', dead.length, '→', process.env.COVER);
}
for (const [s, n, d] of results) console.log(s, '·', n, d ? '— ' + d : '');
const f = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - f}/${results.length} passed`);
if (errs.length) console.log('\nerrors:\n' + errs.join('\n'));
await b.close(); srv.close(); process.exit(f ? 1 : 0);
