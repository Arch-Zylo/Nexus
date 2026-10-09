import { autoBind } from './Component.js';
import { COLORS, KEY } from './constants.js';
import { Util } from './Util.js';

export class Store {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    this.app = app;
    autoBind(this);
    this.state = this.load();
  }

  load() {
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
        d.mode = 'regular'; // the app always opens in Regular mode
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

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); return true; }
    catch (e) {
      console.error('Nexus: save failed', e);
      this.app.toast.show('Storage is full — your latest changes could not be saved. Export a backup and free some space.', 'err', 7000);
      return false;
    }
  }

  defaultStore() {
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

  /* Validate + migrate a backup BEFORE it is allowed to replace the live store. Returns null if unusable. */
  normalizeStore(raw) {
    let o = raw;
    if (o && typeof o === 'object' && o.backupVersion && o.data) o = o.data;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (!['classes', 'events', 'tasks', 'people', 'notes', 'accounts', 'chillMedia'].some(k => k in o)) return null;
    const s = { ...this.defaultStore(), ...o };
    ['classes', 'events', 'tasks', 'people', 'notes', 'accounts', 'loans', 'passwords', 'chillMedia', 'chillStories']
      .forEach(k => { s[k] = Array.isArray(o[k]) ? o[k].filter(x => x && typeof x === 'object') : []; });
    s.log = Array.isArray(o.log) ? o.log : [];
    s.customCats = Array.isArray(o.customCats) ? o.customCats : [];
    s.chillProgress = o.chillProgress && typeof o.chillProgress === 'object' && !Array.isArray(o.chillProgress) ? o.chillProgress : {};
    s.spendPeriod = ['all', 'week', 'month', 'year'].includes(o.spendPeriod) ? o.spendPeriod : 'all';
    s.spendResetTs = Number(o.spendResetTs) || 0;
    s.classNotify = !!o.classNotify;
    s.classNotifyLead = Number(o.classNotifyLead) || 10;
    s.mode = 'regular';
    return s;
  }

  money(n) {
    const sym = this.state.currency || '$';
    const abs = Math.abs(n).toFixed(2);
    // symbols that go after the number
    if (sym === '₱' || sym === '€' || sym === '£' || sym === '¥' || sym === '₩') {
      return (n < 0 ? '-' : '') + sym + abs;
    }
    return (n < 0 ? '-' : '') + sym + abs;
  }

  log(msg, color) {
    this.state.log.unshift({ id: Util.id(), msg, color: color||COLORS[3], ts: Date.now() });
    this.state.log = this.state.log.slice(0, 30);
    this.save();
  }
}
