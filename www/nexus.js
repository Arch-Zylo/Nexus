/* ============================================================
   NEXUS — Original student planner
   Built from scratch · localStorage · zero dependencies
   ============================================================ */
const KEY = 'nexus-v1';
const BACKUP_KEY = 'nexus-v1-backup';
const COLORS = [
  '#f5c15a','#f07178','#b794f6','#6bb3f0','#5dcea6','#e8a87c','#c38d9e','#41b3a3',
  '#ff6b6b','#feca57','#48dbfb','#1dd1a1','#5f27cd','#ff9ff3','#54a0ff','#00d2d3',
  '#ee5a24','#a3cb38','#1289a7','#d980fa','#b71540','#0a3d62','#e58e26','#cad3c8'
];
const DAYS = ['','Mon','Tue','Wed','Thu','Fri'];
const DAYS_FULL = ['','Monday','Tuesday','Wednesday','Thursday','Friday'];

// Fixed spending categories for expense transactions + the Home pie chart.
const BASE_SPEND_CATS = [
  { key: 'medical', label: 'Medical', color: '#ff3b3b' },
  { key: 'food', label: 'Food', color: '#ffd400' },
  { key: 'snack', label: 'Snack', color: '#ff9500' },
  { key: 'transportation', label: 'Transportation', color: '#1e6fff' },
  { key: 'school', label: 'School Payment', color: '#7b2fe0' },
  { key: 'other', label: 'Other', color: '#00b358' },
];
const CAT_PALETTE = ['#e84393', '#00cec9', '#fdcb6e', '#6c5ce7', '#fab1a0', '#55efc4', '#74b9ff', '#e17055'];
// Built-in categories plus any the user added (stored in store.customCats).
function spendCats() { return BASE_SPEND_CATS.concat(store.customCats || []); }
function spendCatLabel(key) { const c = spendCats().find(x => x.key === key); return c ? c.label : ''; }
function addSpendCategory(name, color) {
  name = (name || '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, msg: 'Enter a category name.' };
  if (name.length > 24) return { ok: false, msg: 'Keep the name under 25 characters.' };
  if (spendCats().some(c => c.label.toLowerCase() === name.toLowerCase())) return { ok: false, msg: 'That category already exists.' };
  const cat = { key: 'c_' + id(), label: name, color: /^#[0-9a-f]{6}$/i.test(color) ? color : CAT_PALETTE[(store.customCats || []).length % CAT_PALETTE.length] };
  store.customCats = (store.customCats || []).concat(cat);
  save();
  return { ok: true, cat };
}

// ---- Auto-reset period for the spending chart ----
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function periodStart(mode) {
  const d = parseD(today());
  if (mode === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); }   // Monday
  if (mode === 'month') return isoOf(new Date(d.getFullYear(), d.getMonth(), 1));
  if (mode === 'year') return isoOf(new Date(d.getFullYear(), 0, 1));
  return '';
}
function nextSpendReset(mode) {
  const d = parseD(today());
  if (mode === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7); return isoOf(d); }
  if (mode === 'month') return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  if (mode === 'year') return isoOf(new Date(d.getFullYear() + 1, 0, 1));
  return '';
}
// Chart only counts spending on/after this date ('' = everything), from the auto-reset period.
function spendFrom() { return periodStart(store.spendPeriod || 'all'); }
// "Reset now" stamps a time; spending logged before it is hidden from the chart (transactions are kept).
function spendCounts(t) {
  const from = spendFrom();
  if (from && (t.date || '') < from) return false;
  const r = store.spendResetTs || 0;
  if (r) return t.ts ? t.ts >= r : (t.date || '') > isoOf(new Date(r));
  return true;
}

// Expenses-only category breakdown (amt < 0). Loans and internal transfers
// are excluded — they move your own money, they aren't spending. Shared by
// the compact "Spending" metric tile and its full detail dialog.
function computeSpendBreakdown() {
  const catTotals = {};
  store.accounts.forEach(a => (a.tx||[]).forEach(t => {
    if (t.amt < 0 && !t.loan && !t.transfer && spendCounts(t)) {
      const key = spendCatLabel(t.cat) ? t.cat : 'other';
      catTotals[key] = (catTotals[key] || 0) + Math.abs(t.amt);
    }
  }));
  const spendTotal = Object.values(catTotals).reduce((s,v) => s+v, 0);
  let acc = 0;
  const stops = [];
  const legend = [];
  spendCats().forEach(c => {
    const amt = catTotals[c.key] || 0;
    if (!amt) return;
    const pct = amt / spendTotal;
    const start = acc * 360;
    acc += pct;
    const end = acc * 360;
    stops.push(`${c.color} ${start}deg ${end}deg`);
    legend.push(`
      <div class="pie-legend-row">
        <span class="pie-dot" style="background:${c.color}"></span>
        <span class="pie-label">${esc(c.label)}</span>
        <span class="pie-val">${money(amt)} · ${Math.round(pct*100)}%</span>
      </div>`);
  });
  return { catTotals, spendTotal, stops, legendHtml: legend.join('') };
}

