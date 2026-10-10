import { Component } from './Component.js';
import { LOCK_KEY } from './constants.js';
import { Dom } from './Dom.js';

const PIN_LEN = 4;
const DELAYS = [
  { id: 'now', label: 'Immediately', ms: 0 },
  { id: '1m', label: 'After 1 minute', ms: 60000 },
  { id: '5m', label: 'After 5 minutes', ms: 300000 }
];
const FREE_TRIES = 5;          // wrong PINs allowed before a cool-down kicks in

/**
 * Optional app lock. A 4-digit PIN (stored as a salted hash, outside the main store) is asked for when
 * Nexus opens and when you come back after being away. It keeps people out of the app UI; it does not encrypt the data.
 * One keypad screen serves every step: unlock, set a PIN, confirm it, and "enter your PIN to continue".
 */
export class AppLock extends Component {
  constructor(app) {
    super(app);
    this.cfg = this.load();           // { salt, hash, delay, fails, until } or null when the lock is off
    this.locked = false;
    this.mode = 'unlock';             // unlock | setup | confirm | verify
    this.buf = '';
    this.first = '';
    this.onDone = null;
    this.away = false;
    this.hiddenAt = 0;
    this.busy = false;
    this.tick = null;
  }

  get enabled() { return !!(this.cfg && this.cfg.hash); }
  delayInfo() { return DELAYS.find(d => d.id === (this.cfg && this.cfg.delay)) || DELAYS[1]; }

