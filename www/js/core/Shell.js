import { Component } from './Component.js';
import { APP_VERSION_LABEL, DAYS_FULL } from './constants.js';
import { Dom } from './Dom.js';

export class Shell extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    const self = this;
    this.tick();
    setInterval(this.tick, 1000);
    // Mobile/webview environments suspend timers while backgrounded or the
    // screen is locked, which is why the clock could appear stuck on the
    // time the app was last opened. Force an immediate refresh whenever the
    // page regains visibility or focus so it snaps back to the real time.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.tick(); });
    window.addEventListener('pageshow', this.tick);
    window.addEventListener('focus', this.tick);
    /* Navigation */
    document.querySelectorAll('.rail-btn').forEach(btn => {
      btn.onclick = () => {
        const ne = Dom.byId('noteEditor');
        if (ne && !ne.hidden) { this.app.notes.closeNoteEditor(); this.app.overlays.release(this.app.notes.closeNoteEditor); }
        this.app.passwords.hidePassPanel();
        document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.go;
        document.querySelectorAll('.view').forEach(s => s.classList.remove('on'));
        Dom.byId('view-'+v).classList.add('on');
        if (v === 'timetable') this.app.timetable.setTtMode(this.app.timetable.ttMode);
        if (v === 'wallet') this.app.wallet.drawWallet();
        if (v === 'config') { this.app.settings.refreshSettingsUI(); this.app.passwords.hidePassPanel(); this.app.mode.hideModePanel(); }
        if (v === 'chome') this.app.chillHome.drawChillHome();
        if (v === 'music') this.app.music.drawMusic();
        if (v === 'watch') this.app.video.drawWatch();
        if (v === 'read') this.app.read.setReadMode(this.app.read.readMode);
        if (v === 'import') this.app.importer.setImportMode(this.app.importer.importMode);
        this.app.overlays.recordNav({ go: v, mode: this.state.mode });
      };
    });
    document.querySelectorAll('[data-go-chill]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector(`.rail-chill [data-go="${btn.dataset.goChill}"]`)?.click();
      });
    });
    (function watchSheets() {
      const bd = Dom.byId('backdrop');
      let was = false;
      const mo = new MutationObserver(() => {
        const open = !!(bd && bd.classList.contains('open')) || !!document.querySelector('.sheet.open');
        if (open && !was) { was = true; self.app.overlays.open(self.closeSheetsNow); }
        else if (!open && was) { was = false; self.app.overlays.release(self.closeSheetsNow); }
      });
      [bd, ...document.querySelectorAll('.sheet')].filter(Boolean).forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
    })();
    Dom.byId('appVersionValue') && (Dom.byId('appVersionValue').textContent = APP_VERSION_LABEL);
    Dom.byId('tosVersion') && (Dom.byId('tosVersion').textContent = 'Nexus ' + APP_VERSION_LABEL + ' · Last updated October 5, 2026');
  }

  /* Clock + greeting */
  tick() {
    const n = new Date();
    const timeOpts = this.state.timefmt === '24'
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: 'numeric', minute: '2-digit', second: '2-digit' };
    Dom.byId('liveClock').textContent =
      n.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) +
      ' · ' + n.toLocaleTimeString('en-US', timeOpts);
    const h = n.getHours();
    const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    Dom.byId('greet').textContent =
      this.state.name ? `${hello}, Master ${this.state.name}` : hello;
    const dow = n.getDay();
    let sub = dow === 0 || dow === 6 ? 'Its Weekend — No classes today.' :
      `Today is ${DAYS_FULL[dow]}. Here's your snapshot.`;
    if (this.state.school) sub = this.state.school + ' · ' + sub;
    Dom.byId('greetSub').textContent = sub;
    // Once a minute, refresh Home so time-driven widgets (like "Classes Left
    // Today", which counts down as each class's end time passes) stay current
    // without requiring the user to navigate away and back.
    if (n.getSeconds() === 0 && Dom.byId('view-home')?.classList.contains('on')) {
      this.app.home.drawHome();
    }
  }

  /* Sheets & dialogs: Back closes them (and resets their forms) */
  closeSheetsNow() {
    [this.app.timetable.resetClassForm, this.app.events.resetEventForm, this.app.tasks.resetTaskForm, this.app.people.resetPersonForm, this.app.stories.resetStoryForm, this.app.passwords.resetPassForm].forEach(f => { try { f(); } catch {} });
    Dom.byId('backdrop')?.classList.remove('open');
    document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'));
  }
}