function showSpendingDetail() {
  const spend = computeSpendBreakdown();
  const dlg = document.querySelector('.dialog');
  if (dlg) dlg.classList.add('dialog-wide');
  const mode = store.spendPeriod || 'all';
  const resetD = store.spendResetTs ? isoOf(new Date(store.spendResetTs)) : '';
  const from = [spendFrom(), resetD].sort().pop();
  const fmt = iso => parseD(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const nxt = nextSpendReset(mode);
  const range = (from ? 'Since ' + fmt(from) : 'All time') + (nxt ? ' · next reset ' + fmt(nxt) : '');
  const chart = spend.spendTotal
    ? `<div class="pie-wrap">
         <div class="pie" style="background:conic-gradient(${spend.stops.join(', ')});">
           <div class="donut-hole">
             <div class="donut-center">
               <div class="donut-total">${money(spend.spendTotal)}</div>
               <div class="donut-sub">spent</div>
             </div>
           </div>
         </div>
         <div class="pie-legend">${spend.legendHtml}</div>
       </div>`
    : '<div class="empty">No spending recorded in this period</div>';
  document.getElementById('dlgTitle').textContent = 'Spending by Category';
  document.getElementById('dlgBody').innerHTML = chart + `<div class="spend-tools"><div class="spend-range">${range}</div><div class="spend-range">Change the reset schedule or categories in Settings.</div></div>`;
  document.getElementById('backdrop').classList.add('open');
}


// Settings → Spending categories: add / delete custom categories.
function showCategoryManager() {
  const customs = store.customCats || [];
  const dlg = document.querySelector('.dialog');
  if (dlg) dlg.classList.remove('dialog-wide');
  document.getElementById('dlgTitle').textContent = 'Spending Categories';
  document.getElementById('dlgBody').innerHTML = `
    <div class="spend-tools" style="margin-top:0;padding-top:0;border-top:0;">
      <div class="field wide"><label>Built-in</label>
        <div class="cat-chips">${BASE_SPEND_CATS.map(c => `<span class="cat-chip" style="padding-right:10px;"><span class="pie-dot" style="background:${c.color}"></span>${esc(c.label)}</span>`).join('')}</div>
      </div>
      <div class="field wide"><label>Your categories</label>
        <div class="cat-chips">${customs.length ? customs.map(c => `<span class="cat-chip"><span class="pie-dot" style="background:${c.color}"></span>${esc(c.label)}<button type="button" data-delcat="${c.key}" title="Delete category" aria-label="Delete ${esc(c.label)}">✕</button></span>`).join('') : '<span class="spend-range">None yet — add one below.</span>'}</div>
      </div>
      <div class="cat-add">
        <div class="field"><input id="spCatName" type="text" maxlength="24" placeholder="New category name"></div>
        <input id="spCatColor" type="color" value="${CAT_PALETTE[customs.length % CAT_PALETTE.length]}" aria-label="Category color">
        <button class="btn btn-gold" id="spCatAdd">Add</button>
      </div>
      <div class="spend-range" id="spMsg"></div>
    </div>`;
  const body = document.getElementById('dlgBody');
  const add = () => {
    const r = addSpendCategory(body.querySelector('#spCatName').value, body.querySelector('#spCatColor').value);
    if (!r.ok) { const m = body.querySelector('#spMsg'); m.textContent = r.msg; m.style.color = 'var(--coral)'; return; }
    refreshSettingsUI(); showCategoryManager();
  };
  body.querySelector('#spCatAdd').onclick = add;
  body.querySelector('#spCatName').onkeydown = e => { if (e.key === 'Enter') add(); };
  body.querySelectorAll('[data-delcat]').forEach(b => b.onclick = () => {
    const c = (store.customCats || []).find(x => x.key === b.dataset.delcat);
    if (!c || !confirm(`Delete "${c.label}"?\n\nExisting spending in it will be counted under Other.`)) return;
    store.customCats = store.customCats.filter(x => x.key !== c.key); save(); refreshSettingsUI(); drawHome(); showCategoryManager();
  });
  document.getElementById('backdrop').classList.add('open');
}

let store = load();
let pickColor = COLORS[0];

function load() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) {
      const d = JSON.parse(r);
      d.loans = d.loans || [];
      d.passwords = d.passwords || [];
      d.accounts = d.accounts || [];
      d.classes = d.classes || [];
      d.events = d.events || [];
      d.tasks = d.tasks || [];
      d.people = d.people || [];
      d.notes = d.notes || [];
      d.log = d.log || [];
      d.style = d.style || 'soft';
      d.theme = d.theme || 'night';
      d.name = d.name || '';
      d.school = d.school || '';
      d.currency = d.currency || '$';
      d.timefmt = d.timefmt || '12';
      d.customCats = Array.isArray(d.customCats) ? d.customCats : [];
      d.spendPeriod = ['all','week','month','year'].includes(d.spendPeriod) ? d.spendPeriod : 'all';
      d.spendResetTs = Number(d.spendResetTs) || 0;
      d.notify = !!d.notify;
      d.classNotify = !!d.classNotify;
      d.classNotifyLead = Number(d.classNotifyLead) || 10;
      d.mode = d.mode === 'chill' ? 'chill' : 'regular';
      d.chillMedia = Array.isArray(d.chillMedia) ? d.chillMedia : [];
      d.chillStories = Array.isArray(d.chillStories) ? d.chillStories : [];
      d.chillProgress = d.chillProgress && typeof d.chillProgress === 'object' ? d.chillProgress : {};
      return d;
    }
  } catch {}
  return {
    classes: [], events: [], tasks: [], people: [], notes: [],
    accounts: [], loans: [], passwords: [], log: [],
    theme: 'night', style: 'soft',
    name: '', school: '', currency: '$', timefmt: '12', notify: false,
    classNotify: false, classNotifyLead: 10,
    customCats: [], spendPeriod: 'all', spendResetTs: 0,
    mode: 'regular', chillMedia: [], chillStories: [], chillProgress: {}
  };
}
function save() { localStorage.setItem(KEY, JSON.stringify(store)); }
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseD(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d); }
function daysOut(iso) {
  return Math.round((parseD(iso) - parseD(today())) / 864e5);
}
function rel(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)}d ago`;
  return `In ${n}d`;
}

// A person's current age in whole years, computed from their birthday.
function personAge(bday) {
  if (!bday) return null;
  const b = parseD(bday);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const hadBirthdayThisYear = (now.getMonth() > b.getMonth()) ||
    (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

// Days remaining until this person's next birthday (0 = today).
function daysUntilBirthday(bday) {
  if (!bday) return null;
  const year = new Date().getFullYear();
  let d = daysOut(bday.replace(/^\d{4}/, String(year)));
  if (d < 0) d = daysOut(bday.replace(/^\d{4}/, String(year + 1)));
  return d;
}
function t12(t) {
  if (!t) return '';
  let [h,m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function mins(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function money(n) {
  const sym = store.currency || '$';
  const abs = Math.abs(n).toFixed(2);
  // symbols that go after the number
  if (sym === '₱' || sym === '€' || sym === '£' || sym === '¥' || sym === '₩') {
    return (n < 0 ? '-' : '') + sym + abs;
  }
  return (n < 0 ? '-' : '') + sym + abs;
}
function bal(a) { return (a.tx||[]).reduce((s,t)=>s+t.amt,0); }
function ago(ts) {
  const m = Math.floor((Date.now()-ts)/6e4);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function log(msg, color) {
  store.log.unshift({ id: id(), msg, color: color||COLORS[3], ts: Date.now() });
  store.log = store.log.slice(0, 30);
  save();
}

/* Theme — dark themes only (no light mode) */
const THEMES = [
  { id: 'night', label: 'Night' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'starry', label: 'Starry Night' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'ember', label: 'Ember' },
  { id: 'forest', label: 'Forest' },
  { id: 'violet', label: 'Violet' },
  { id: 'slate', label: 'Slate' },
  { id: 'crimson', label: 'Crimson' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'carbon', label: 'Carbon' }
];

function applyTheme(t) {
  if (t === 'day' || !THEMES.find(x => x.id === t)) t = 'night';
  store.theme = t;
  document.documentElement.setAttribute('data-theme', t === 'night' ? '' : t);
  if (window.CircuitBG) { if (t === 'circuit') window.CircuitBG.start(); else window.CircuitBG.stop(); }
  if (window.StarryBG) { if (t === 'starry') window.StarryBG.start(); else window.StarryBG.stop(); }
  if (window.DragonBG) { if (t === 'dragon') window.DragonBG.start(); else window.DragonBG.stop(); }
  const tv = document.getElementById('themeValue');
  if (tv) tv.textContent = THEMES.find(x => x.id === t)?.label || 'Night';
  save();
}
function nextTheme() {
  const i = THEMES.findIndex(x => x.id === (store.theme || 'night'));
  applyTheme(THEMES[(i + 1) % THEMES.length].id);
}
document.getElementById('themeBtn')?.addEventListener('click', nextTheme);
applyTheme(store.theme || 'night');

/* Style — layout feel (not color) */
const STYLES = [
  { id: 'soft', label: 'Soft' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'round', label: 'Round' },
  { id: 'compact', label: 'Compact' },
  { id: 'dense', label: 'Dense' }
];
function applyStyle(s) {
  if (!STYLES.find(x => x.id === s)) s = 'soft';
  store.style = s;
  document.documentElement.setAttribute('data-style', s);
  const sv = document.getElementById('styleValue');
  if (sv) sv.textContent = STYLES.find(x => x.id === s)?.label || 'Soft';
  save();
}
function nextStyle() {
  const i = STYLES.findIndex(x => x.id === (store.style || 'soft'));
  applyStyle(STYLES[(i + 1) % STYLES.length].id);
}
applyStyle(store.style || 'soft');

/* ---------- Chill Mode: file storage (IndexedDB) ----------
   Imported music/video/manga files are real binary data, far too big for
   localStorage (which backs `store`), so the actual bytes live in an
   IndexedDB object store keyed by id. Only lightweight metadata (title,
   type, size, dateAdded) lives in store.chillMedia / store.chillStories,
   which is why imports aren't included in the JSON backup export. */
const CHILL_DB_NAME = 'nexus-chill';
let chillDBPromise = null;
function chillDB() {
  if (chillDBPromise) return chillDBPromise;
  chillDBPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(CHILL_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('files'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return chillDBPromise;
}
async function chillPut(key, blob) {
  const db = await chillDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function chillGetBlob(key) {
  const db = await chillDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function chillDeleteBlob(key) {
  const db = await chillDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

/* ---------- Mode switch: Regular ↔ Chill ---------- */
function applyMode(mode) {
  mode = mode === 'chill' ? 'chill' : 'regular';
  store.mode = mode;
  save();
  document.documentElement.setAttribute('data-mode', mode === 'chill' ? 'chill' : '');
}
function setAppMode(mode) {
  applyMode(mode);
  const targetGo = mode === 'chill' ? 'chome' : 'home';
  const btn = document.querySelector(`.rail-btn[data-go="${targetGo}"]`);
  if (btn) btn.click();
}
applyMode(store.mode || 'regular');

function showModePanel() {
  const main = document.getElementById('settingsMain');
  const panel = document.getElementById('modePanel');
  if (main) main.style.display = 'none';
  if (panel) { panel.removeAttribute('hidden'); panel.style.display = 'block'; }
}
function hideModePanel() {
  const main = document.getElementById('settingsMain');
  const panel = document.getElementById('modePanel');
  if (panel) { panel.setAttribute('hidden',''); panel.style.display = 'none'; }
  if (main) main.style.display = '';
}
document.getElementById('modeBack')?.addEventListener('click', hideModePanel);
document.querySelectorAll('[data-mode-pick]').forEach(btn => {
  btn.addEventListener('click', () => {
    setAppMode(btn.dataset.modePick);
    hideModePanel();
  });
});
document.getElementById('themeBtnChill')?.addEventListener('click', nextTheme);

/* Wipe data — 3 different confirmations */
function wipeAllData() {
  if (!confirm('1/3 — Delete ALL data?\n\nClasses, events, tasks, people, notes, wallet, passwords — everything.')) return;
  if (!confirm('2/3 — This cannot be undone.\n\nHave you exported a backup?\nPress OK only if you are sure.')) return;
  const typed = prompt('3/3 — Type WIPE (all caps) to permanently erase everything:');
  if (typed !== 'WIPE') {
    const msg = document.getElementById('dataMsg');
    if (msg) { msg.textContent = 'Wipe cancelled.'; msg.style.color = 'var(--fog)'; }
    return;
  }
  localStorage.removeItem(KEY);
  store = {
    classes: [], events: [], tasks: [], people: [], notes: [],
    accounts: [], loans: [], passwords: [], log: [],
    theme: 'night', style: 'soft',
    name: '', school: '', currency: '$', timefmt: '12', notify: false,
    classNotify: false, classNotifyLead: 10,
    customCats: [], spendPeriod: 'all', spendResetTs: 0
  };
  save();
  applyTheme('night');
  applyStyle('soft');
  boot();
  hidePassPanel();
  refreshSettingsUI();
  const msg = document.getElementById('dataMsg');
  if (msg) { msg.textContent = 'All data wiped.'; msg.style.color = 'var(--coral)'; }
}

async function doExport() {
  const json = JSON.stringify(store, null, 2);
  const msg = document.getElementById('dataMsg');
  const stamp = today(); // YYYY-MM-DD
  const filename = `nexus-backup-${stamp}.json`;

  // Always keep an on-device fallback copy too (used by "Restore from your
  // local backup" in the import flow), regardless of how the file export
  // below goes.
  try {
    localStorage.setItem(BACKUP_KEY, json);
    localStorage.setItem(BACKUP_KEY + '-ts', String(Date.now()));
  } catch {}

  if (isNativeApp()) {
    // On Android there is no plain browser "Save As" dialog inside a
    // WebView, so we write the backup to the app's cache and hand it to
    // the native Share sheet — that's what lets the user pick exactly
    // where it goes (Files, Drive, email, etc.) and see it land there.
    const FS = window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    const ShareP = window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (!FS) {
      if (msg) { msg.textContent = 'Export failed — Filesystem plugin unavailable.'; msg.style.color = 'var(--coral)'; }
      return;
    }
    try {
      const written = await FS.writeFile({ path: filename, data: json, directory: 'CACHE', encoding: 'utf8' });
      if (ShareP) {
        await ShareP.share({
          title: 'Nexus backup',
          text: 'Nexus Student OS backup — ' + filename,
          url: written.uri,
          dialogTitle: 'Save your Nexus backup'
        });
        if (msg) { msg.textContent = `Backup ready as ${filename} — choose where to save it.`; msg.style.color = 'var(--mint)'; }
      } else {
        if (msg) { msg.textContent = `Backup written to app storage as ${filename}, but the Share plugin is unavailable to save it elsewhere.`; msg.style.color = 'var(--mint)'; }
      }
    } catch (e) {
      // The user cancelling the share sheet also lands here on some
      // Android versions — the local-storage backup above still exists.
      console.warn('Nexus: export share failed', e);
      if (msg) { msg.textContent = 'Export saved to local storage only (share was cancelled or failed).'; msg.style.color = 'var(--fog)'; }
    }
  } else {
    // Static-site / browser build: trigger a real file download so the
    // backup is a visible file the user's browser Save-As / Downloads
    // flow handles, not just an invisible localStorage write.
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (msg) { msg.textContent = `Backup downloaded as ${filename}.`; msg.style.color = 'var(--mint)'; }
    } catch (e) {
      console.warn('Nexus: export download failed', e);
      if (msg) { msg.textContent = 'Export failed — local storage may be full.'; msg.style.color = 'var(--coral)'; }
    }
  }
}

function showPassPanel() {
  const main = document.getElementById('settingsMain');
  const panel = document.getElementById('passPanel');
  if (main) main.style.display = 'none';
  if (panel) {
    panel.removeAttribute('hidden');
    panel.style.display = 'block';
  }
  drawPasswords();
}
function hidePassPanel() {
  const main = document.getElementById('settingsMain');
  const panel = document.getElementById('passPanel');
  if (panel) {
    panel.setAttribute('hidden', '');
    panel.style.display = 'none';
  }
  if (main) main.style.display = '';
  if (document.getElementById('sheetPass')) resetPassForm();
}

const CURRENCIES = ['$', '₱', '€', '£', '¥', '₹', '₩', 'Rp'];

function refreshSettingsUI() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('themeValue', THEMES.find(x => x.id === (store.theme || 'night'))?.label || 'Night');
  set('styleValue', STYLES.find(x => x.id === (store.style || 'soft'))?.label || 'Soft');
  set('nameValue', store.name || 'Not set');
  set('schoolValue', store.school || 'Not set');
  set('currencyValue', store.currency || '$');
  set('timefmtValue', store.timefmt === '24' ? '24-hour' : '12-hour');
  set('spendPeriodValue', { all: 'Never', week: 'Every week', month: 'Every month', year: 'Every year' }[store.spendPeriod || 'all']);
  set('spendCatsValue', String(spendCats().length));
  set('notifyValue', store.notify ? 'On' : 'Off');
  set('classNotifyValue', store.classNotify ? 'On' : 'Off');
  set('classNotifyLeadValue', (Number(store.classNotifyLead) || 10) + ' min before');
  try {
    const bytes = new Blob([JSON.stringify(store)]).size;
    set('storageValue', bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB');
  } catch { set('storageValue', '—'); }
}

function toggleNotify() {
  if (!store.notify) {
    requestNotifyPermission().then(granted => {
      store.notify = granted;
      save();
      refreshSettingsUI();
      if (granted) scheduleDueTaskReminders();
      else alert('Permission denied — reminders stay off.');
    });
  } else {
    store.notify = false;
    save();
    refreshSettingsUI();
    scheduleDueTaskReminders();
  }
}

function checkDueReminders() {
  if (!store.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  // "Due soon" includes overdue tasks (negative daysOut) as well as due today/tomorrow.
  const due = (store.tasks || []).filter(t => !t.done && t.due && daysOut(t.due) <= 1);
  if (!due.length) return;
  const key = 'nexus-reminded-' + today();
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  const titles = due.map(t => t.title).slice(0, 3).join(', ');
  new Notification('Nexus — tasks due soon', {
    body: due.length + ' task' + (due.length > 1 ? 's' : '') + ': ' + titles,
    icon: undefined
  });
}

let webTaskWatcherStarted = false;
function startWebTaskWatcher() {
  if (webTaskWatcherStarted) return;
  webTaskWatcherStarted = true;
  // Re-check periodically so a task that becomes due while the tab stays
  // open (e.g. past midnight) still triggers a reminder without a reload.
  setInterval(checkDueReminders, 60000);
}

// Stable positive int32 id per task, used as the native notification id.
// Offset into the upper half of the id space so task ids can never collide
// with class notification ids (see classNotifId below).
function taskNotifId(taskId) {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = (h * 31 + taskId.charCodeAt(i)) | 0;
  return 1073741824 + (Math.abs(h) % 1073741000) + 1;
}

// Due-task reminders: on the Android APK these are real, persisted
// @capacitor/local-notifications alarms (so they still fire when the app
// is closed); in a browser they fall back to the best-effort Web
// Notification watcher above. Called on boot and whenever tasks change
// (add / edit / mark done / delete) or the "Due-task reminders" setting
// is toggled, so schedules always reflect the current task list.
async function scheduleDueTaskReminders() {
  if (isNativeApp()) {
    const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (!LN) return;
    try {
      const pending = await LN.getPending();
      const ours = (pending.notifications || []).filter(n => n.extra && n.extra.nexusTask);
      if (ours.length) await LN.cancel({ notifications: ours.map(n => ({ id: n.id })) });
    } catch {}
    if (!store.notify) return;
    const notifications = [];
    (store.tasks || []).forEach(t => {
      if (t.done || !t.due) return;
      const d = daysOut(t.due);
      if (d > 1) return; // only remind for overdue / due-today / due-tomorrow
      const due = parseD(t.due);
      due.setHours(9, 0, 0, 0);
      // If the 9am reminder time for that due date has already passed
      // (overdue tasks, or "due today" checked after 9am), fire shortly.
      const at = due.getTime() > Date.now() ? due : new Date(Date.now() + 3000);
      notifications.push({
        id: taskNotifId(t.id),
        title: d < 0 ? 'Nexus — task overdue' : d === 0 ? 'Nexus — task due today' : 'Nexus — task due tomorrow',
        body: t.title,
        schedule: { at, allowWhileIdle: true },
        extra: { nexusTask: true, taskId: t.id }
      });
    });
    if (notifications.length) {
      try { await LN.schedule({ notifications }); } catch (e) { console.warn('Nexus: task reminder schedule failed', e); }
    }
  } else {
    checkDueReminders();
    startWebTaskWatcher();
  }
}

/* ---------- TIMETABLE NOTIFICATIONS ----------
   Works two ways:
   - Installed app (Capacitor/Android): uses @capacitor/local-notifications
     to schedule real, repeating weekly alarms that fire even if the app
     is closed.
   - Browser preview: best-effort foreground watcher using the Web
     Notification API (only fires while this tab is open).
   Each class can use the global default lead time, override it, or opt
   out of reminders entirely. */
const LEAD_OPTIONS = [5, 10, 15, 30, 60];

function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// Stable positive int32 id per class, used as the native notification id.
function classNotifId(classId) {
  let h = 0;
  for (let i = 0; i < classId.length; i++) h = (h * 31 + classId.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2147483000) + 1;
}

// Capacitor/iOS-style weekday: Sunday=1 ... Saturday=7.
// Our class "day" field is Monday=1 ... Friday=5.
function capWeekday(appDay) {
  return (Number(appDay) % 7) + 1;
}

function minusMinutes(hhmm, mins) {
  const [h, m] = (hhmm || '09:00').split(':').map(Number);
  let total = h * 60 + m - Number(mins || 0);
  total = ((total % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

function classLeadMinutes(c) {
  return c.notifyLead ? Number(c.notifyLead) : Number(store.classNotifyLead || 10);
}

async function requestNotifyPermission() {
  if (isNativeApp()) {
    const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (!LN) { alert('Notifications plugin unavailable.'); return false; }
    try {
      const res = await LN.requestPermissions();
      return res.display === 'granted';
    } catch { return false; }
  }
  if (!('Notification' in window)) { alert('Notifications are not supported in this browser.'); return false; }
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch { return false; }
}

async function scheduleAllClassNotifications() {
  if (isNativeApp()) {
    const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (!LN) return;
    try {
      const pending = await LN.getPending();
      const ours = (pending.notifications || []).filter(n => n.extra && n.extra.nexusClass);
      if (ours.length) await LN.cancel({ notifications: ours.map(n => ({ id: n.id })) });
    } catch {}
    if (!store.classNotify) return;
    const notifications = [];
    (store.classes || []).forEach(c => {
      if (c.notify === false || !c.start) return;
      const lead = classLeadMinutes(c);
      const { h, m } = minusMinutes(c.start, lead);
      notifications.push({
        id: classNotifId(c.id),
        title: `${c.sub} in ${lead} min`,
        body: `${t12(c.start)}${c.room ? ' · ' + c.room : ''}${c.inst ? ' · ' + c.inst : ''}`,
        schedule: { on: { weekday: capWeekday(c.day || '1'), hour: h, minute: m }, allowWhileIdle: true },
        extra: { nexusClass: true, classId: c.id }
      });
    });
    if (notifications.length) {
      try { await LN.schedule({ notifications }); } catch (e) { console.warn('Nexus: local notification schedule failed', e); }
    }
  } else {
    startWebClassWatcher();
  }
}

let webClassWatcherStarted = false;
function startWebClassWatcher() {
  if (webClassWatcherStarted) return;
  webClassWatcherStarted = true;
  setInterval(() => {
    if (!store.classNotify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const appDay = now.getDay(); // Sun=0..Sat=6; classes only use 1..5
    if (appDay < 1 || appDay > 5) return;
    (store.classes || []).forEach(c => {
      if (c.notify === false || !c.start || Number(c.day) !== appDay) return;
      const lead = classLeadMinutes(c);
      const { h, m } = minusMinutes(c.start, lead);
      if (now.getHours() === h && now.getMinutes() === m) {
        const key = `nexus-classnotif-${c.id}-${today()}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        new Notification(`${c.sub} in ${lead} min`, {
          body: `${t12(c.start)}${c.room ? ' · ' + c.room : ''}${c.inst ? ' · ' + c.inst : ''}`
        });
      }
    });
  }, 20000);
}

function toggleClassNotify() {
  if (!store.classNotify) {
    requestNotifyPermission().then(granted => {
      store.classNotify = granted;
      save();
      refreshSettingsUI();
      if (granted) scheduleAllClassNotifications();
      else alert('Permission denied — timetable reminders stay off.');
    });
  } else {
    store.classNotify = false;
    save();
    refreshSettingsUI();
    scheduleAllClassNotifications();
  }
}

function cycleClassNotifyLead() {
  const i = LEAD_OPTIONS.indexOf(Number(store.classNotifyLead) || 10);
  store.classNotifyLead = LEAD_OPTIONS[(i + 1) % LEAD_OPTIONS.length];
  save();
  refreshSettingsUI();
  if (store.classNotify) scheduleAllClassNotifications();
}

/* Settings — event delegation so clicks always work */
document.getElementById('view-config')?.addEventListener('click', (e) => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  const action = el.dataset.set;
  if (action === 'theme') { nextTheme(); refreshSettingsUI(); }
  else if (action === 'style') { nextStyle(); refreshSettingsUI(); }
  else if (action === 'name') {
    const v = prompt('Your name (shown on Home):', store.name || '');
    if (v === null) return;
    store.name = v.trim();
    save(); refreshSettingsUI(); tick();
  }
  else if (action === 'school') {
    const v = prompt('School name:', store.school || '');
    if (v === null) return;
    store.school = v.trim();
    save(); refreshSettingsUI(); tick();
  }
  else if (action === 'currency') {
    const i = CURRENCIES.indexOf(store.currency || '$');
    store.currency = CURRENCIES[(i + 1) % CURRENCIES.length];
    save(); refreshSettingsUI(); drawWallet(); drawHome();
  }
  else if (action === 'timefmt') {
    store.timefmt = store.timefmt === '24' ? '12' : '24';
    save(); refreshSettingsUI(); tick();
  }
  else if (action === 'spendperiod') {
    const modes = ['all', 'week', 'month', 'year'];
    store.spendPeriod = modes[(modes.indexOf(store.spendPeriod || 'all') + 1) % modes.length];
    save(); refreshSettingsUI(); drawHome();
  }
  else if (action === 'spendresetnow') {
    if (!confirm('Reset the spending chart now?\n\nYour transactions are kept — the chart just starts fresh from today.')) return;
    store.spendResetTs = Date.now(); save(); drawHome();
    alert('Spending chart reset.');
  }
  else if (action === 'spendcats') showCategoryManager();
  else if (action === 'notify') toggleNotify();
  else if (action === 'classnotify') toggleClassNotify();
  else if (action === 'classnotifylead') cycleClassNotifyLead();
  else if (action === 'passwords') showPassPanel();
  else if (action === 'mode') showModePanel();
  else if (action === 'export') doExport();
  else if (action === 'import') {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup && confirm('Restore from your local backup? (Cancel to pick a file instead)')) {
      const msg = document.getElementById('dataMsg');
      try {
        store = JSON.parse(backup);
        store.passwords = store.passwords || [];
        store.loans = store.loans || [];
        store.customCats = Array.isArray(store.customCats) ? store.customCats : [];
        store.spendPeriod = ['all','week','month','year'].includes(store.spendPeriod) ? store.spendPeriod : 'all';
        store.spendResetTs = Number(store.spendResetTs) || 0;
        store.classNotify = !!store.classNotify;
        store.classNotifyLead = Number(store.classNotifyLead) || 10;
        save();
        applyTheme(store.theme || 'night');
        boot();
        if (msg) { msg.textContent = 'Restored from local backup.'; msg.style.color = 'var(--mint)'; }
      } catch {
        if (msg) { msg.textContent = 'Local backup is corrupted.'; msg.style.color = 'var(--coral)'; }
      }
    } else {
      document.getElementById('importFile')?.click();
    }
  }
  else if (action === 'clearlog') {
    if (!confirm('Clear the activity log on Home?')) return;
    store.log = [];
    save();
    drawHome();
    const msg = document.getElementById('dataMsg');
    if (msg) { msg.textContent = 'Activity log cleared.'; msg.style.color = 'var(--mint)'; }
  }
  else if (action === 'wipe') wipeAllData();
  else if (action === 'terms') showTos(true);
});
document.getElementById('passBack')?.addEventListener('click', (e) => {
  e.preventDefault();
  hidePassPanel();
});