  init() {
    Dom.byId('lockPad')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      b.dataset.k === 'back' ? this.back() : this.press(b.dataset.k);
    });
    Dom.byId('lockCancel')?.addEventListener('click', this.cancel);
    Dom.byId('lockForgot')?.addEventListener('click', this.forgot);
    document.addEventListener('keydown', (e) => {
      if (Dom.byId('lockScreen')?.hidden) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); this.press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); this.back(); }
      else if (e.key === 'Escape' && this.mode !== 'unlock') this.cancel();
    });
    document.addEventListener('visibilitychange', () => document.hidden ? this.onAway() : this.onBack());
    const AppP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    try { AppP?.addListener?.('appStateChange', (st) => st && st.isActive ? this.onBack() : this.onAway()); } catch {}
    if (this.enabled) this.show('unlock');
  }

  /* ---- storage ---- */
  load() {
    try { const c = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); return c && c.hash && c.salt ? c : null; } catch { return null; }
  }
  persist() {
    try { this.cfg ? localStorage.setItem(LOCK_KEY, JSON.stringify(this.cfg)) : localStorage.removeItem(LOCK_KEY); } catch {}
  }
  async hashPin(pin, salt) {
    const bytes = new TextEncoder().encode(salt + ':' + pin);
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;   // plain-http fallback (no WebCrypto): weaker, but still not the PIN itself
    for (const c of bytes) { h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }
  newSalt() {
    const a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---- keypad screen ---- */
  show(mode, opts = {}) {
    this.mode = mode; this.buf = ''; this.first = ''; this.onDone = opts.onDone || null;
    const unlocking = mode === 'unlock';
    this.locked = unlocking;
    Dom.byId('lockScreen').hidden = false;
    const app = document.querySelector('.app'); if (app) app.inert = true;
    const dr = Dom.byId('settingsDrawer'); if (dr) dr.inert = true;
    Dom.byId('lockTitle').textContent = unlocking ? 'Nexus is locked' : mode === 'verify' ? 'Enter your PIN' : 'App lock';
    Dom.byId('lockSub').textContent = opts.sub || (unlocking ? 'Enter your PIN' : mode === 'setup' ? 'Choose a 4-digit PIN' : 'Enter your PIN');
    Dom.byId('lockCancel').hidden = unlocking;
    Dom.byId('lockForgot').hidden = !unlocking;
    this.setMsg('');
    this.drawDots();
    this.checkCooldown();
  }

  hide() {
    Dom.byId('lockScreen').hidden = true;
    const app = document.querySelector('.app'); if (app) app.inert = false;
    const dr = Dom.byId('settingsDrawer'); if (dr) dr.inert = false;
    this.locked = false; this.buf = ''; clearInterval(this.tick);
  }

  lock() {
    if (!this.enabled || this.locked) return;
    this.show('unlock');
  }

  drawDots() {
    [...Dom.byId('lockDots').children].forEach((d, i) => d.classList.toggle('on', i < this.buf.length));
  }
  setMsg(t, bad) { const m = Dom.byId('lockMsg'); m.textContent = t; m.classList.toggle('bad', !!bad); }
  shake() { const d = Dom.byId('lockDots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }

  press(k) {
    if (this.busy || this.coolLeft() > 0 || this.buf.length >= PIN_LEN) return;
    this.buf += k; this.drawDots();
    if (this.buf.length === PIN_LEN) { this.busy = true; setTimeout(() => this.submit().finally(() => { this.busy = false; }), 90); }
  }
  back() { if (this.busy) return; this.buf = this.buf.slice(0, -1); this.drawDots(); }

  async submit() {
    const pin = this.buf;
    if (this.mode === 'setup') {
      this.first = pin; this.mode = 'confirm'; this.buf = '';
      Dom.byId('lockSub').textContent = 'Enter it again to confirm'; this.setMsg(''); this.drawDots(); return;
    }
    if (this.mode === 'confirm') {
      if (pin !== this.first) {
        this.mode = 'setup'; this.first = ''; this.buf = '';
        Dom.byId('lockSub').textContent = 'Choose a 4-digit PIN'; this.setMsg('PINs didn’t match — try again', true); this.shake(); this.drawDots(); return;
      }
      const salt = this.newSalt();
      this.cfg = { delay: (this.cfg && this.cfg.delay) || '1m', fails: 0, until: 0, salt, hash: await this.hashPin(pin, salt) };
      this.persist(); this.finish(true); return;
    }
    // unlock / verify
    if (!this.enabled) { this.finish(true); return; }
    if (await this.hashPin(pin, this.cfg.salt) === this.cfg.hash) {
      this.cfg.fails = 0; this.cfg.until = 0; this.persist(); this.finish(true); return;
    }
    this.cfg.fails = (this.cfg.fails || 0) + 1;
    if (this.cfg.fails % FREE_TRIES === 0) {
      const wait = Math.min(900, 30 * Math.pow(2, this.cfg.fails / FREE_TRIES - 1));   // 30s, 60s, 2m … max 15m
      this.cfg.until = Date.now() + wait * 1000;
    }
    this.persist(); this.buf = ''; this.drawDots(); this.shake();
    if (!this.checkCooldown()) this.setMsg('Wrong PIN', true);
  }

  finish(ok) {
    const cb = this.onDone; this.onDone = null;
    const wasUnlock = this.mode === 'unlock';
    this.hide();
    if (wasUnlock) { try { this.app.settings.refreshSettingsUI(); } catch {} return; }
    if (cb && ok) cb();
  }

  cancel() { if (this.mode === 'unlock') return; this.onDone = null; this.hide(); }

  coolLeft() { return this.cfg && this.cfg.until ? Math.max(0, Math.ceil((this.cfg.until - Date.now()) / 1000)) : 0; }
  /** Shows the "try again in …" countdown while a cool-down is active. Returns true if one is. */
  checkCooldown() {
    clearInterval(this.tick);
    if (this.coolLeft() <= 0) return false;
    const upd = () => {
      const s = this.coolLeft();
      if (s <= 0) { clearInterval(this.tick); this.setMsg(''); return; }
      this.setMsg('Too many attempts. Try again in ' + (s >= 60 ? Math.ceil(s / 60) + ' min' : s + ' s'), true);
    };
    upd(); this.tick = setInterval(upd, 1000);
    return true;
  }

  /* ---- leaving / coming back ---- */
  onAway() {
    if (this.away || !this.enabled || this.locked || this.mode !== 'unlock' && !Dom.byId('lockScreen').hidden) return;
    this.away = true; this.hiddenAt = Date.now();
    if (this.delayInfo().ms === 0) this.lock();     // cover the screen before the app-switcher takes its snapshot
  }
  onBack() {
    if (!this.away) return;
    this.away = false;
    if (this.enabled && !this.locked && Date.now() - this.hiddenAt >= this.delayInfo().ms) this.lock();
  }

  /* ---- Settings actions ---- */
  toggle() {
    if (!this.enabled) { this.show('setup', { onDone: () => { this.app.settings.refreshSettingsUI(); this.app.toast.show('App lock is on'); } }); return; }
    this.show('verify', { sub: 'Enter your PIN to turn off app lock', onDone: () => {
      this.cfg = null; this.persist(); this.app.settings.refreshSettingsUI(); this.app.toast.show('App lock is off');
    } });
  }
  changePin() {
    this.show('verify', { sub: 'Enter your current PIN', onDone: () => {
      this.show('setup', { onDone: () => { this.app.settings.refreshSettingsUI(); this.app.toast.show('PIN changed'); } });
    } });
  }
  cycleDelay() {
    if (!this.enabled) return;
    this.cfg.delay = DELAYS[(DELAYS.findIndex(d => d.id === this.delayInfo().id) + 1) % DELAYS.length].id;
    this.persist(); this.app.settings.refreshSettingsUI();
  }
  lockNow() {
    this.app.shell.closeSettings();
    setTimeout(this.lock, 60);
  }

  /** Last resort when the PIN is forgotten: erase everything on this device, which also removes the lock. */
  async forgot() {
    if (!confirm('Forgot your PIN?\n\nThe only way back in is to erase ALL Nexus data on this device (classes, tasks, notes, passwords, media). This cannot be undone.\n\nContinue?')) return;
    if (!confirm('Erase everything and remove the app lock?')) return;
    await this.app.backup.performWipe();
    this.cfg = null; this.persist(); this.hide(); this.app.settings.refreshSettingsUI();
    this.app.toast.show('Nexus was reset');
  }
}
