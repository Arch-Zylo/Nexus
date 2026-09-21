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
const SPEND_CATS = [
  { key: 'medical', label: 'Medical', color: COLORS[1] },
  { key: 'food', label: 'Food', color: COLORS[0] },
  { key: 'snack', label: 'Snack', color: COLORS[5] },
  { key: 'transportation', label: 'Transportation', color: COLORS[3] },
  { key: 'school', label: 'School Payment', color: COLORS[2] },
  { key: 'other', label: 'Other', color: COLORS[7] },
];
const SPEND_CAT_LABEL = Object.fromEntries(SPEND_CATS.map(c => [c.key, c.label]));

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
      d.notify = !!d.notify;
      d.classNotify = !!d.classNotify;
      d.classNotifyLead = Number(d.classNotifyLead) || 10;
      return d;
    }
  } catch {}
  return {
    classes: [], events: [], tasks: [], people: [], notes: [],
    accounts: [], loans: [], passwords: [], log: [],
    theme: 'night', style: 'soft',
    name: '', school: '', currency: '$', timefmt: '12', notify: false,
    classNotify: false, classNotifyLead: 10
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
    classNotify: false, classNotifyLead: 10
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
  else if (action === 'notify') toggleNotify();
  else if (action === 'classnotify') toggleClassNotify();
  else if (action === 'classnotifylead') cycleClassNotifyLead();
  else if (action === 'passwords') showPassPanel();
  else if (action === 'export') doExport();
  else if (action === 'import') {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup && confirm('Restore from your local backup? (Cancel to pick a file instead)')) {
      const msg = document.getElementById('dataMsg');
      try {
        store = JSON.parse(backup);
        store.passwords = store.passwords || [];
        store.loans = store.loans || [];
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
    if (v === 'config') { refreshSettingsUI(); hidePassPanel(); }
  };
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

  // Classes left today: today's classes whose end time hasn't passed yet.
  // Naturally counts down through the day as each class finishes, and is
  // 0 on weekends since there are no Sat/Sun classes in the timetable.
  const todaysAllClasses = store.classes.filter(c => +c.day === dow);
  const classesLeftToday = todaysAllClasses.filter(c => mins(c.end) > nowMins).length;

  document.getElementById('metrics').innerHTML = [
    { label:'On Hand', value: money(totalCash), color: COLORS[4], primary: true },
    { label:'Open Tasks', value: open, color: COLORS[1] },
    { label:'Classes Left Today', value: classesLeftToday, color: COLORS[3] },
  ].map(m => `
    <div class="metric${m.primary ? ' primary' : ''}">
      <div class="accent" style="background:${m.color}"></div>
      <div class="label">${m.label}</div>
      <div class="value">${m.value}</div>
    </div>`).join('');

  // Spending by category — expenses only (amt < 0), loans excluded since
  // they're tracked separately as receivables, not a spending category.
  const catTotals = {};
  store.accounts.forEach(a => (a.tx||[]).forEach(t => {
    if (t.amt < 0 && !t.loan) {
      const key = SPEND_CAT_LABEL[t.cat] ? t.cat : 'other';
      catTotals[key] = (catTotals[key] || 0) + Math.abs(t.amt);
    }
  }));
  const spendTotal = Object.values(catTotals).reduce((s,v) => s+v, 0);
  const spendEl = document.getElementById('spendChart');
  if (spendEl) {
    if (!spendTotal) {
      spendEl.innerHTML = '<div class="empty">No spending recorded yet</div>';
    } else {
      let acc = 0;
      const stops = [];
      const legend = [];
      SPEND_CATS.forEach(c => {
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
            <span class="pie-label">${c.label}</span>
            <span class="pie-val">${money(amt)} · ${Math.round(pct*100)}%</span>
          </div>`);
      });
      spendEl.innerHTML = `
        <div class="pie-wrap">
          <div class="pie" style="background:conic-gradient(${stops.join(', ')});"></div>
          <div class="pie-legend">${legend.join('')}</div>
        </div>`;
    }
  }

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
      <h3>${esc(n.title)}</h3>
      <div class="preview">${esc(preview)}${(n.body||'').length > 90 ? '…' : ''}</div>
      <div class="when">${n.ts ? ago(n.ts) : ''}</div>
    </div>`;
  }).join('') : '<div class="empty">No notes yet</div>';

  grid.querySelectorAll('[data-nid]').forEach(card => {
    card.onclick = () => showNoteDetail(card.dataset.nid);
  });
}

function showNoteDetail(nid) {
  const n = store.notes.find(x => x.id === nid);
  if (!n) return;
  document.getElementById('dlgTitle').textContent = 'Note';
  document.getElementById('dlgBody').innerHTML = `
    <div class="note-full-title">${esc(n.title)}</div>
    <div class="note-full-body">${esc(n.body)}</div>
    <div class="note-full-meta">${n.ts ? ago(n.ts) : ''}</div>
    <div class="cd-actions" style="margin-top:16px;">
      <button class="btn btn-gold" id="editNoteBtn">Edit</button>
      <button class="btn btn-ghost" id="delNoteBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
    </div>`;
  document.getElementById('backdrop').classList.add('open');
  document.getElementById('editNoteBtn').onclick = () => {
    document.getElementById('backdrop').classList.remove('open');
    openNoteForm(n);
  };
  document.getElementById('delNoteBtn').onclick = () => {
    if (!confirm('Delete this note?')) return;
    store.notes = store.notes.filter(x => x.id !== nid);
    save();
    document.getElementById('backdrop').classList.remove('open');
    drawNotes();
  };
}

function openNoteForm(n) {
  document.getElementById('n-edit-id').value = n ? n.id : '';
  document.getElementById('n-title').value = n ? (n.title || '') : '';
  document.getElementById('n-body').value = n ? (n.body || '') : '';
  document.getElementById('deleteNote').hidden = !n;
  document.getElementById('sheetNote').classList.add('open');
  document.getElementById('n-title').focus();
}

function resetNoteForm() {
  document.getElementById('n-edit-id').value = '';
  document.getElementById('n-title').value = '';
  document.getElementById('n-body').value = '';
  document.getElementById('deleteNote').hidden = true;
  document.getElementById('sheetNote').classList.remove('open');
}

document.getElementById('btnAddNote').onclick = () => {
  const sheet = document.getElementById('sheetNote');
  if (sheet.classList.contains('open')) resetNoteForm();
  else openNoteForm(null);
};
document.getElementById('cancelNote').onclick = () => resetNoteForm();
document.getElementById('saveNote').onclick = () => {
  const title = document.getElementById('n-title').value.trim();
  const body = document.getElementById('n-body').value.trim();
  if (!title || !body) {
    (title ? document.getElementById('n-body') : document.getElementById('n-title')).focus();
    return;
  }
  const editId = document.getElementById('n-edit-id').value;
  if (editId) {
    const idx = store.notes.findIndex(x => x.id === editId);
    if (idx >= 0) store.notes[idx] = { ...store.notes[idx], title, body };
    save(); log(`Note updated · ${title}`, COLORS[5]);
  } else {
    store.notes.push({ id: id(), title, body, ts: Date.now() });
    save(); log(`Note · ${title}`, COLORS[5]);
  }
  resetNoteForm();
  drawNotes();
};
document.getElementById('deleteNote').onclick = () => {
  const editId = document.getElementById('n-edit-id').value;
  if (!editId) return;
  if (!confirm('Delete this note?')) return;
  store.notes = store.notes.filter(x => x.id !== editId);
  save();
  resetNoteForm();
  drawNotes();
};

/* ---------- WALLET ---------- */
function drawWallet() {
  const list = document.getElementById('accList');
  let total = 0;
  store.accounts.forEach(a => total += bal(a));
  const el = document.getElementById('walletTotal');
  el.textContent = money(total);
  el.classList.toggle('neg', total < 0);

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
              ${[SPEND_CATS.find(c=>c.key==='other'), ...SPEND_CATS.filter(c=>c.key!=='other')].map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
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
        const tx = { id: id(), desc: note, amt: isIn ? amt : -amt, date: today() };
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
            <span class="tx-desc">${esc(t.desc)}${t.cat && SPEND_CAT_LABEL[t.cat] ? ' · ' + esc(SPEND_CAT_LABEL[t.cat]) : ''}</span>
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

document.getElementById('btnAddAcc').onclick = () => document.getElementById('sheetAcc').classList.toggle('open');
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

document.getElementById('dlgClose').onclick = () => document.getElementById('backdrop').classList.remove('open');
document.getElementById('backdrop').onclick = e => { if (e.target.id === 'backdrop') e.target.classList.remove('open'); };

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
}
boot();