/* Clock + greeting */
function tick() {
  const n = new Date();
  const timeOpts = store.timefmt === '24'
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit', second: '2-digit' };
  document.getElementById('liveClock').textContent =
    n.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) +
    ' · ' + n.toLocaleTimeString('en-US', timeOpts);
  const h = n.getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greet').textContent =
    store.name ? `${hello}, Master ${store.name}` : hello;
  const dow = n.getDay();
  let sub = dow === 0 || dow === 6 ? 'Its Weekend — No classes today.' :
    `Today is ${DAYS_FULL[dow]}. Here's your snapshot.`;
  if (store.school) sub = store.school + ' · ' + sub;
  document.getElementById('greetSub').textContent = sub;
  // Once a minute, refresh Home so time-driven widgets (like "Classes Left
  // Today", which counts down as each class's end time passes) stay current
  // without requiring the user to navigate away and back.
  if (n.getSeconds() === 0 && document.getElementById('view-home')?.classList.contains('on')) {
    drawHome();
  }
}
tick();
setInterval(tick, 1000);
// Mobile/webview environments suspend timers while backgrounded or the
// screen is locked, which is why the clock could appear stuck on the
// time the app was last opened. Force an immediate refresh whenever the
// page regains visibility or focus so it snaps back to the real time.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('pageshow', tick);
window.addEventListener('focus', tick);

/* Navigation */
document.querySelectorAll('.rail-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.go;
    document.querySelectorAll('.view').forEach(s => s.classList.remove('on'));
    document.getElementById('view-'+v).classList.add('on');
    if (v === 'timetable') setTtMode(ttMode);
    if (v === 'wallet') drawWallet();
    if (v === 'config') { refreshSettingsUI(); hidePassPanel(); hideModePanel(); }
    if (v === 'chome') drawChillHome();
    if (v === 'music') drawMusic();
    if (v === 'watch') drawWatch();
    if (v === 'read') setReadMode(readMode);
    if (v === 'import') setImportMode(importMode);
  };
});
document.querySelectorAll('[data-go-chill]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector(`.rail-chill [data-go="${btn.dataset.goChill}"]`)?.click();
  });
});

/* Color chips + free color picker */
function chips(el) {
  if (!el) return;
  el.innerHTML = COLORS.map(c =>
    `<button type="button" class="chip${c.toLowerCase()===pickColor.toLowerCase()?' on':''}" style="background:${c}" data-c="${c}"></button>`
  ).join('');
  el.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    pickColor = c.dataset.c;
    const inp = document.getElementById('c-color');
    if (inp) inp.value = pickColor;
    chips(el);
  });
}
chips(document.getElementById('c-chips'));
document.getElementById('c-color')?.addEventListener('input', e => {
  pickColor = e.target.value;
  chips(document.getElementById('c-chips'));
});

/* ---------- HOME ---------- */
function drawHome() {
  const now = new Date();
  const dow = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const cashAccs = store.accounts.filter(a => a.type === 'cash');
  const totalCash = cashAccs.reduce((s,a) => s + bal(a), 0);
  const entries = cashAccs.reduce((s,a) => s + (a.tx||[]).length, 0);
  const open = store.tasks.filter(t => !t.done).length;
  const up = store.tasks.filter(t => !t.done && daysOut(t.due) >= 0).length;

  // Classes left today: today's classes that haven't started yet — an
  // ongoing class (already started, not yet ended) no longer counts as
  // "left". Naturally counts down through the day, and is 0 on weekends
  // since there are no Sat/Sun classes in the timetable.
  const todaysAllClasses = store.classes.filter(c => +c.day === dow);
  const classesLeftToday = todaysAllClasses.filter(c => mins(c.start) > nowMins).length;

  const tilesHtml = [
    { label:'On Hand', value: money(totalCash), color: COLORS[4], primary: true, cls: '' },
    { label:'Open Tasks', value: open, color: COLORS[1], cls: 'metric-opentasks' },
    { label:'Classes Left', value: classesLeftToday, color: COLORS[3], cls: 'metric-classesleft' },
  ].map(m => `
    <div class="metric${m.primary ? ' primary' : ''}${m.cls ? ' '+m.cls : ''}">
      <div class="accent" style="background:${m.color}"></div>
      <div class="label">${m.label}</div>
      <div class="value">${m.value}</div>
    </div>`).join('');

  const spend = computeSpendBreakdown();
  const spendPie = spend.spendTotal
    ? `background:conic-gradient(${spend.stops.join(', ')});`
    : `background:${COLORS[7]};opacity:0.25;`;
  const centerHtml = spend.spendTotal
    ? `<div class="donut-center"><div class="donut-total">${money(spend.spendTotal)}</div><div class="donut-sub">spent</div></div>`
    : `<div class="donut-center"><div class="donut-sub">No spend</div></div>`;
  const spendTile = `
    <div class="metric metric-spend" id="metricSpend" style="cursor:pointer;" title="Spending by category">
      <div class="spend-pie" style="${spendPie}"><div class="donut-hole">${centerHtml}</div></div>
    </div>`;

  document.getElementById('metrics').innerHTML = tilesHtml + spendTile;
  document.getElementById('metricSpend').onclick = () => showSpendingDetail();

  // Today classes
  const todays = store.classes.filter(c => +c.day === dow).sort((a,b)=>mins(a.start)-mins(b.start));
  document.getElementById('todayClasses').innerHTML = todays.length
    ? todays.map(c => `
      <div class="row">
        <span class="dot" style="background:${c.color}"></span>
        <div class="row-main">
          <div class="row-title">${esc(c.sub)}${c.lab?' (Lab)':''}</div>
          ${c.room?`<div class="row-sub">${esc(c.room)}</div>`:''}
        </div>
        <span class="row-meta">${t12(c.start)}–${t12(c.end)}</span>
      </div>`).join('')
    : '<div class="empty">No classes today</div>';

  // Due soon
  const due = [...store.tasks].filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  document.getElementById('dueSoon').innerHTML = due.length
    ? due.map(t => {
        const d = daysOut(t.due);
        return `<div class="row">
          <span class="dot" style="background:${d<0?COLORS[1]:COLORS[0]}"></span>
          <div class="row-main"><div class="row-title">${esc(t.title)}</div></div>
          <span class="row-meta">${d<0?'Overdue':rel(d)}</span>
        </div>`;
      }).join('')
    : '<div class="empty">Nothing due</div>';

  // Upcoming events
  const upcomingEvents = [...(store.events || [])]
    .filter(e => !e.date || daysOut(e.date) >= 0)
    .sort((a, b) => ((a.date||'') + (a.time||'')).localeCompare((b.date||'') + (b.time||'')))
    .slice(0, 5);
  document.getElementById('upcomingEvents').innerHTML = upcomingEvents.length
    ? upcomingEvents.map(e => {
        const d = e.date ? daysOut(e.date) : null;
        const when = d === null ? '' : rel(d);
        return `<div class="row">
          <span class="dot" style="background:${COLORS[2]}"></span>
          <div class="row-main">
            <div class="row-title">${esc(e.title)}</div>
            ${e.loc ? `<div class="row-sub">${esc(e.loc)}</div>` : ''}
          </div>
          <span class="row-meta">${when}${e.time ? ' · ' + t12(e.time) : ''}</span>
        </div>`;
      }).join('')
    : '<div class="empty">No upcoming events</div>';

  // Coming up (future tasks as stand-in + people birthdays this month)
  const month = now.getMonth()+1;
  const bdays = store.people.filter(p => p.bday && +p.bday.split('-')[1] === month)
    .sort((a,b)=>+a.bday.split('-')[2]-+b.bday.split('-')[2]);
  document.getElementById('comingUp').innerHTML = bdays.length
    ? bdays.map(p => `
      <div class="row">
        <span class="dot" style="background:${COLORS[6]}"></span>
        <div class="row-main"><div class="row-title">${esc(p.first)} ${esc(p.last)}</div></div>
        <span class="row-meta">${parseD(p.bday).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${rel(daysUntilBirthday(p.bday))}</span>
      </div>`).join('')
    : '<div class="empty">No birthdays this month</div>';

  // Recent
  const logs = (store.log||[]).slice(0,6);
  document.getElementById('recentLog').innerHTML = logs.length
    ? logs.map(l => `
      <div class="row">
        <span class="dot" style="background:${l.color}"></span>
        <div class="row-main">
          <div class="row-title">${esc(l.msg)}</div>
          <div class="row-sub">${ago(l.ts)}</div>
        </div>
      </div>`).join('')
    : '<div class="empty">Activity will appear here</div>';
}

/* ---------- TIMETABLE ---------- */
function drawBoard() {
  const grid = document.getElementById('board');
  const startH = 7, endH = 20, slots = (endH - startH) * 2; // 26 half-hour slots
  let html = '<div class="b-head"></div>';
  for (let d = 1; d <= 5; d++) html += `<div class="b-head">${DAYS[d]}</div>`;
  for (let i = 0; i < slots; i++) {
    const m = startH * 60 + i * 30;
    const h = Math.floor(m / 60), mm = m % 60;
    const label = mm === 0 ? (h > 12 ? h - 12 : h) + (h >= 12 ? 'p' : 'a') : '';
    html += `<div class="b-time">${label}</div>`;
    for (let d = 1; d <= 5; d++) html += `<div class="b-cell" data-d="${d}" data-m="${m}"></div>`;
  }
  grid.innerHTML = html;

  // After layout, measure one cell height so blocks scale with the fitted grid
  const sample = grid.querySelector('.b-cell');
  const cellH = sample ? sample.getBoundingClientRect().height : 20;

  store.classes.forEach(c => {
    const sm = mins(c.start), em = mins(c.end);
    const day = +c.day;
    if (day < 1 || day > 5) return;
    const si = Math.max(0, Math.floor((sm - startH * 60) / 30));
    const ei = Math.min(slots, Math.ceil((em - startH * 60) / 30));
    const cell = grid.querySelector(`.b-cell[data-d="${day}"][data-m="${startH * 60 + si * 30}"]`);
    if (!cell) return;
    const block = document.createElement('div');
    block.className = 'b-block';
    block.dataset.cid = c.id;
    block.style.background = c.color || COLORS[0];
    block.style.height = Math.max((ei - si) * cellH - 2, 16) + 'px';
    block.style.cursor = 'pointer';
    block.innerHTML = `${esc(c.sub)}${c.lab ? ' (L)' : ''}`;
    block.title = `${c.sub} ${t12(c.start)}–${t12(c.end)}`;
    block.onclick = (e) => { e.stopPropagation(); showClassDetail(c.id); };
    cell.appendChild(block);
  });
}

