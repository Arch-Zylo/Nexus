import { Component } from '../../core/Component.js';
import { APP_VERSION_LABEL, BACKUP_KEY, CURRENCIES, STYLES, THEMES } from '../../core/constants.js';
import { Dom } from '../../core/Dom.js';

export class SettingsView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    /* Settings — event delegation so clicks always work */
    const onRowClick = (e) => {
      const el = e.target.closest('[data-set]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const action = el.dataset.set;
      if (action === 'theme') { this.app.theme.nextTheme(); this.refreshSettingsUI(); }
      else if (action === 'style') { this.app.theme.nextStyle(); this.refreshSettingsUI(); }
      else if (action === 'currency') {
        const i = CURRENCIES.indexOf(this.state.currency || '$');
        this.state.currency = CURRENCIES[(i + 1) % CURRENCIES.length];
        this.app.store.save(); this.refreshSettingsUI(); this.app.wallet.drawWallet(); this.app.home.drawHome();
      }
      else if (action === 'timefmt') {
        this.state.timefmt = this.state.timefmt === '24' ? '12' : '24';
        this.app.store.save(); this.refreshSettingsUI(); this.app.shell.tick();
      }
      else if (action === 'spendperiod') {
        const modes = ['all', 'week', 'month', 'year'];
        this.state.spendPeriod = modes[(modes.indexOf(this.state.spendPeriod || 'all') + 1) % modes.length];
        this.app.store.save(); this.refreshSettingsUI(); this.app.home.drawHome();
      }
      else if (action === 'spendresetnow') {
        if (!confirm('Reset the spending chart now?\n\nYour transactions are kept — the chart just starts fresh from today.')) return;
        this.state.spendResetTs = Date.now(); this.app.store.save(); this.app.home.drawHome();
        this.app.toast.show('Spending chart reset.');
      }
      else if (action === 'spendcats') this.app.spending.showCategoryManager();
      else if (action === 'notify') this.app.notifications.toggleNotify();
      else if (action === 'classnotify') this.app.notifications.toggleClassNotify();
      else if (action === 'classnotifylead') this.app.notifications.cycleClassNotifyLead();
      else if (action === 'passwords') this.app.shell.navigate('passwords');
      else if (action === 'greet') this.app.greetPanel.show();
      else if (action === 'applock') this.app.lock.toggle();
      else if (action === 'lockchange') this.app.lock.changePin();
      else if (action === 'lockdelay') this.app.lock.cycleDelay();
      else if (action === 'locknow') this.app.lock.lockNow();
      else if (action === 'mode') {
        // Same behaviour as the Theme row: one tap flips it and you stay on this page
        this.app.mode.applyMode(this.state.mode === 'chill' ? 'regular' : 'chill');
        this.refreshSettingsUI();
      }
      else if (action === 'export') this.app.backup.doExport();
      else if (action === 'import') {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup && confirm('Restore from your local backup? (Cancel to pick a file instead)')) {
          const msg = Dom.byId('dataMsg');
          try {
            const ns = this.app.store.normalizeStore(JSON.parse(backup));
            if (!ns) throw new Error('invalid');
            this.state = ns;
            this.app.store.save();
            this.app.theme.applyTheme(this.state.theme || 'night');
            this.app.boot();
            if (msg) { msg.textContent = 'Restored from local backup.'; msg.style.color = 'var(--mint)'; }
          } catch {
            if (msg) { msg.textContent = 'Local backup is corrupted.'; msg.style.color = 'var(--coral)'; }
          }
        } else {
          Dom.byId('importFile')?.click();
        }
      }
      else if (action === 'clearlog') {
        if (!confirm('Clear the activity log on Home?')) return;
        this.state.log = [];
        this.app.store.save();
        this.app.home.drawHome();
        const msg = Dom.byId('dataMsg');
        if (msg) { msg.textContent = 'Activity log cleared.'; msg.style.color = 'var(--mint)'; }
      }
      else if (action === 'wipe') this.app.backup.wipeAllData();
      else if (action === 'terms') this.app.terms.showTos(true);
    };
    ['view-settings', 'aboutPanel'].forEach(id => Dom.byId(id)?.addEventListener('click', onRowClick));
  }

  refreshSettingsUI() {
    const set = (id, val) => { const el = Dom.byId(id); if (el) el.textContent = val; };
    set('themeValue', THEMES.find(x => x.id === (this.state.theme || 'night'))?.label || 'Night');
    set('styleValue', STYLES.find(x => x.id === (this.state.style || 'soft'))?.label || 'Soft');
    set('nameValue', this.state.name || 'Not set');
    set('menuThemeValue', THEMES.find(x => x.id === (this.state.theme || 'night'))?.label || 'Night');
    const initial = ((this.state.name || 'N').trim()[0] || 'N').toUpperCase();
    set('drawerName', this.state.name || 'Student');
    set('drawerSchool', this.state.school || 'Set your name & school');
    set('drawerAvatar', initial);
    set('menuModeValue', this.state.mode === 'chill' ? 'Chill' : 'Regular');
    ['menuVersion', 'aboutVersion', 'appVersionValue'].forEach(id => set(id, APP_VERSION_LABEL));
    const lk = this.app.lock;
    set('appLockValue', lk && lk.enabled ? 'On' : 'Off');
    set('lockDelayValue', lk && lk.enabled ? lk.delayInfo().label : '');
    const ex = Dom.byId('lockExtras'); if (ex) ex.hidden = !(lk && lk.enabled);
    set('schoolValue', this.state.school || 'Not set');
    set('currencyValue', this.state.currency || '$');
    set('timefmtValue', this.state.timefmt === '24' ? '24-hour' : '12-hour');
    set('spendPeriodValue', { all: 'Never', week: 'Every week', month: 'Every month', year: 'Every year' }[this.state.spendPeriod || 'all']);
    set('spendCatsValue', String(this.app.spending.spendCats().length));
    set('greetValue', this.state.greet === false ? 'Off' : 'On');
    set('greetOnValue', this.state.greet === false ? 'Off' : 'On');
    set('notifyValue', this.state.notify ? 'On' : 'Off');
    set('classNotifyValue', this.state.classNotify ? 'On' : 'Off');
    set('classNotifyLeadValue', (Number(this.state.classNotifyLead) || 10) + ' min before');
    try {
      const bytes = new Blob([JSON.stringify(this.state)]).size;
      const fmt = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB';
      set('storageValue', 'App data ' + fmt(bytes));
      navigator.storage?.estimate?.().then(e => { if (e && e.usage) set('storageValue', 'App data ' + fmt(bytes) + ' · Total ' + fmt(e.usage)); }).catch(() => {});
    } catch { set('storageValue', '—'); }
  }
}
