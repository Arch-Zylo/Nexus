import { Component } from './Component.js';
import { Platform } from './Platform.js';

export class OverlayManager extends Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    super(app);
    /* Android Back: step back through screens (closing sheets / players first) instead of leaving the app.
       Every screen change and every full-screen layer adds a history entry; Back removes the newest one. */
    this.ovStack = [];
    this.ignorePops = 0;
    this.pendingPush = [];
    this.ignoreTimer = null;
    this.useHist = true;
    this.navStack = [{ go: 'home', mode: 'regular' }];
    this.navCur = { go: 'home', mode: 'regular' };
    this.navRestoring = false;
    /* Android: take over the hardware Back button through Capacitor's App plugin, so Back never depends on WebView history */
    this.exitArmed = 0;
    this.nativeBackReady = false;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    try { history.replaceState({ nexusNav: this.navCur }, ''); } catch {}
    this.initNativeBack();
    window.addEventListener('load', this.initNativeBack);
    window.addEventListener('popstate', (e) => {
      if (this.ignorePops > 0) { this.ignorePops--; if (!this.ignorePops) this.histFlush(); return; }
      const f = this.ovStack.pop(); if (f) { f(); return; }
      if (e.state && e.state.nexusOv) { try { history.back(); } catch {} return; }   // skip a leftover layer entry
      if (e.state && e.state.nexusNav) this.navRestore(e.state.nexusNav);
    });
  }

  /** Remembers a navigation step (view + mode) so the back button can retrace it. */
  recordNav(cur) {
    if (this.navRestoring) return;
    if (cur.go === this.navCur.go && cur.mode === this.navCur.mode) return;
    this.navCur = cur; this.navStack.push(cur);
    if (this.navStack.length > 60) this.navStack.shift();
    this.histPush({ nexusNav: cur });
  }

  histPush(st) {
    if (!this.useHist) return;
    if (this.ignorePops > 0) { this.pendingPush.push(st); return; }
    try { history.pushState(st, ''); } catch {}
  }

  histFlush() { this.ignorePops = 0; clearTimeout(this.ignoreTimer); const q = this.pendingPush; this.pendingPush = []; q.forEach(this.histPush); }

  histBack() {
    if (!this.useHist) return;
    this.ignorePops++; clearTimeout(this.ignoreTimer); this.ignoreTimer = setTimeout(this.histFlush, 700);
    try { history.back(); } catch { this.histFlush(); }
  }

  open(closeFn) { this.ovStack.push(closeFn); this.histPush({ nexusOv: this.ovStack.length }); }

  close(closeFn) {            // an in-app close button
    const i = this.ovStack.lastIndexOf(closeFn);
    if (i >= 0 && i === this.ovStack.length - 1) { this.ovStack.pop(); closeFn(); this.histBack(); return; }
    if (i >= 0) this.ovStack.splice(i, 1);
    closeFn();
  }

  release(closeFn) {          // closed by other code: just drop its history entry
    const i = this.ovStack.lastIndexOf(closeFn); if (i < 0) return;
    if (i === this.ovStack.length - 1) { this.ovStack.pop(); this.histBack(); } else this.ovStack.splice(i, 1);
  }

  navRestore(n) {
    this.navRestoring = true;
    try {
      if (n.mode !== this.state.mode) this.app.mode.applyMode(n.mode);
      const btn = document.querySelector(`${n.mode === 'chill' ? '.rail-chill' : '.rail:not(.rail-chill)'} .rail-btn[data-go="${n.go}"]`);
      if (btn) btn.click(); else this.app.shell.navigate(n.go);       // Settings / Passwords / Profile have no rail button
    } finally { this.navRestoring = false; }
    this.navCur = { go: n.go, mode: n.mode };
  }

  /* One step of "Back": close the newest layer, else return to the previous screen. false = nothing left (we're at the root). */
  goBackOnce() {
    const f = this.ovStack.pop();
    if (f) { f(); this.histBack(); return true; }
    if (this.navStack.length > 1) { this.navStack.pop(); this.navRestore(this.navStack[this.navStack.length - 1]); return true; }
    return false;
  }

  initNativeBack() {
    if (this.nativeBackReady) return;
    const AppP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!AppP || typeof AppP.addListener !== 'function' || !Platform.isNative()) return;
    this.nativeBackReady = true; this.useHist = false;
    try {
      const r = AppP.addListener('backButton', () => {
        if (this.app.lock && this.app.lock.locked) { this.exitOrWarn(AppP); return; }   // locked: Back must not step through screens
        try { if (this.goBackOnce()) return; } catch (e) { console.warn('Nexus: back failed', e); }
        this.exitOrWarn(AppP);
      });

      if (r && r.catch) r.catch(() => { this.useHist = true; this.nativeBackReady = false; });
    } catch (e) { this.useHist = true; this.nativeBackReady = false; }
  }

  exitOrWarn(AppP) {
    const now = Date.now();
    if (now - this.exitArmed < 2200) { try { AppP.exitApp(); } catch {} return; }
    this.exitArmed = now; this.app.toast.show('Press back again to exit', 'info', 2000);
  }
}