function showClassDetail(cid) {
  const c = store.classes.find(x => x.id === cid);
  if (!c) return;
  const dayName = DAYS_FULL[+c.day] || '';
  document.getElementById('dlgTitle').textContent = 'Class';
  document.getElementById('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-color" style="background:${c.color || COLORS[0]}"></div>
      <div class="cd-title">${esc(c.sub)}${c.lab ? ' <span class="tag">Lab</span>' : ''}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Day</span><span class="cd-v">${dayName}</span></div>
        <div class="cd-row"><span class="cd-k">Time</span><span class="cd-v">${t12(c.start)} – ${t12(c.end)}</span></div>
        <div class="cd-row"><span class="cd-k">Room</span><span class="cd-v">${c.room ? esc(c.room) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Instructor</span><span class="cd-v">${c.inst ? esc(c.inst) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editClassBtn">Edit</button>
        <button class="btn btn-ghost" id="delClassBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editClassBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openClassForm(c);
  };
  document.getElementById('delClassBtn').onclick = () => {
    if (!confirm('Delete this class?')) return;
    store.classes = store.classes.filter(x => x.id !== cid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawBoard(); drawHome(); fillSubs();
    scheduleAllClassNotifications();
  };
}

function openClassForm(c) {
  const sheet = document.getElementById('sheetClass');
  document.getElementById('c-edit-id').value = c ? c.id : '';
  document.getElementById('c-sub').value = c ? (c.sub || '') : '';
  document.getElementById('c-room').value = c ? (c.room || '') : '';
  document.getElementById('c-inst').value = c ? (c.inst || '') : '';
  document.getElementById('c-day').value = c ? (c.day || '1') : '1';
  document.getElementById('c-start').value = c ? (c.start || '09:00') : '09:00';
  document.getElementById('c-end').value = c ? (c.end || '10:30') : '10:30';
  document.getElementById('c-lab').checked = c ? !!c.lab : false;
  document.getElementById('c-notify').checked = c ? c.notify !== false : true;
  document.getElementById('c-notify-lead').value = c && c.notifyLead ? String(c.notifyLead) : '';
  if (c && c.color) {
    pickColor = c.color;
    const inp = document.getElementById('c-color');
    if (inp) inp.value = c.color;
    chips(document.getElementById('c-chips'));
  }
  sheet.classList.add('open');
  document.getElementById('c-sub').focus();
}

function resetClassForm() {
  document.getElementById('c-edit-id').value = '';
  document.getElementById('c-sub').value = '';
  document.getElementById('c-room').value = '';
  document.getElementById('c-inst').value = '';
  document.getElementById('c-day').value = '1';
  document.getElementById('c-start').value = '09:00';
  document.getElementById('c-end').value = '10:30';
  document.getElementById('c-lab').checked = false;
  document.getElementById('c-notify').checked = true;
  document.getElementById('c-notify-lead').value = '';
  document.getElementById('sheetClass').classList.remove('open');
}

document.getElementById('btnAddClass').onclick = () => {
  const sheet = document.getElementById('sheetClass');
  if (sheet.classList.contains('open')) resetClassForm();
  else openClassForm(null);
};
document.getElementById('cancelClass').onclick = () => resetClassForm();
document.getElementById('saveClass').onclick = () => {
  const sub = document.getElementById('c-sub').value.trim();
  if (!sub) { document.getElementById('c-sub').focus(); return; }
  const editId = document.getElementById('c-edit-id').value;
  const payload = {
    sub,
    room: document.getElementById('c-room').value.trim(),
    inst: document.getElementById('c-inst').value.trim(),
    day: document.getElementById('c-day').value,
    start: document.getElementById('c-start').value,
    end: document.getElementById('c-end').value,
    lab: document.getElementById('c-lab').checked,
    notify: document.getElementById('c-notify').checked,
    notifyLead: document.getElementById('c-notify-lead').value ? Number(document.getElementById('c-notify-lead').value) : null,
    color: pickColor
  };
  if (editId) {
    const idx = store.classes.findIndex(x => x.id === editId);
    if (idx >= 0) store.classes[idx] = { ...store.classes[idx], ...payload };
    save(); log(`Updated · ${sub}`, pickColor);
  } else {
    store.classes.push({ id: id(), ...payload });
    save(); log(`Class · ${sub}`, pickColor);
  }
  resetClassForm();
  drawBoard(); drawHome(); fillSubs();
  scheduleAllClassNotifications();
};

/* ---------- CLASSES / EVENTS TOGGLE ---------- */
let ttMode = 'classes';

function setTtMode(mode) {
  ttMode = mode === 'events' ? 'events' : 'classes';
  document.querySelectorAll('.tt-mode').forEach(b => {
    b.classList.toggle('on', b.dataset.ttMode === ttMode);
  });
  const title = document.getElementById('ttPageTitle');
  if (title) title.textContent = ttMode === 'events' ? 'Events' : 'Timetable';
  const classesMode = document.getElementById('classesMode');
  const eventsMode = document.getElementById('eventsMode');
  const btnClass = document.getElementById('btnAddClass');
  const btnEvent = document.getElementById('btnAddEvent');
  if (ttMode === 'events') {
    if (classesMode) { classesMode.hidden = true; classesMode.style.display = 'none'; }
    if (eventsMode) { eventsMode.hidden = false; eventsMode.style.display = ''; }
    if (btnClass) { btnClass.hidden = true; btnClass.style.display = 'none'; }
    if (btnEvent) { btnEvent.hidden = false; btnEvent.style.display = ''; }
    drawEvents();
  } else {
    if (classesMode) { classesMode.hidden = false; classesMode.style.display = ''; }
    if (eventsMode) { eventsMode.hidden = true; eventsMode.style.display = 'none'; }
    if (btnClass) { btnClass.hidden = false; btnClass.style.display = ''; }
    if (btnEvent) { btnEvent.hidden = true; btnEvent.style.display = 'none'; }
    drawBoard();
  }
}

document.querySelectorAll('.tt-mode').forEach(btn => {
  btn.addEventListener('click', () => setTtMode(btn.dataset.ttMode));
});

/* ---------- EVENTS ---------- */
function drawEvents() {
  const list = document.getElementById('eventList');
  if (!list) return;
  store.events = store.events || [];
  const items = [...store.events].sort((a, b) => {
    const da = (a.date || '') + (a.time || '');
    const db = (b.date || '') + (b.time || '');
    return da.localeCompare(db);
  });
  list.innerHTML = items.length ? items.map(e => {
    const d = e.date ? daysOut(e.date) : null;
    const dateLabel = e.date
      ? parseD(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No date';
    const timeLabel = e.time ? t12(e.time) : '';
    const when = d === null ? '' : d === 0 ? ' · Today' : d === 1 ? ' · Tomorrow' : d < 0 ? ' · Past' : ` · in ${d}d`;
    return `<div class="event-card" data-eid="${e.id}">
      <div class="ev-title">${esc(e.title)}</div>
      <div class="ev-meta">${esc(dateLabel)}${timeLabel ? ' · ' + timeLabel : ''}${e.loc ? ' · ' + esc(e.loc) : ''}${when}</div>
      ${e.notes ? `<div class="ev-notes">${esc(e.notes)}</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">No events yet — tap + Event</div>';

  list.querySelectorAll('[data-eid]').forEach(card => {
    card.onclick = () => showEventDetail(card.dataset.eid);
  });
}

function showEventDetail(eid) {
  const e = (store.events || []).find(x => x.id === eid);
  if (!e) return;
  const dateLabel = e.date
    ? parseD(e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  document.getElementById('dlgTitle').textContent = 'Event';
  document.getElementById('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${esc(e.title)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Date</span><span class="cd-v">${esc(dateLabel)}</span></div>
        <div class="cd-row"><span class="cd-k">Time</span><span class="cd-v">${e.time ? t12(e.time) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Location</span><span class="cd-v">${e.loc ? esc(e.loc) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${e.notes ? esc(e.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editEventBtn">Edit</button>
        <button class="btn btn-ghost" id="delEventBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editEventBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openEventForm(e);
  };
  document.getElementById('delEventBtn').onclick = () => {
    if (!confirm('Delete this event?')) return;
    store.events = store.events.filter(x => x.id !== eid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawEvents(); drawHome();
  };
}

function openEventForm(e) {
  document.getElementById('e-edit-id').value = e ? e.id : '';
  document.getElementById('e-title').value = e ? (e.title || '') : '';
  document.getElementById('e-date').value = e ? (e.date || today()) : today();
  document.getElementById('e-time').value = e ? (e.time || '15:00') : '15:00';
  document.getElementById('e-loc').value = e ? (e.loc || '') : '';
  document.getElementById('e-notes').value = e ? (e.notes || '') : '';
  document.getElementById('sheetEvent').classList.add('open');
  document.getElementById('e-title').focus();
}

function resetEventForm() {
  document.getElementById('e-edit-id').value = '';
  document.getElementById('e-title').value = '';
  document.getElementById('e-date').value = today();
  document.getElementById('e-time').value = '15:00';
  document.getElementById('e-loc').value = '';
  document.getElementById('e-notes').value = '';
  document.getElementById('sheetEvent').classList.remove('open');
}

document.getElementById('btnAddEvent')?.addEventListener('click', () => {
  const sheet = document.getElementById('sheetEvent');
  if (sheet.classList.contains('open')) resetEventForm();
  else openEventForm(null);
});
document.getElementById('cancelEvent')?.addEventListener('click', () => resetEventForm());
document.getElementById('saveEvent')?.addEventListener('click', () => {
  const title = document.getElementById('e-title').value.trim();
  if (!title) { document.getElementById('e-title').focus(); return; }
  const editId = document.getElementById('e-edit-id').value;
  const payload = {
    title,
    date: document.getElementById('e-date').value || today(),
    time: document.getElementById('e-time').value || '',
    loc: document.getElementById('e-loc').value.trim(),
    notes: document.getElementById('e-notes').value.trim()
  };
  store.events = store.events || [];
  if (editId) {
    const idx = store.events.findIndex(x => x.id === editId);
    if (idx >= 0) store.events[idx] = { ...store.events[idx], ...payload };
    save(); log(`Event updated · ${title}`, COLORS[2]);
  } else {
    store.events.push({ id: id(), ...payload });
    save(); log(`Event · ${title}`, COLORS[2]);
  }
  resetEventForm();
  drawEvents(); drawHome();
});

/* ---------- TASKS ---------- */
function drawTasks() {
  const list = document.getElementById('taskList');
  const items = [...store.tasks].sort((a,b)=>a.due.localeCompare(b.due));
  list.innerHTML = items.length ? items.map(t => {
    const d = daysOut(t.due);
    const overdue = !t.done && d < 0;
    return `<div class="card${t.done?' done':''}" data-tid="${t.id}" style="cursor:pointer;">
      <div class="card-bar" style="background:${t.done?COLORS[4]:(overdue?COLORS[1]:COLORS[0])}"></div>
      <div class="card-body">
        <div class="card-title">${esc(t.title)}
          <span class="tag${overdue?' warn':(t.done?' ok':'')}">${t.done?'Done':(overdue?'Overdue':rel(d))}</span>
        </div>
        <div class="card-info">${t.sub?esc(t.sub)+' · ':''}${parseD(t.due).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
        ${t.notes?`<div class="card-note">${esc(t.notes)}</div>`:''}
      </div>
      <div class="card-ops">
        <button class="btn-icon${t.done?' active':''}" data-tog="${t.id}" title="${t.done?'Mark not done':'Mark done'}">✓</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty">No tasks yet</div>';

  list.querySelectorAll('[data-tog]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const t = store.tasks.find(x => x.id === b.dataset.tog);
    if (t) { t.done = !t.done; save(); drawTasks(); drawHome(); scheduleDueTaskReminders(); }
  });

  list.querySelectorAll('[data-tid]').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('[data-tog]')) return;
      showTaskDetail(card.dataset.tid);
    };
  });
}

function showTaskDetail(tid) {
  const t = store.tasks.find(x => x.id === tid);
  if (!t) return;
  const d = daysOut(t.due);
  const overdue = !t.done && d < 0;
  document.getElementById('dlgTitle').textContent = 'Task';
  document.getElementById('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${esc(t.title)}${t.done ? ' <span class="tag ok">Done</span>' : overdue ? ' <span class="tag warn">Overdue</span>' : ''}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Subject</span><span class="cd-v">${t.sub ? esc(t.sub) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Due</span><span class="cd-v">${parseD(t.due).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${t.notes ? esc(t.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editTaskBtn">Edit</button>
        <button class="btn btn-ghost" id="delTaskBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editTaskBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openTaskForm(t);
  };
  document.getElementById('delTaskBtn').onclick = () => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    store.tasks = store.tasks.filter(x => x.id !== tid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawTasks(); drawHome();
    scheduleDueTaskReminders();
  };
}

function openTaskForm(t) {
  document.getElementById('t-edit-id').value = t ? t.id : '';
  document.getElementById('t-title').value = t ? (t.title || '') : '';
  document.getElementById('t-sub').value = t ? (t.sub || '') : '';
  document.getElementById('t-due').value = t ? (t.due || today()) : today();
  document.getElementById('t-notes').value = t ? (t.notes || '') : '';
  document.getElementById('deleteTask').hidden = !t;
  document.getElementById('sheetTask').classList.add('open');
  document.getElementById('t-title').focus();
}

function resetTaskForm() {
  document.getElementById('t-edit-id').value = '';
  document.getElementById('t-title').value = '';
  document.getElementById('t-sub').value = '';
  document.getElementById('t-due').value = today();
  document.getElementById('t-notes').value = '';
  document.getElementById('deleteTask').hidden = true;
  document.getElementById('sheetTask').classList.remove('open');
}

document.getElementById('btnAddTask').onclick = () => {
  const sheet = document.getElementById('sheetTask');
  if (sheet.classList.contains('open')) resetTaskForm();
  else openTaskForm(null);
};
document.getElementById('cancelTask').onclick = () => resetTaskForm();
document.getElementById('saveTask').onclick = () => {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { document.getElementById('t-title').focus(); return; }
  const editId = document.getElementById('t-edit-id').value;
  const payload = {
    title,
    sub: document.getElementById('t-sub').value.trim(),
    due: document.getElementById('t-due').value || today(),
    notes: document.getElementById('t-notes').value.trim()
  };
  if (editId) {
    const idx = store.tasks.findIndex(x => x.id === editId);
    if (idx >= 0) store.tasks[idx] = { ...store.tasks[idx], ...payload };
    save(); log(`Task updated · ${title}`, COLORS[0]);
  } else {
    store.tasks.push({ id: id(), done: false, ...payload });
    save(); log(`Task · ${title}`, COLORS[0]);
  }
  resetTaskForm();
  drawTasks(); drawHome();
  scheduleDueTaskReminders();
};
document.getElementById('deleteTask').onclick = () => {
  const editId = document.getElementById('t-edit-id').value;
  if (!editId) return;
  const t = store.tasks.find(x => x.id === editId);
  if (!confirm(`Delete "${t ? t.title : 'this task'}"?`)) return;
  store.tasks = store.tasks.filter(x => x.id !== editId);
  save();
  resetTaskForm();
  drawTasks(); drawHome();
  scheduleDueTaskReminders();
};
document.getElementById('t-due').value = today();

function fillSubs() {
  const dl = document.getElementById('subList');
  const subs = [...new Set(store.classes.map(c=>c.sub).filter(Boolean))];
  dl.innerHTML = subs.map(s => `<option value="${esc(s)}">`).join('');
}

/* ---------- PEOPLE ---------- */
let peopleSortMode = 'first';

function drawPeople() {
  const list = document.getElementById('peopleList');
  const sort = peopleSortMode;
  let items = [...store.people];
  if (sort === 'first') items.sort((a,b) => (a.first||'').localeCompare(b.first||''));
  else if (sort === 'last') items.sort((a,b) => (a.last||'').localeCompare(b.last||''));
  else if (sort === 'bday') {
    const withB = items.filter(p => p.bday);
    const noB = items.filter(p => !p.bday);
    const year = new Date().getFullYear();
    withB.sort((a,b) => {
      const da = daysOut(a.bday.replace(/^\d{4}/, String(year)));
      const db = daysOut(b.bday.replace(/^\d{4}/, String(year)));
      const na = da < 0 ? da + 365 : da;
      const nb = db < 0 ? db + 365 : db;
      return na - nb;
    });
    items = withB.concat(noB);
  }
  list.innerHTML = items.length ? items.map(p => {
    const age = p.bday ? personAge(p.bday) : null;
    const dLeft = p.bday ? daysUntilBirthday(p.bday) : null;
    const bdayText = dLeft === null ? '' : dLeft === 0 ? 'Today' : dLeft === 1 ? 'Tomorrow' : `${dLeft} days left`;
    return `<div class="card" data-pid="${p.id}" style="cursor:pointer;">
      <div class="card-bar" style="background:${COLORS[2]}"></div>
      <div class="card-body">
        <div class="card-title">${esc(p.first)} ${esc(p.last)}</div>
        ${p.bday?`<div class="card-info">❀ ${parseD(p.bday).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · Age ${age} · ${bdayText}</div>`:''}
        ${p.notes?`<div class="card-note">${esc(p.notes)}</div>`:''}
      </div>
    </div>`;
  }).join('') : '<div class="empty">No people yet</div>';

  list.querySelectorAll('[data-pid]').forEach(card => {
    card.onclick = () => showPersonDetail(card.dataset.pid);
  });
}

function showPersonDetail(pid) {
  const p = store.people.find(x => x.id === pid);
  if (!p) return;
  const age = p.bday ? personAge(p.bday) : null;
  const dLeft = p.bday ? daysUntilBirthday(p.bday) : null;
  const turningAge = dLeft === 0 ? age : age + 1;
  const nextBdayText = dLeft === null ? '' : dLeft === 0 ? 'Today 🎉' : dLeft === 1 ? 'Tomorrow' : `In ${dLeft} days`;
  document.getElementById('dlgTitle').textContent = 'Person';
  document.getElementById('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${esc(p.first)} ${esc(p.last)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Birthday</span><span class="cd-v">${p.bday ? parseD(p.bday).toLocaleDateString('en-US',{month:'long',day:'numeric'}) : '—'}</span></div>
        ${p.bday ? `<div class="cd-row"><span class="cd-k">Age</span><span class="cd-v">${age} years old</span></div>` : ''}
        ${p.bday ? `<div class="cd-row"><span class="cd-k">Next birthday</span><span class="cd-v">${nextBdayText} · turns ${turningAge}</span></div>` : ''}
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${p.notes ? esc(p.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editPersonBtn">Edit</button>
        <button class="btn btn-ghost" id="delPersonBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editPersonBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openPersonForm(p);
  };
  document.getElementById('delPersonBtn').onclick = () => {
    const nm = `${p.first} ${p.last}`.trim() || 'this person';
    if (!confirm(`Delete ${nm}?`)) return;
    store.people = store.people.filter(x => x.id !== pid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawPeople(); drawHome();
  };
}

document.querySelectorAll('#peopleSort .sort-link').forEach(btn => {
  btn.onclick = () => {
    peopleSortMode = btn.dataset.sort;
    document.querySelectorAll('#peopleSort .sort-link').forEach(b => b.classList.toggle('on', b === btn));
    drawPeople();
  };
});

function openPersonForm(p) {
  document.getElementById('p-edit-id').value = p ? p.id : '';
  document.getElementById('p-first').value = p ? (p.first || '') : '';
  document.getElementById('p-last').value = p ? (p.last || '') : '';
  document.getElementById('p-bday').value = p ? (p.bday || '') : '';
  document.getElementById('p-notes').value = p ? (p.notes || '') : '';
  document.getElementById('deletePerson').hidden = !p;
  document.getElementById('sheetPerson').classList.add('open');
  document.getElementById('p-first').focus();
}

function resetPersonForm() {
  document.getElementById('p-edit-id').value = '';
  document.getElementById('p-first').value = '';
  document.getElementById('p-last').value = '';
  document.getElementById('p-bday').value = '';
  document.getElementById('p-notes').value = '';
  document.getElementById('deletePerson').hidden = true;
  document.getElementById('sheetPerson').classList.remove('open');
}

document.getElementById('btnAddPerson').onclick = () => {
  const sheet = document.getElementById('sheetPerson');
  if (sheet.classList.contains('open')) resetPersonForm();
  else openPersonForm(null);
};
document.getElementById('cancelPerson').onclick = () => resetPersonForm();
document.getElementById('savePerson').onclick = () => {
  const first = document.getElementById('p-first').value.trim();
  if (!first) { document.getElementById('p-first').focus(); return; }
  const editId = document.getElementById('p-edit-id').value;
  const payload = {
    first,
    last: document.getElementById('p-last').value.trim(),
    bday: document.getElementById('p-bday').value || '',
    notes: document.getElementById('p-notes').value.trim()
  };
  if (editId) {
    const idx = store.people.findIndex(x => x.id === editId);
    if (idx >= 0) store.people[idx] = { ...store.people[idx], ...payload };
    save(); log(`Person updated · ${first}`, COLORS[2]);
  } else {
    store.people.push({ id: id(), ...payload });
    save(); log(`Person · ${first}`, COLORS[2]);
  }
  resetPersonForm();
  drawPeople(); drawHome();
};
document.getElementById('deletePerson').onclick = () => {
  const editId = document.getElementById('p-edit-id').value;
  if (!editId) return;
  const p = store.people.find(x => x.id === editId);
  const nm = p ? `${p.first} ${p.last}`.trim() : 'this person';
  if (!confirm(`Delete ${nm}?`)) return;
  store.people = store.people.filter(x => x.id !== editId);
  save();
  resetPersonForm();
  drawPeople(); drawHome();
};

/* ---------- NOTES ---------- */
function drawNotes() {
  const grid = document.getElementById('noteGrid');
  const items = [...store.notes].sort((a,b)=>(b.ts||0)-(a.ts||0));
  grid.innerHTML = items.length ? items.map(n => {
    const preview = (n.body || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return `<div class="note" data-nid="${n.id}">
      ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
      <div class="preview">${esc(preview)}${(n.body||'').length > 90 ? '…' : ''}</div>
      <div class="when">${n.ts ? ago(n.ts) : ''}</div>
    </div>`;
  }).join('') : '<div class="empty">No notes yet</div>';

  grid.querySelectorAll('[data-nid]').forEach(card => {
    card.onclick = () => openNoteForm(store.notes.find(x => x.id === card.dataset.nid));
  });
}

const $n = (i) => document.getElementById(i);
let noteTimer = null;

function openNoteForm(n) {
  $n('n-edit-id').value = n ? n.id : '';
  $n('n-title').value = n ? (n.title || '') : '';
  $n('n-body').value = n ? (n.body || '') : '';
  $n('deleteNote').hidden = !n;
  $n('noteStatus').textContent = '';
  $n('noteList').hidden = true;
  $n('noteEditor').hidden = false;
  window.scrollTo(0, 0);
  if (!n) $n('n-title').focus();
}

// Auto-save like Google Keep: create/update as you type, discard empty notes.
function commitNote() {
  clearTimeout(noteTimer);
  const title = $n('n-title').value.trim();
  const body = $n('n-body').value.trim();
  const editId = $n('n-edit-id').value;
  if (!title && !body) {
    if (editId) {
      store.notes = store.notes.filter(x => x.id !== editId);
      $n('n-edit-id').value = '';
      $n('deleteNote').hidden = true;
      save();
    }
    return;
  }
  const cur = editId && store.notes.find(x => x.id === editId);
  if (cur) {
    if (cur.title === title && cur.body === body) return;
    cur.title = title; cur.body = body; cur.ts = Date.now();
  } else {
    const nid = id();
    store.notes.push({ id: nid, title, body, ts: Date.now() });
    $n('n-edit-id').value = nid;
    $n('deleteNote').hidden = false;
    log(`Note · ${title || body.slice(0, 30)}`, COLORS[5]);
  }
  save();
  $n('noteStatus').textContent = 'Saved';
}

function closeNoteEditor() {
  commitNote();
  $n('noteEditor').hidden = true;
  $n('noteList').hidden = false;
  drawNotes();
}

['n-title', 'n-body'].forEach(i => $n(i).addEventListener('input', () => {
  $n('noteStatus').textContent = 'Saving…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(commitNote, 600);
}));
$n('btnAddNote').onclick = () => openNoteForm(null);
$n('noteBack').onclick = closeNoteEditor;
$n('deleteNote').onclick = () => {
  const editId = $n('n-edit-id').value;
  if (!editId || !confirm('Delete this note?')) return;
  store.notes = store.notes.filter(x => x.id !== editId);
  save();
  $n('n-edit-id').value = '';
  closeNoteEditor();
};

/* ---------- WALLET ---------- */
function accTypeLabel(t) {
  return t === 'cash' ? 'On Hand' : t === 'save' ? 'Savings' : 'Other';
}

function drawWallet() {
  const list = document.getElementById('accList');
  let total = 0;
  store.accounts.forEach(a => total += bal(a));
  const el = document.getElementById('walletTotal');
  el.textContent = money(total);
  el.classList.toggle('neg', total < 0);

  // Transfer needs at least 2 accounts — hide/disable otherwise
  const btnXfer = document.getElementById('btnTransfer');
  if (btnXfer) {
    const canXfer = store.accounts.length >= 2;
    btnXfer.disabled = !canXfer;
    btnXfer.style.opacity = canXfer ? '' : '0.4';
    btnXfer.title = canXfer ? 'Move money between accounts' : 'Add another account to transfer';
  }

  list.innerHTML = store.accounts.length ? store.accounts.map(a => {
    const b = bal(a);
    return `<div class="account">
      <div class="account-top">
        <div>
          <div class="account-name">${esc(a.name)}</div>
          <span class="account-type t-${a.type}">${a.type==='cash'?'On Hand':a.type==='save'?'Savings':'Other'}</span>
        </div>
        <div class="account-bal${b<0?' neg':''}">${money(b)}</div>
      </div>
      <div class="money-ops">
        <button class="m-btn in" data-in="${a.id}">+ In</button>
        <button class="m-btn out" data-out="${a.id}">− Out</button>
        <button class="m-btn loan" data-loan="${a.id}">Loan</button>
      </div>
      <div class="m-sub">
        <button data-hist="${a.id}">History</button>
        <button data-dela="${a.id}">Delete</button>
      </div>
      <div class="tx-form" id="tx-${a.id}"></div>
    </div>`;
  }).join('') : '<div class="empty">Add an account to start tracking</div>';

  // Income / Expense — note is required, compact single-line fields
  list.querySelectorAll('[data-in],[data-out]').forEach(btn => {
    btn.onclick = () => {
      const aid = btn.dataset.in || btn.dataset.out;
      const isIn = !!btn.dataset.in;
      const form = document.getElementById('tx-'+aid);
      form.classList.add('open');
      form.innerHTML = `
        <div class="fields">
          <div class="field"><label>Amount</label><input type="number" step="0.01" min="0" class="amt" placeholder="0.00" required></div>
          <div class="field wide"><label>Note (required)</label><input class="note" placeholder="e.g. Lunch, allowance from mom" required></div>
          ${!isIn ? `<div class="field wide"><label>Category</label>
            <select class="cat">
              ${[spendCats().find(c=>c.key==='other'), ...spendCats().filter(c=>c.key!=='other')].map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>
        <div class="form-foot">
          <button class="btn btn-gold conf">${isIn?'Add In':'Add Out'}</button>
          <button class="btn btn-ghost can">Cancel</button>
        </div>`;
      form.querySelector('.can').onclick = () => form.classList.remove('open');
      form.querySelector('.conf').onclick = () => {
        const amt = parseFloat(form.querySelector('.amt').value) || 0;
        const note = form.querySelector('.note').value.trim();
        if (amt <= 0) return;
        if (!note) { form.querySelector('.note').focus(); return; }
        const acc = store.accounts.find(x => x.id === aid);
        if (!acc) return;
        acc.tx = acc.tx || [];
        const tx = { id: id(), desc: note, amt: isIn ? amt : -amt, date: today(), ts: Date.now() };
        if (!isIn) tx.cat = form.querySelector('.cat')?.value || 'other';
        acc.tx.push(tx);
        save(); log(`${isIn?'+':'-'}${money(amt)} · ${acc.name}`, isIn?COLORS[4]:COLORS[1]);
        drawWallet(); drawHome();
      };
    };
  });

  // Loan out — person, amount, purpose
  list.querySelectorAll('[data-loan]').forEach(btn => {
    btn.onclick = () => {
      const aid = btn.dataset.loan;
      const form = document.getElementById('tx-'+aid);
      form.classList.add('open');
      form.innerHTML = `
        <div class="fields">
          <div class="field"><label>Who</label><input class="who" placeholder="Friend's name" required></div>
          <div class="field"><label>Amount</label><input type="number" step="0.01" min="0" class="amt" placeholder="0.00" required></div>
          <div class="field wide"><label>For (required)</label><input class="purpose" placeholder="e.g. Textbook, lunch money" required></div>
        </div>
        <div class="form-foot">
          <button class="btn btn-gold conf">Record loan</button>
          <button class="btn btn-ghost can">Cancel</button>
        </div>`;
      form.querySelector('.can').onclick = () => form.classList.remove('open');
      form.querySelector('.conf').onclick = () => {
        const who = form.querySelector('.who').value.trim();
        const amt = parseFloat(form.querySelector('.amt').value) || 0;
        const purpose = form.querySelector('.purpose').value.trim();
        if (!who || amt <= 0 || !purpose) return;
        const acc = store.accounts.find(x => x.id === aid);
        if (!acc) return;
        // Deduct from account
        acc.tx = acc.tx || [];
        acc.tx.push({ id: id(), desc: `Loan to ${who}: ${purpose}`, amt: -amt, date: today(), loan: true });
        // Track as receivable
        store.loans = store.loans || [];
        store.customCats = Array.isArray(store.customCats) ? store.customCats : [];
        store.spendPeriod = ['all','week','month','year'].includes(store.spendPeriod) ? store.spendPeriod : 'all';
        store.spendResetTs = Number(store.spendResetTs) || 0;
        store.loans.push({
          id: id(), who, amt, purpose, date: today(),
          accountId: aid, settled: false
        });
        save(); log(`Loan · ${who} · ${money(amt)}`, COLORS[3]);
        drawWallet(); drawHome();
      };
    };
  });

  list.querySelectorAll('[data-hist]').forEach(btn => {
    btn.onclick = () => {
      const acc = store.accounts.find(a => a.id === btn.dataset.hist);
      if (!acc) return;
      document.getElementById('dlgTitle').textContent = acc.name + ' · History';
      const txs = [...(acc.tx||[])].reverse();
      document.getElementById('dlgBody').innerHTML = txs.length
        ? txs.map(t => `
          <div class="tx-row">
            <span class="tx-amt ${t.amt>=0?'pos':'neg'}">${t.amt>=0?'+':''}${money(t.amt)}</span>
            <span class="tx-desc">${esc(t.desc)}${t.cat && spendCatLabel(t.cat) && !t.transfer && !t.loan ? ' · ' + esc(spendCatLabel(t.cat)) : ''}</span>
            <span class="tx-date">${t.date}</span>
          </div>`).join('')
        : '<div class="empty">No transactions</div>';
      document.getElementById('backdrop').classList.add('open');
    };
  });

  list.querySelectorAll('[data-dela]').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Delete this account?')) return;
      store.accounts = store.accounts.filter(a => a.id !== btn.dataset.dela);
      save(); drawWallet(); drawHome();
    };
  });

  // Outstanding loans
  const openLoans = (store.loans || []).filter(l => !l.settled);
  const loansSec = document.getElementById('loansSection');
  const loansList = document.getElementById('loansList');
  if (openLoans.length) {
    loansSec.style.display = 'block';
    loansList.innerHTML = openLoans.map(l => `
      <div class="loan-card">
        <div class="loan-who">${esc(l.who)}</div>
        <div class="loan-amt">${money(l.amt)}</div>
        <div class="loan-meta">${esc(l.purpose)} · ${l.date}</div>
        <div class="loan-ops">
          <button class="btn btn-gold" data-settle="${l.id}" style="padding:8px 12px;font-size:0.8rem;">Mark repaid</button>
          <button class="btn btn-ghost" data-delloan="${l.id}" style="padding:8px 12px;font-size:0.8rem;">Remove</button>
        </div>
      </div>`).join('');

    loansList.querySelectorAll('[data-settle]').forEach(btn => {
      btn.onclick = () => {
        const loan = store.loans.find(l => l.id === btn.dataset.settle);
        if (!loan) return;
        loan.settled = true;
        // Add money back to the account it came from
        const acc = store.accounts.find(a => a.id === loan.accountId);
        if (acc) {
          acc.tx = acc.tx || [];
          acc.tx.push({ id: id(), desc: `Repaid by ${loan.who}: ${loan.purpose}`, amt: loan.amt, date: today() });
        }
        save(); log(`Repaid · ${loan.who} · ${money(loan.amt)}`, COLORS[4]);
        drawWallet(); drawHome();
      };
    });
    loansList.querySelectorAll('[data-delloan]').forEach(btn => {
      btn.onclick = () => {
        if (!confirm('Remove this loan record?')) return;
        store.loans = store.loans.filter(l => l.id !== btn.dataset.delloan);
        save(); drawWallet();
      };
    });
  } else {
    loansSec.style.display = 'none';
  }
}

document.getElementById('btnAddAcc').onclick = () => {
  document.getElementById('sheetTransfer').classList.remove('open');
  document.getElementById('sheetAcc').classList.toggle('open');
};
document.getElementById('cancelAcc').onclick = () => document.getElementById('sheetAcc').classList.remove('open');
document.getElementById('saveAcc').onclick = () => {
  const name = document.getElementById('a-name').value.trim() || 'Account';
  const type = document.getElementById('a-type').value;
  const start = parseFloat(document.getElementById('a-start').value) || 0;
  const acc = { id: id(), name, type, tx: [] };
  if (start) acc.tx.push({ id: id(), desc: 'Opening balance', amt: start, date: today() });
  store.accounts.push(acc);
  save(); log(`Account · ${name}`, COLORS[4]);
  document.getElementById('sheetAcc').classList.remove('open');
  document.getElementById('a-name').value = '';
  document.getElementById('a-start').value = '';
  drawWallet(); drawHome();
};

function fillTransferSelects(preferFromId) {
  const fromSel = document.getElementById('xf-from');
  const toSel = document.getElementById('xf-to');
  const opts = store.accounts.map(a =>
    `<option value="${a.id}">${esc(a.name)} (${accTypeLabel(a.type)}) · ${money(bal(a))}</option>`
  ).join('');
  fromSel.innerHTML = opts;
  toSel.innerHTML = opts;
  if (preferFromId) fromSel.value = preferFromId;
  // Default To to a different account than From
  const fromId = fromSel.value;
  const other = store.accounts.find(a => a.id !== fromId);
  if (other) toSel.value = other.id;
}
function syncTransferToOptions() {
  const fromId = document.getElementById('xf-from').value;
  const toSel = document.getElementById('xf-to');
  const curTo = toSel.value;
  toSel.innerHTML = store.accounts
    .filter(a => a.id !== fromId)
    .map(a => `<option value="${a.id}">${esc(a.name)} (${accTypeLabel(a.type)}) · ${money(bal(a))}</option>`)
    .join('');
  if ([...toSel.options].some(o => o.value === curTo)) toSel.value = curTo;
}

document.getElementById('btnTransfer').onclick = () => {
  if (store.accounts.length < 2) return;
  document.getElementById('sheetAcc').classList.remove('open');
  const sheet = document.getElementById('sheetTransfer');
  const opening = !sheet.classList.contains('open');
  if (opening) {
    fillTransferSelects();
    document.getElementById('xf-amt').value = '';
    document.getElementById('xf-note').value = '';
    syncTransferToOptions();
  }
  sheet.classList.toggle('open');
};
document.getElementById('xf-from').onchange = syncTransferToOptions;
document.getElementById('cancelTransfer').onclick = () => document.getElementById('sheetTransfer').classList.remove('open');
document.getElementById('saveTransfer').onclick = () => {
  const fromId = document.getElementById('xf-from').value;
  const toId = document.getElementById('xf-to').value;
  const amt = parseFloat(document.getElementById('xf-amt').value) || 0;
  const note = document.getElementById('xf-note').value.trim();
  if (amt <= 0 || !fromId || !toId || fromId === toId) return;
  const src = store.accounts.find(x => x.id === fromId);
  const dst = store.accounts.find(x => x.id === toId);
  if (!src || !dst) return;
  // Allow overdraft — same rule as regular expenses (negative balances ok)
  src.tx = src.tx || [];
  dst.tx = dst.tx || [];
  const srcDesc = note ? `Transfer to ${dst.name}: ${note}` : `Transfer to ${dst.name}`;
  const dstDesc = note ? `Transfer from ${src.name}: ${note}` : `Transfer from ${src.name}`;
  src.tx.push({ id: id(), desc: srcDesc, amt: -amt, date: today(), transfer: true });
  dst.tx.push({ id: id(), desc: dstDesc, amt: amt, date: today(), transfer: true });
  save(); log(`⇄ ${money(amt)} · ${src.name} → ${dst.name}`, COLORS[2]);
  document.getElementById('sheetTransfer').classList.remove('open');
  document.getElementById('xf-amt').value = '';
  document.getElementById('xf-note').value = '';
  drawWallet(); drawHome();
};

/* ============================================================
   CHILL MODE — Import, Music, Watch, Read
   ============================================================ */
let chillObjectUrls = [];
function trackChillUrl(url) { chillObjectUrls.push(url); return url; }
function revokeChillUrls() {
  chillObjectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
  chillObjectUrls = [];
  const v = document.querySelector('#dlgBody video');
  if (v) { try { v.pause(); } catch {} v.removeAttribute('src'); v.load(); }
}
function fileTitle(file) {
  return (file.name || 'Untitled').replace(/\.[^.]+$/, '');
}

/* ---- Import ---- */
let importMode = 'music';
function setImportMode(mode) {
  if (typeof refreshMangaTitles === 'function') refreshMangaTitles();
  importMode = ['music','video','manga'].includes(mode) ? mode : 'music';
  document.querySelectorAll('#view-import [data-import-tab]').forEach(b => b.classList.toggle('on', b.dataset.importTab === importMode));
  document.getElementById('importMusicMode').hidden = importMode !== 'music';
  document.getElementById('importVideoMode').hidden = importMode !== 'video';
  document.getElementById('importMangaMode').hidden = importMode !== 'manga';
  drawImportList(importMode);
}
document.querySelectorAll('#view-import [data-import-tab]').forEach(b => {
  b.addEventListener('click', () => setImportMode(b.dataset.importTab));
});

function drawImportList(type) {
  const el = document.getElementById('import' + type.charAt(0).toUpperCase() + type.slice(1) + 'List');
  if (!el) return;
  const items = store.chillMedia.filter(m => m.type === type).sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
  el.innerHTML = items.length ? items.map(m => `
    <div class="chill-row" data-mid="${m.id}">
      <div class="chill-row-main">
        <div class="chill-row-title">${esc(m.title)}</div>
        <div class="chill-row-sub">${m.type === 'manga' ? mangaSub(m) : fileSize(m.size)}</div>
      </div>
      <button type="button" class="btn-icon" data-del-media="${m.id}" title="Delete">✕</button>
    </div>`).join('') : '<div class="empty">Nothing imported yet</div>';
  el.querySelectorAll('[data-del-media]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const m = store.chillMedia.find(x => x.id === btn.dataset.delMedia);
      if (!m) return;
      if (!confirm(`Delete "${m.title}"?`)) return;
      if (m.type === 'manga') {
        for (const p of mangaAllPages(m)) { try { await chillDeleteBlob(p.id); } catch {} }
      } else {
        try { await chillDeleteBlob(m.id); } catch {}
      }
      store.chillMedia = store.chillMedia.filter(x => x.id !== m.id);
      try { await chillDeleteBlob('thumb:' + m.id); } catch {}
      thumbUrls.delete(m.id); delete (store.chillProgress || {})[m.id];
      save();
      drawImportList(type); drawMusic(); drawWatch();
    });
  });
}

async function importFiles(fileList, type) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    const mid = id();
    try { await chillPut(mid, file); } catch { continue; }
    store.chillMedia.push({ id: mid, type, title: fileTitle(file), size: file.size, mimeType: file.type, dateAdded: Date.now() });
  }
  save();
  drawImportList(type); drawMusic(); drawWatch();
  log(`Imported ${files.length} ${type} file${files.length===1?'':'s'}`, COLORS[2]);
}
document.getElementById('importMusicFile')?.addEventListener('change', (e) => { importFiles(e.target.files, 'music'); e.target.value = ''; });
document.getElementById('importVideoFile')?.addEventListener('change', (e) => { importFiles(e.target.files, 'video'); e.target.value = ''; });
/* manga: title / chapter / panels */
function mangaChapters(m) { return m.chapters || (m.pages ? [{ id: 'c0', name: 'Chapter 1', pages: m.pages }] : []); }
function mangaAllPages(m) { return mangaChapters(m).flatMap(c => c.pages || []); }
function mangaSub(m) { const c = mangaChapters(m).length, p = mangaAllPages(m).length; return `${c} chapter${c===1?'':'s'} · ${p} page${p===1?'':'s'}`; }
const natSort = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
function refreshMangaTitles() {
  const dl = document.getElementById('mgTitles'); if (!dl) return;
  dl.innerHTML = store.chillMedia.filter(m => m.type === 'manga').map(m => `<option value="${esc(m.title)}/"></option>`).join('');
}
function parseMangaPath(s) {
  const p = (s || '').split('/').map(x => x.trim()).filter(Boolean);
  return { title: p[0] || '', chapter: p[1] || 'Chapter 1' };
}
let mgTick = () => {};
async function addMangaChapter(title, chapter, files) {
  files = files.filter(f => (f.type || 'image/').startsWith('image/')).sort(natSort);
  const pages = [];
  for (let i = 0; i < files.length; i++) {
    const pid = id();
    try { await chillPut(pid, files[i]); } catch { continue; }
    mgTick();
    pages.push({ id: pid, order: i });
  }
  if (!pages.length) return 0;
  let m = store.chillMedia.find(x => x.type === 'manga' && x.title.toLowerCase() === title.toLowerCase());
  if (!m) { m = { id: id(), type: 'manga', title, chapters: [], size: 0, dateAdded: Date.now() }; store.chillMedia.push(m); }
  else if (!m.chapters) { m.chapters = [{ id: id(), name: 'Chapter 1', pages: m.pages || [] }]; delete m.pages; }
  let ch = m.chapters.find(c => c.name.toLowerCase() === chapter.toLowerCase());
  if (!ch) { ch = { id: id(), name: chapter, pages: [] }; m.chapters.push(ch); }
  const base = ch.pages.length;
  pages.forEach((p, i) => { p.order = base + i; });
  ch.pages.push(...pages);
  m.chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  m.size = mangaAllPages(m).length;
  return pages.length;
}
function mangaImported(n, title, chapter) {
  save(); drawImportList('manga'); drawManga(); refreshMangaTitles();
  log(`Imported ${n} panel${n===1?'':'s'} · ${title} / ${chapter}`, COLORS[2]);
}
/* ---- ZIP reader (.cbz/.zip), from the manga app ---- */
class ZipEntry {
  constructor(file, meta) {
    this.file = file;
    this.name = meta.name;
    this.method = meta.method;
    this.compSize = meta.compSize;
    this.size = meta.size;
    this.localOffset = meta.localOffset;
    this.isDirectory = meta.name.endsWith('/');
    this.encrypted = !!(meta.flags & 1);
  }

  get supported() {
    return !this.encrypted && (this.method === 0 || this.method === 8);
  }

  /** Extract this entry into a Blob (optionally tagged with a MIME type). */
  async read(type = '') {
    const head = new DataView(await this.file.slice(this.localOffset, this.localOffset + 30).arrayBuffer());
    if (head.byteLength < 30 || head.getUint32(0, true) !== 0x04034b50) {
      throw new Error('Corrupt ZIP entry: ' + this.name);
    }
    const start = this.localOffset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    const raw = this.file.slice(start, start + this.compSize);
    if (this.method === 0) return new Blob([raw], { type });
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress ZIP files (DecompressionStream is missing).');
    }
    const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const out = await new Response(stream).blob();
    return out.slice(0, out.size, type);
  }
}

class ZipArchive {
  /** Open a File/Blob and parse its central directory. */
  static async open(file) {
    const size = file.size;
    if (size < 22) throw new Error('Not a valid ZIP archive.');

    // 1. Locate the "end of central directory" record in the last 64 KB.
    const tailLen = Math.min(size, 22 + 65535);
    const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP archive (end record not found).');

    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOffset = tail.getUint32(eocd + 16, true);

    // 2. ZIP64: real values live in the ZIP64 end record.
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || tail.getUint32(loc, true) !== 0x07064b50) throw new Error('Unsupported ZIP64 archive.');
      const z64Offset = Number(tail.getBigUint64(loc + 8, true));
      const z64 = new DataView(await file.slice(z64Offset, z64Offset + 56).arrayBuffer());
      if (z64.byteLength < 56 || z64.getUint32(0, true) !== 0x06064b50) throw new Error('Corrupt ZIP64 archive.');
      count = Number(z64.getBigUint64(32, true));
      cdSize = Number(z64.getBigUint64(40, true));
      cdOffset = Number(z64.getBigUint64(48, true));
    }

    // 3. Parse the central directory.
    const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const flags = cd.getUint16(p + 8, true);
      const method = cd.getUint16(p + 10, true);
      let compSize = cd.getUint32(p + 20, true);
      let usize = cd.getUint32(p + 24, true);
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      let localOffset = cd.getUint32(p + 42, true);
      const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

      if (usize === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
        let q = p + 46 + nameLen;
        const end = q + extraLen;
        while (q + 4 <= end) {
          const id = cd.getUint16(q, true);
          const len = cd.getUint16(q + 2, true);
          if (id === 0x0001) {
            let r = q + 4;
            if (usize === 0xffffffff) { usize = Number(cd.getBigUint64(r, true)); r += 8; }
            if (compSize === 0xffffffff) { compSize = Number(cd.getBigUint64(r, true)); r += 8; }
            if (localOffset === 0xffffffff) { localOffset = Number(cd.getBigUint64(r, true)); r += 8; }
            break;
          }
          q += 4 + len;
        }
      }
      entries.push(new ZipEntry(file, { name, flags, method, compSize, size: usize, localOffset }));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return new ZipArchive(entries);
  }

  constructor(entries) { this.entries = entries; }
}

/* ---- Manga import: files, folders, .cbz/.zip ---- */
const isImg = (n) => /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(n);
const isArc = (n) => /\.(cbz|zip)$/i.test(n);
const stripExt = (n) => n.replace(/\.[^.]+$/, '');
const mimeOf = (n) => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' })[(n.split('.').pop() || '').toLowerCase()] || 'image/jpeg';
let mgDone = 0, mgTotal = 0;
mgTick = () => { mgDone++; mgStatus(`Importing… ${mgDone}/${mgTotal} pages`); };
function mgStatus(t) { const e = document.getElementById('mgStatus'); if (e) e.textContent = t || ''; }
async function archiveGroups(file) {
  const zip = await ZipArchive.open(file), g = new Map();
  for (const e of zip.entries) {
    const parts = e.name.split('/').filter(Boolean), name = parts.pop();
    if (!name || !isImg(name) || parts.some(s => s.startsWith('.') || s === '__MACOSX')) continue;
    const k = parts.join(' – '); if (!g.has(k)) g.set(k, []); g.get(k).push({ e, name });
  }
  const out = [];
  for (const [k, list] of g) {
    const files = [];
    for (const { e, name } of list) files.push(new File([await e.read(mimeOf(name))], name, { type: mimeOf(name) }));
    out.push({ chapter: g.size === 1 ? stripExt(file.name) : (k || stripExt(file.name)), files });
  }
  return out;
}
async function runMangaGroups(groups) {
  mgTotal = groups.reduce((n, g) => n + g.files.length, 0); mgDone = 0;
  let pages = 0, last = null;
  for (const g of groups) { pages += await addMangaChapter(g.title, g.chapter, g.files); last = g; }
  mgStatus('');
  if (pages) mangaImported(pages, last.title, groups.length > 1 ? groups.length + ' chapters' : last.chapter);
  else alert('No readable images found.');
}
document.getElementById('importMangaFile')?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []); e.target.value = '';
  if (!files.length) return;
  const raw = document.getElementById('mgPath').value, p = parseMangaPath(raw), explicit = raw.includes('/');
  let title = p.title || (prompt('Manga title:', '') || '').trim();
  if (!title) return;
  const ex = store.chillMedia.find(x => x.type === 'manga' && x.title.toLowerCase() === title.toLowerCase());
  const chapter = explicit ? p.chapter : 'Chapter ' + (ex ? mangaChapters(ex).length + 1 : 1);
  const groups = [], imgs = files.filter(f => isImg(f.name) || (f.type || '').startsWith('image/'));
  if (imgs.length) groups.push({ title, chapter, files: imgs });
  try {
    for (const f of files.filter(f => isArc(f.name))) for (const a of await archiveGroups(f)) groups.push({ title, chapter: a.chapter, files: a.files });
  } catch (err) { alert(err.message); }
  if (groups.length) await runMangaGroups(groups);
});
document.getElementById('importMangaFolder')?.addEventListener('change', async (e) => {
  const items = Array.from(e.target.files || []).map(f => ({ f, p: (f.webkitRelativePath || f.name).split('/') }))
    .filter(x => !x.p.some(s => s.startsWith('.') || s === '__MACOSX'));
  e.target.value = '';
  if (!items.length) return;
  const root = items[0].p[0], deep = items.some(x => x.p.length >= 4), map = new Map();
  const add = (title, chapter, files) => { const k = title + '\0' + chapter; if (!map.has(k)) map.set(k, { title, chapter, files: [] }); map.get(k).files.push(...files); };
  try {
    for (const { f, p } of items) {
      const rel = p.slice(1);
      if (isArc(f.name)) {
        const title = deep && rel.length > 1 ? rel[0] : root;
        for (const a of await archiveGroups(f)) add(title, a.chapter, a.files);
      } else if (isImg(f.name)) {
        if (deep) add(rel.length > 1 ? rel[0] : root, rel.length > 2 ? rel.slice(1, -1).join(' – ') : 'Chapter 1', [f]);
        else add(root, rel.length > 1 ? rel.slice(0, -1).join(' – ') : 'Chapter 1', [f]);
      }
    }
  } catch (err) { alert(err.message); }
  if (map.size) await runMangaGroups([...map.values()]);
  else alert('No images or .cbz files found in that folder.');
});

/* ---- Thumbnails (music art, video frame, manga cover) ---- */
const thumbUrls = new Map(), thumbBad = new Set();
const hueOf = (s) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const artStyle = (t) => { const h = hueOf(t); return `background:linear-gradient(135deg,hsl(${h},55%,38%),hsl(${(h + 50) % 360},60%,22%))`; };
async function blobToThumb(blob, w) {
  try {
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, w / bmp.width);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
  } catch { return null; }
}
async function id3Cover(blob) { // embedded album art from ID3v2 (mp3)
  try {
    const h = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return null;
    const ver = h[3], size = ((h[6] & 127) << 21) | ((h[7] & 127) << 14) | ((h[8] & 127) << 7) | (h[9] & 127);
    const buf = new Uint8Array(await blob.slice(10, 10 + Math.min(size, 12 * 1024 * 1024)).arrayBuffer());
    const dv = new DataView(buf.buffer), idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
    let p = 0;
    while (p + hdr < buf.length) {
      const id = String.fromCharCode(...buf.slice(p, p + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break;
      const fs = ver === 2 ? (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]
        : ver === 4 ? ((buf[p + 4] & 127) << 21) | ((buf[p + 5] & 127) << 14) | ((buf[p + 6] & 127) << 7) | (buf[p + 7] & 127)
        : dv.getUint32(p + 4);
      const body = p + hdr, endB = body + fs;
      if (id === 'APIC' || id === 'PIC') {
        const enc = buf[body]; let q = body + 1;
        if (id === 'APIC') { while (q < endB && buf[q] !== 0) q++; q++; } else q += 3;
        q++;
        if (enc === 1 || enc === 2) { while (q + 1 < endB && !(buf[q] === 0 && buf[q + 1] === 0)) q += 2; q += 2; }
        else { while (q < endB && buf[q] !== 0) q++; q++; }
        const img = buf.slice(q, endB);
        return img.length > 100 ? new Blob([img], { type: img[0] === 0x89 ? 'image/png' : 'image/jpeg' }) : null;
      }
      if (fs <= 0) break;
      p = endB;
    }
  } catch {}
  return null;
}
function videoFrame(blob) {
  return new Promise(res => {
    const v = document.createElement('video'), url = URL.createObjectURL(blob);
    v.muted = true; v.preload = 'auto'; v.playsInline = true;
    let done = false;
    const fin = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); res(r); };
    v.onerror = () => fin(null);
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) * 0.1); };
    v.onseeked = () => {
      try {
        const sc = Math.min(1, 480 / (v.videoWidth || 480)), cv = document.createElement('canvas');
        cv.width = Math.round((v.videoWidth || 480) * sc); cv.height = Math.round((v.videoHeight || 270) * sc);
        cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
        const dur = v.duration;
        cv.toBlob(b => fin(b ? { blob: b, dur } : null), 'image/jpeg', 0.8);
      } catch { fin(null); }
    };
    setTimeout(() => fin(null), 10000);
    v.src = url;
  });
}
async function getThumbUrl(m) {
  if (thumbUrls.has(m.id)) return thumbUrls.get(m.id);
  if (thumbBad.has(m.id)) return null;
  let blob = await chillGetBlob('thumb:' + m.id).catch(() => null);
  if (!blob) {
    try {
      if (m.type === 'music') { const s = await chillGetBlob(m.id); const a = s && await id3Cover(s); blob = a && await blobToThumb(a, 400); }
      else if (m.type === 'video') {
        const s = await chillGetBlob(m.id), r = s && await videoFrame(s);
        if (r) { blob = r.blob; if (r.dur && !m.duration) { m.duration = r.dur; save(); } }
      } else if (m.type === 'manga') { const p = mangaAllPages(m)[0]; const s = p && await chillGetBlob(p.id); blob = s && await blobToThumb(s, 360); }
    } catch {}
    if (blob) await chillPut('thumb:' + m.id, blob).catch(() => {});
  }
  if (!blob) { thumbBad.add(m.id); return null; }
  const url = URL.createObjectURL(blob); thumbUrls.set(m.id, url); return url;
}
function hydrateThumbs(root) {
  root.querySelectorAll('[data-thumb]').forEach(async el => {
    const m = store.chillMedia.find(x => x.id === el.dataset.thumb);
    if (!m) return;
    const u = await getThumbUrl(m);
    if (!el.isConnected) return;
    if (u) { el.style.backgroundImage = `url(${u})`; el.classList.add('has'); }
    const d = el.querySelector('.dur'); if (d && m.duration) d.textContent = fmtT(m.duration);
  });
}

/* ---- Music (full-screen player + lyrics) ---- */
let chillQueue = [];
let chillQueueIndex = -1;
let shuffleOn = false, repeatMode = 'all', npSeeking = false, audioUrl = null;
const chillAudio = document.getElementById('chillAudio');
const $c = (i) => document.getElementById(i);
const fmtT = (s) => { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function drawMusic() {
  const el = $c('musicList');
  if (!el) return;
  chillQueue = store.chillMedia.filter(m => m.type === 'music').sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
  el.innerHTML = chillQueue.length ? chillQueue.map((m, i) => `
    <div class="chill-row${i===chillQueueIndex?' playing':''}" data-play="${i}">
      <div class="thumb sq" data-thumb="${m.id}" style="${artStyle(m.title)}"><span>♪</span></div>
      <div class="chill-row-main">
        <div class="chill-row-title">${esc(m.title)}</div>
        <div class="chill-row-sub">${fileSize(m.size)}${m.lyrics ? ' · ♫ lyrics' : ''}</div>
      </div>
      <span class="chill-row-icon">${i===chillQueueIndex && !chillAudio.paused ? '♪' : '▶'}</span>
    </div>`).join('') : '<div class="empty">No music imported yet — go to Import</div>';
  el.querySelectorAll('[data-play]').forEach(row => {
    row.addEventListener('click', async () => { await playChillTrack(Number(row.dataset.play)); $c('nowPlaying').hidden = false; });
  });
  hydrateThumbs(el);
}
function syncPlayUi() {
  const p = !chillAudio.paused;
  $c('mpPlay').textContent = p ? '⏸' : '▶';
  $c('npPlay').textContent = p ? '⏸' : '▶';
  $c('mpSub').textContent = chillAudio.src ? (p ? 'Playing' : 'Paused') : 'Not playing';
}
async function playChillTrack(i) {
  if (i < 0 || i >= chillQueue.length) return;
  chillQueueIndex = i;
  const m = chillQueue[i];
  const blob = await chillGetBlob(m.id).catch(() => null);
  if (!blob) return;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
  chillAudio.src = audioUrl;
  chillAudio.play().catch(() => {});
  $c('mpTitle').textContent = m.title;
  $c('npTitle').textContent = m.title;
  $c('miniPlayer').hidden = false;
  const art = $c('npArt'), mt = $c('mpThumb');
  art.style.cssText = mt.style.cssText = artStyle(m.title); art.textContent = mt.textContent = '♪';
  getThumbUrl(m).then(u => { if (u && chillQueue[chillQueueIndex] === m) { art.style.backgroundImage = mt.style.backgroundImage = `url(${u})`; art.textContent = mt.textContent = ''; } });
  drawLyrics(false); syncPlayUi(); drawMusic();
}
function nextIndex(dir) {
  const n = chillQueue.length; if (!n) return -1;
  if (dir > 0 && shuffleOn && n > 1) { let r; do { r = Math.floor(Math.random() * n); } while (r === chillQueueIndex); return r; }
  return (chillQueueIndex + dir + n) % n;
}
function togglePlay() { if (!chillAudio.src) return; if (chillAudio.paused) chillAudio.play(); else chillAudio.pause(); }
function prevTrack() { if (chillAudio.currentTime > 3) chillAudio.currentTime = 0; else playChillTrack(nextIndex(-1)); }
['mpPlay', 'npPlay'].forEach(i => $c(i)?.addEventListener('click', togglePlay));
['mpPrev', 'npPrev'].forEach(i => $c(i)?.addEventListener('click', prevTrack));
['mpNext', 'npNext'].forEach(i => $c(i)?.addEventListener('click', () => playChillTrack(nextIndex(1))));
chillAudio?.addEventListener('play', () => { syncPlayUi(); drawMusic(); });
chillAudio?.addEventListener('pause', () => { syncPlayUi(); drawMusic(); });
chillAudio?.addEventListener('timeupdate', () => {
  const d = chillAudio.duration || 0, t = chillAudio.currentTime;
  if (!npSeeking) $c('npSeek').value = d ? (t / d) * 1000 : 0;
  $c('npCur').textContent = fmtT(t); $c('npDur').textContent = fmtT(d);
  $c('mpProg').style.width = d ? (t / d) * 100 + '%' : '0';
});
chillAudio?.addEventListener('ended', () => {
  if (repeatMode === 'one') { chillAudio.currentTime = 0; chillAudio.play(); }
  else if (repeatMode === 'off' && !shuffleOn && chillQueueIndex === chillQueue.length - 1) syncPlayUi();
  else playChillTrack(nextIndex(1));
});
$c('npSeek')?.addEventListener('input', () => { npSeeking = true; $c('npCur').textContent = fmtT(($c('npSeek').value / 1000) * (chillAudio.duration || 0)); });
$c('npSeek')?.addEventListener('change', () => { if (chillAudio.duration) chillAudio.currentTime = ($c('npSeek').value / 1000) * chillAudio.duration; npSeeking = false; });
$c('npShuffle')?.addEventListener('click', () => { shuffleOn = !shuffleOn; $c('npShuffle').classList.toggle('on', shuffleOn); });
$c('npRepeat')?.addEventListener('click', () => {
  repeatMode = { off: 'all', all: 'one', one: 'off' }[repeatMode];
  $c('npRepeat').textContent = repeatMode === 'one' ? '↻1' : '↻';
  $c('npRepeat').classList.toggle('on', repeatMode !== 'off');
});
$c('npRepeat')?.classList.add('on');
$c('mpOpen')?.addEventListener('click', () => { $c('nowPlaying').hidden = false; });
$c('npClose')?.addEventListener('click', () => { $c('nowPlaying').hidden = true; });
document.querySelectorAll('[data-np-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-np-tab]').forEach(x => x.classList.toggle('on', x === b));
  $c('npPlayer').hidden = b.dataset.npTab !== 'player';
  $c('npLyrics').hidden = b.dataset.npTab !== 'lyrics';
}));

/* lyrics: add or paste per track */
function drawLyrics(editing) {
  const m = chillQueue[chillQueueIndex];
  const has = !!(m && m.lyrics && m.lyrics.trim());
  $c('npLyricsView').hidden = !!editing; $c('npLyricsEdit').hidden = !editing;
  $c('npLyricsBody').textContent = has ? m.lyrics : 'No lyrics yet. Add or paste them for this track.';
  $c('npLyricsBody').classList.toggle('empty', !has);
  $c('npLyricsEditBtn').textContent = has ? 'Edit lyrics' : 'Add lyrics';
  if (editing) { $c('npLyricsText').value = has ? m.lyrics : ''; $c('npLyricsText').focus(); }
}
$c('npLyricsEditBtn')?.addEventListener('click', () => { if (chillQueueIndex >= 0) drawLyrics(true); });
$c('npLyricsCancel')?.addEventListener('click', () => drawLyrics(false));
$c('npLyricsSave')?.addEventListener('click', () => {
  const m = chillQueue[chillQueueIndex]; if (!m) return;
  const v = $c('npLyricsText').value.trim();
  if (v) m.lyrics = v; else delete m.lyrics;
  save(); drawLyrics(false); drawMusic();
});

/* ---- Watch (full-screen video player) ---- */
function drawWatch() {
  const el = $c('watchGrid');
  if (!el) return;
  const items = store.chillMedia.filter(m => m.type === 'video').sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
  el.innerHTML = items.length ? items.map(m => `
    <div class="chill-tile vt" data-watch="${m.id}">
      <div class="thumb wide" data-thumb="${m.id}" style="${artStyle(m.title)}"><span class="play">▶</span><span class="dur">${m.duration ? fmtT(m.duration) : ''}</span></div>
      <div class="chill-tile-title">${esc(m.title)}</div>
      <div class="chill-tile-sub">${fileSize(m.size)}</div>
    </div>`).join('') : '<div class="empty">No videos imported yet — go to Import</div>';
  el.querySelectorAll('[data-watch]').forEach(tile => tile.addEventListener('click', () => openVideo(tile.dataset.watch)));
  hydrateThumbs(el);
}
let vidUrl = null, vpHide = null, vpSeeking = false, vpLastTap = 0;
const vpV = $c('vpVideo');
function vpShowUi() {
  $c('vpUi').classList.remove('off'); clearTimeout(vpHide);
  if (!vpV.paused) vpHide = setTimeout(() => $c('vpUi').classList.add('off'), 3000);
}
async function openVideo(mid) {
  const m = store.chillMedia.find(x => x.id === mid);
  if (!m) return;
  const blob = await chillGetBlob(mid);
  if (!blob) return;
  chillAudio.pause();
  if (vidUrl) URL.revokeObjectURL(vidUrl);
  vidUrl = URL.createObjectURL(blob);
  vpV.src = vidUrl; vpV.playbackRate = 1; $c('vpSpeed').textContent = '1×';
  $c('vpTitle').textContent = m.title;
  $c('vidPlayer').hidden = false;
  vpV.play().catch(() => {}); vpShowUi();
}
function closeVideo() {
  vpV.pause(); vpV.removeAttribute('src'); vpV.load();
  if (vidUrl) { URL.revokeObjectURL(vidUrl); vidUrl = null; }
  if (document.fullscreenElement) document.exitFullscreen?.();
  $c('vidPlayer').hidden = true;
}
const vpSkip = (s) => { vpV.currentTime = Math.max(0, Math.min(vpV.duration || 0, vpV.currentTime + s)); vpShowUi(); };
$c('vpClose')?.addEventListener('click', closeVideo);
$c('vpPlay')?.addEventListener('click', () => { if (vpV.paused) vpV.play(); else vpV.pause(); vpShowUi(); });
$c('vpBack')?.addEventListener('click', () => vpSkip(-10));
$c('vpFwd')?.addEventListener('click', () => vpSkip(10));
$c('vpSpeed')?.addEventListener('click', () => {
  const sp = [1, 1.25, 1.5, 2, 0.75]; const n = sp[(sp.indexOf(vpV.playbackRate) + 1) % sp.length];
  vpV.playbackRate = n; $c('vpSpeed').textContent = n + '×'; vpShowUi();
});
$c('vpFs')?.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else $c('vidPlayer').requestFullscreen?.(); });
vpV?.addEventListener('play', () => { $c('vpPlay').textContent = '⏸'; vpShowUi(); });
vpV?.addEventListener('pause', () => { $c('vpPlay').textContent = '▶'; vpShowUi(); });
vpV?.addEventListener('timeupdate', () => {
  const d = vpV.duration || 0;
  if (!vpSeeking) $c('vpSeek').value = d ? (vpV.currentTime / d) * 1000 : 0;
  $c('vpCur').textContent = fmtT(vpV.currentTime); $c('vpDur').textContent = fmtT(d);
});
$c('vpSeek')?.addEventListener('input', () => { vpSeeking = true; });
$c('vpSeek')?.addEventListener('change', () => { if (vpV.duration) vpV.currentTime = ($c('vpSeek').value / 1000) * vpV.duration; vpSeeking = false; vpShowUi(); });
// tap video = show/hide controls, double-tap left/right = seek 10s
vpV?.addEventListener('click', (e) => {
  const now = Date.now();
  if (now - vpLastTap < 300) { const r = vpV.getBoundingClientRect(); vpSkip(e.clientX < r.left + r.width / 2 ? -10 : 10); vpLastTap = 0; return; }
  vpLastTap = now;
  if ($c('vpUi').classList.contains('off')) vpShowUi(); else { clearTimeout(vpHide); $c('vpUi').classList.add('off'); }
});

/* ---- Read: Manga + Stories ---- */
let readMode = 'manga';
function setReadMode(mode) {
  readMode = mode === 'stories' ? 'stories' : 'manga';
  document.querySelectorAll('#view-read [data-read-tab]').forEach(b => b.classList.toggle('on', b.dataset.readTab === readMode));
  document.getElementById('mangaMode').hidden = readMode !== 'manga';
  document.getElementById('storiesMode').hidden = readMode !== 'stories';
  document.getElementById('btnAddStory').hidden = readMode !== 'stories';
  if (readMode === 'manga') drawManga(); else drawStories();
}
document.querySelectorAll('#view-read [data-read-tab]').forEach(b => {
  b.addEventListener('click', () => setReadMode(b.dataset.readTab));
});

function drawManga() {
  const el = document.getElementById('mangaGrid');
  if (!el) return;
  const items = store.chillMedia.filter(m => m.type === 'manga').sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
  el.innerHTML = items.length ? items.map(m => {
    const pr = (store.chillProgress || {})[m.id], ch = pr && mangaChapters(m)[pr.ci];
    return `<div class="chill-tile mt" data-manga="${m.id}">
      <div class="thumb tall" data-thumb="${m.id}" style="${artStyle(m.title)}"><span>📖</span></div>
      <div class="chill-tile-title">${esc(m.title)}</div>
      <div class="chill-tile-sub">${ch ? 'Continue · ' + esc(ch.name) : mangaSub(m)}</div>
    </div>`; }).join('') : '<div class="empty">No manga imported yet — go to Import</div>';
  el.querySelectorAll('[data-manga]').forEach(tile => tile.addEventListener('click', () => openManga(tile.dataset.manga)));
  hydrateThumbs(el);
}

/* ---- Manga reader: vertical scroll / paged LTR / paged RTL, resume, chapters ---- */
let rd = null, rdSave = null;
const rdMode = () => localStorage.getItem('nexus_mg_mode') || 'vertical';
const MODE_LABEL = { vertical: '⇵ Scroll', ltr: '→ LTR', rtl: '← RTL' };
function rdRelease() {
  rd?.io?.disconnect();
  (rd?.urls || []).forEach(u => URL.revokeObjectURL(u));
  if (rd) rd.urls = [];
}
async function openManga(mid) {
  const m = store.chillMedia.find(x => x.id === mid); if (!m) return;
  const chs = mangaChapters(m); if (!chs.length) return;
  const pr = (store.chillProgress || {})[mid];
  rd = { m, chs, ci: 0, page: 0, pages: [], urls: [], token: 0 };
  $c('mgTitle').textContent = m.title;
  $c('mgReader').hidden = false; $c('mgReader').classList.remove('off'); $c('mgChapters').hidden = true;
  $c('mgMode').textContent = MODE_LABEL[rdMode()];
  await loadChapter(pr ? Math.min(pr.ci, chs.length - 1) : 0, pr ? pr.page : 0);
}
async function loadChapter(ci, start = 0) {
  rdRelease();
  rd.ci = ci; rd.page = start; rd.token++;
  const ch = rd.chs[ci], tk = rd.token;
  rd.pages = [...(ch.pages || [])].sort((a, b) => a.order - b.order);
  rd.mode = rdMode();
  $c('mgChName').textContent = ch.name;
  const st = $c('mgStage'); st.innerHTML = ''; st.scrollTop = 0;
  st.className = 'mg-stage ' + (rd.mode === 'vertical' ? 'v' : 'p');
  if (rd.mode === 'vertical') buildVertical(tk, start); else await showPage(start);
  updatePg(); saveProg();
}
function buildVertical(tk, start) {
  const st = $c('mgStage');
  const wraps = rd.pages.map((p, i) => { const w = document.createElement('div'); w.className = 'mg-pg'; w.dataset.i = i; st.appendChild(w); return w; });
  const end = document.createElement('div'); end.className = 'mg-end';
  end.innerHTML = rd.ci < rd.chs.length - 1 ? '<button type="button" class="btn btn-gold" id="mgEndNext">Next chapter ›</button>' : '<div>End of series</div>';
  st.appendChild(end);
  $c('mgEndNext')?.addEventListener('click', (e) => { e.stopPropagation(); goCh(1); });
  rd.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loadWrap(e.target, tk); }), { root: st, rootMargin: '1500px 0px' });
  wraps.forEach(w => rd.io.observe(w));
  if (start && wraps[start]) requestAnimationFrame(() => { st.scrollTop = wraps[start].offsetTop; });
}
async function loadWrap(w, tk) {
  if (w.dataset.l) return; w.dataset.l = 1;
  const blob = await chillGetBlob(rd.pages[w.dataset.i].id).catch(() => null);
  if (!blob || tk !== rd.token) return;
  const u = URL.createObjectURL(blob); rd.urls.push(u);
  const img = new Image(); img.src = u; img.onload = () => w.classList.add('ok'); w.appendChild(img);
}
async function showPage(i) {
  if (!rd.pages.length) return;
  i = Math.max(0, Math.min(rd.pages.length - 1, i)); rd.page = i;
  const tk = rd.token, blob = await chillGetBlob(rd.pages[i].id).catch(() => null);
  if (tk !== rd.token || !blob) return;
  if (rd.cur) { URL.revokeObjectURL(rd.cur); rd.urls = rd.urls.filter(x => x !== rd.cur); }
  rd.cur = URL.createObjectURL(blob); rd.urls.push(rd.cur);
  $c('mgStage').innerHTML = `<img class="mg-one" src="${rd.cur}">`;
  updatePg(); saveProg();
}
function updatePg() { $c('mgPg').textContent = rd.pages.length ? `${rd.page + 1} / ${rd.pages.length}` : '0 / 0'; }
function saveProg() {
  clearTimeout(rdSave);
  rdSave = setTimeout(() => { if (!rd) return; (store.chillProgress ||= {})[rd.m.id] = { ci: rd.ci, page: rd.page, t: Date.now() }; save(); }, 400);
}
async function goCh(d, toLast) {
  const n = rd.ci + d; if (n < 0 || n >= rd.chs.length) return;
  await loadChapter(n, toLast ? Math.max(0, (rd.chs[n].pages || []).length - 1) : 0);
}
function pageStep(d) { // d: +1 forward / -1 back
  const n = rd.page + d;
  if (n >= rd.pages.length) goCh(1); else if (n < 0) goCh(-1, true); else showPage(n);
}
$c('mgStage')?.addEventListener('scroll', () => {
  if (!rd || rd.mode !== 'vertical') return;
  const st = $c('mgStage'), ws = [...st.querySelectorAll('.mg-pg')];
  const i = ws.findIndex(w => w.offsetTop + w.offsetHeight > st.scrollTop + st.clientHeight * 0.4);
  if (i >= 0 && i !== rd.page) { rd.page = i; updatePg(); saveProg(); }
});
$c('mgStage')?.addEventListener('click', (e) => {
  if (!rd) return;
  const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  if (rd.mode !== 'vertical' && (x < 0.3 || x > 0.7)) { const fwd = x > 0.7; pageStep((rd.mode === 'rtl' ? !fwd : fwd) ? 1 : -1); return; }
  $c('mgReader').classList.toggle('off');
});
$c('mgClose')?.addEventListener('click', () => { saveProg(); clearTimeout(rdSave); if (rd) { (store.chillProgress ||= {})[rd.m.id] = { ci: rd.ci, page: rd.page, t: Date.now() }; save(); } rdRelease(); rd = null; $c('mgReader').hidden = true; drawManga(); });
$c('mgPrevCh')?.addEventListener('click', () => goCh(-1));
$c('mgNextCh')?.addEventListener('click', () => goCh(1));
$c('mgMode')?.addEventListener('click', () => {
  const nx = { vertical: 'ltr', ltr: 'rtl', rtl: 'vertical' }[rdMode()];
  localStorage.setItem('nexus_mg_mode', nx); $c('mgMode').textContent = MODE_LABEL[nx];
  if (rd) loadChapter(rd.ci, rd.page);
});
$c('mgChBtn')?.addEventListener('click', () => {
  const box = $c('mgChapters'); if (!rd) return;
  box.innerHTML = '<div class="mg-ch-head">Chapters <button type="button" id="mgChX" class="btn-icon">✕</button></div>' + rd.chs.map((c, i) =>
    `<div class="chill-row${i === rd.ci ? ' playing' : ''}" data-ch="${i}"><div class="chill-row-main"><div class="chill-row-title">${esc(c.name)}</div><div class="chill-row-sub">${(c.pages || []).length} pages</div></div></div>`).join('');
  box.hidden = false;
  $c('mgChX').onclick = () => { box.hidden = true; };
  box.querySelectorAll('[data-ch]').forEach(r => r.onclick = () => { box.hidden = true; loadChapter(Number(r.dataset.ch), 0); });
});

function drawStories() {
  const el = document.getElementById('storyList');
  if (!el) return;
  const items = [...store.chillStories].sort((a,b) => (b.ts||0)-(a.ts||0));
  el.innerHTML = items.length ? items.map(s => {
    const preview = (s.body || '').replace(/\s+/g,' ').trim().slice(0, 90);
    return `<div class="chill-row" data-story="${s.id}">
      <div class="chill-row-main">
        <div class="chill-row-title">${esc(s.title)}</div>
        <div class="chill-row-sub">${esc(preview)}${(s.body||'').length>90?'…':''}</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty">No stories yet — tap + Story to write one</div>';
  el.querySelectorAll('[data-story]').forEach(row => {
    row.addEventListener('click', () => showStoryDetail(row.dataset.story));
  });
}
function showStoryDetail(sid) {
  const s = store.chillStories.find(x => x.id === sid);
  if (!s) return;
  document.getElementById('dlgTitle').textContent = 'Story';
  document.getElementById('dlgBody').innerHTML = `
    <div class="note-full-title">${esc(s.title)}</div>
    <div class="note-full-body">${esc(s.body)}</div>
    <div class="note-full-meta">${s.ts ? ago(s.ts) : ''}</div>
    <div class="cd-actions" style="margin-top:16px;">
      <button class="btn btn-gold" id="editStoryBtn">Edit</button>
      <button class="btn btn-ghost" id="delStoryBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editStoryBtn').onclick = () => { closeDialog(); openStoryForm(s); };
  document.getElementById('delStoryBtn').onclick = () => {
    if (!confirm('Delete this story?')) return;
    store.chillStories = store.chillStories.filter(x => x.id !== sid);
    save(); closeDialog(); drawStories();
  };
}
function openStoryForm(s) {
  document.getElementById('st-edit-id').value = s ? s.id : '';
  document.getElementById('st-title').value = s ? (s.title||'') : '';
  document.getElementById('st-body').value = s ? (s.body||'') : '';
  document.getElementById('deleteStory').hidden = !s;
  document.getElementById('sheetStory').classList.add('open');
  document.getElementById('st-title').focus();
}
function resetStoryForm() {
  document.getElementById('st-edit-id').value = '';
  document.getElementById('st-title').value = '';
  document.getElementById('st-body').value = '';
  document.getElementById('deleteStory').hidden = true;
  document.getElementById('sheetStory').classList.remove('open');
}
document.getElementById('btnAddStory')?.addEventListener('click', () => {
  const sheet = document.getElementById('sheetStory');
  if (sheet.classList.contains('open')) resetStoryForm(); else openStoryForm(null);
});
document.getElementById('cancelStory')?.addEventListener('click', resetStoryForm);
document.getElementById('saveStory')?.addEventListener('click', () => {
  const title = document.getElementById('st-title').value.trim();
  const body = document.getElementById('st-body').value.trim();
  if (!title || !body) { (title?document.getElementById('st-body'):document.getElementById('st-title')).focus(); return; }
  const editId = document.getElementById('st-edit-id').value;
  if (editId) {
    const idx = store.chillStories.findIndex(x => x.id === editId);
    if (idx >= 0) store.chillStories[idx] = { ...store.chillStories[idx], title, body };
  } else {
    store.chillStories.push({ id: id(), title, body, ts: Date.now() });
  }
  save(); resetStoryForm(); drawStories();
});
document.getElementById('deleteStory')?.addEventListener('click', () => {
  const editId = document.getElementById('st-edit-id').value;
  if (!editId) return;
  if (!confirm('Delete this story?')) return;
  store.chillStories = store.chillStories.filter(x => x.id !== editId);
  save(); resetStoryForm(); drawStories();
});

/* ---- Chill Home ---- */
function drawChillHome() {
  const el = document.getElementById('chillRecent');
  if (!el) return;
  const items = [
    ...store.chillMedia.map(m => ({ id: m.id, title: m.title, type: m.type, ts: m.dateAdded || 0 })),
    ...store.chillStories.map(s => ({ id: s.id, title: s.title, type: 'story', ts: s.ts || 0 })),
  ].sort((a,b) => b.ts - a.ts).slice(0, 8);
  const ICON = { music: '♪', video: '▶', manga: '📖', story: '✎' };
  el.innerHTML = items.length ? items.map(it => `
    <div class="row">
      <span class="dot" style="background:${COLORS[3]}"></span>
      <div class="row-main"><div class="row-title">${ICON[it.type]||''} ${esc(it.title)}</div></div>
      <span class="row-meta">${it.ts ? ago(it.ts) : ''}</span>
    </div>`).join('') : '<div class="empty">Nothing imported yet</div>';
}

function closeDialog() {
  document.getElementById('backdrop').classList.remove('open');
  const dlg = document.querySelector('.dialog');
  if (dlg) dlg.classList.remove('dialog-wide');
  revokeChillUrls();
}
document.getElementById('dlgClose').onclick = closeDialog;
document.getElementById('backdrop').onclick = e => { if (e.target.id === 'backdrop') closeDialog(); };

/* ---------- DATA ---------- */
document.getElementById('importFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      store = JSON.parse(r.result);
      store.passwords = store.passwords || [];
      store.loans = store.loans || [];
      store.customCats = Array.isArray(store.customCats) ? store.customCats : [];
      store.spendPeriod = ['all','week','month','year'].includes(store.spendPeriod) ? store.spendPeriod : 'all';
      store.spendResetTs = Number(store.spendResetTs) || 0;
      store.classNotify = !!store.classNotify;
      store.classNotifyLead = Number(store.classNotifyLead) || 10;
      save();
      applyTheme(store.theme || 'night');
      boot();
      document.getElementById('dataMsg').textContent = 'Imported successfully.';
      document.getElementById('dataMsg').style.color = 'var(--mint)';
    } catch {
      document.getElementById('dataMsg').textContent = 'Invalid file.';
      document.getElementById('dataMsg').style.color = 'var(--coral)';
    }
  };
  r.readAsText(f);
  e.target.value = '';
};

/* ---------- PASSWORDS ---------- */
function drawPasswords() {
  const list = document.getElementById('passList');
  if (!list) return;
  store.passwords = store.passwords || [];
  const items = store.passwords;
  list.innerHTML = items.length ? items.map(p => `
    <div class="pass-card" data-pid="${p.id}" style="cursor:pointer;">
      <div class="pass-site">${esc(p.site)}</div>
      <div class="pass-user">${esc(p.user || '—')}</div>
      <div class="pass-row">
        <div class="pass-val" data-val="${p.id}">••••••••</div>
        <button type="button" class="btn-icon" data-show="${p.id}" title="Show">Show</button>
        <button type="button" class="btn-icon" data-copy="${p.id}" title="Copy">Copy</button>
        <button type="button" class="btn-icon" data-delpw="${p.id}" title="Delete">Del</button>
      </div>
      ${p.notes ? `<div style="font-size:0.75rem;color:var(--mist);margin-top:6px;">${esc(p.notes)}</div>` : ''}
    </div>`).join('') : '<div class="empty" style="padding:12px 0;">No passwords yet — tap + Add</div>';
}

/* Password list actions (delegation) */
document.getElementById('passList')?.addEventListener('click', async (e) => {
  const show = e.target.closest('[data-show]');
  const copy = e.target.closest('[data-copy]');
  const del = e.target.closest('[data-delpw]');
  if (show) {
    const p = (store.passwords || []).find(x => x.id === show.dataset.show);
    if (!p) return;
    const el = document.querySelector(`[data-val="${p.id}"]`);
    if (!el) return;
    if (el.dataset.shown === '1') {
      el.textContent = '••••••••';
      el.dataset.shown = '0';
      show.textContent = 'Show';
    } else {
      el.textContent = p.pass;
      el.dataset.shown = '1';
      show.textContent = 'Hide';
    }
  } else if (copy) {
    const p = (store.passwords || []).find(x => x.id === copy.dataset.copy);
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p.pass);
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = p.pass;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
    }
  } else if (del) {
    if (!confirm('Delete this password?')) return;
    store.passwords = (store.passwords || []).filter(x => x.id !== del.dataset.delpw);
    save();
    drawPasswords();
  } else {
    const card = e.target.closest('.pass-card[data-pid]');
    if (card) showPasswordDetail(card.dataset.pid);
  }
});

function showPasswordDetail(pid) {
  const p = (store.passwords || []).find(x => x.id === pid);
  if (!p) return;
  document.getElementById('dlgTitle').textContent = 'Password';
  document.getElementById('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${esc(p.site)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Username</span><span class="cd-v">${p.user ? esc(p.user) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${p.notes ? esc(p.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editPassBtn">Edit</button>
        <button class="btn btn-ghost" id="delPassBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editPassBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openPassForm(p);
  };
  document.getElementById('delPassBtn').onclick = () => {
    if (!confirm('Delete this password?')) return;
    store.passwords = (store.passwords || []).filter(x => x.id !== pid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawPasswords();
  };
}

function openPassForm(p) {
  const sheet = document.getElementById('sheetPass');
  if (!sheet) return;
  document.getElementById('pw-edit-id').value = p ? p.id : '';
  document.getElementById('pw-site').value = p ? (p.site || '') : '';
  document.getElementById('pw-user').value = p ? (p.user || '') : '';
  document.getElementById('pw-pass').value = p ? (p.pass || '') : '';
  document.getElementById('pw-notes').value = p ? (p.notes || '') : '';
  document.getElementById('deletePass').hidden = !p;
  sheet.classList.add('open');
  sheet.style.display = 'block';
  document.getElementById('pw-site')?.focus();
}

function resetPassForm() {
  const sheet = document.getElementById('sheetPass');
  document.getElementById('pw-edit-id').value = '';
  ['pw-site','pw-user','pw-pass','pw-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('deletePass').hidden = true;
  if (sheet) { sheet.classList.remove('open'); sheet.style.display = ''; }
}

document.getElementById('btnAddPass')?.addEventListener('click', (e) => {
  e.preventDefault();
  openPassForm(null);
});
document.getElementById('cancelPass')?.addEventListener('click', (e) => {
  e.preventDefault();
  resetPassForm();
});
document.getElementById('savePass')?.addEventListener('click', (e) => {
  e.preventDefault();
  const site = document.getElementById('pw-site')?.value.trim();
  const user = document.getElementById('pw-user')?.value.trim() || '';
  const pass = document.getElementById('pw-pass')?.value || '';
  const notes = document.getElementById('pw-notes')?.value.trim() || '';
  if (!site) { document.getElementById('pw-site')?.focus(); return; }
  if (!pass) { document.getElementById('pw-pass')?.focus(); return; }
  const editId = document.getElementById('pw-edit-id')?.value || '';
  store.passwords = store.passwords || [];
  if (editId) {
    const idx = store.passwords.findIndex(x => x.id === editId);
    if (idx >= 0) store.passwords[idx] = { ...store.passwords[idx], site, user, pass, notes };
    save();
  } else {
    store.passwords.push({ id: id(), site, user, pass, notes });
    save();
  }
  resetPassForm();
  drawPasswords();
});
document.getElementById('deletePass')?.addEventListener('click', (e) => {
  e.preventDefault();
  const editId = document.getElementById('pw-edit-id')?.value || '';
  if (!editId) return;
  if (!confirm('Delete this password?')) return;
  store.passwords = (store.passwords || []).filter(x => x.id !== editId);
  save();
  resetPassForm();
  drawPasswords();
});

/* First-run Terms */
const TOS_KEY = 'nexus-tos-v1';
function tosAccepted() { return localStorage.getItem(TOS_KEY) === '1'; }
function showTos(review) {
  const gate = document.getElementById('tosGate');
  const agree = document.getElementById('tosAgree');
  const btn = document.getElementById('tosAccept');
  if (!gate) return;
  gate.hidden = false;
  if (review) {
    if (agree) { agree.checked = true; agree.disabled = true; }
    if (btn) { btn.disabled = false; btn.textContent = 'Close'; }
  } else {
    if (agree) { agree.checked = false; agree.disabled = false; }
    if (btn) { btn.disabled = true; btn.textContent = 'Continue'; }
  }
}
function hideTos() {
  const gate = document.getElementById('tosGate');
  if (gate) gate.hidden = true;
}
document.getElementById('tosAgree')?.addEventListener('change', (e) => {
  const btn = document.getElementById('tosAccept');
  if (btn) btn.disabled = !e.target.checked;
});
document.getElementById('tosAccept')?.addEventListener('click', () => {
  if (!tosAccepted()) {
    const agree = document.getElementById('tosAgree');
    if (!agree?.checked) return;
    localStorage.setItem(TOS_KEY, '1');
  }
  hideTos();
});

/* First-run terms gate — previously shown after the splash faded out */
function maybeShowTos() {
  if (!tosAccepted()) showTos(false);
}

/* Boot */
function boot() {
  drawHome();
  drawBoard();
  drawTasks();
  drawPeople();
  drawNotes();
  drawWallet();
  drawPasswords();
  fillSubs();
  refreshSettingsUI();
  tick();
  scheduleDueTaskReminders();
  scheduleAllClassNotifications();
  maybeShowTos();
  if (store.mode === 'chill') {
    document.querySelector('.rail-chill [data-go="chome"]')?.click();
  }
}
boot();
