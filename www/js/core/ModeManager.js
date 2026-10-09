import { Component } from './Component.js';
import { Motion } from '../ui/Motion.js';
import { Dom } from './Dom.js';

export class ModeManager extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    this.applyMode('regular'); // always launch into Regular mode (Chill is entered on purpose)
    Dom.byId('modeBack')?.addEventListener('click', this.hideModePanel);
    document.querySelectorAll('[data-mode-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setAppMode(btn.dataset.modePick);
        this.hideModePanel();
      });
    });
    Dom.byId('themeBtnChill')?.addEventListener('click', this.app.theme.nextTheme);
    document.querySelectorAll('[data-mode-toggle]').forEach(b => b.addEventListener('click', () => this.setAppMode(this.state.mode === 'chill' ? 'regular' : 'chill')));
  }

  applyMode(mode) {
    mode = mode === 'chill' ? 'chill' : 'regular';
    if (this.state.mode !== mode && Motion.flash) Motion.flash('nx-mode-fx', 600);
    this.state.mode = mode;
    this.app.store.save();
    document.documentElement.setAttribute('data-mode', mode === 'chill' ? 'chill' : '');
    const mv = Dom.byId('modeValue');
    if (mv) mv.textContent = mode === 'chill' ? 'Chill' : 'Regular';
  }

  setAppMode(mode) {
    this.applyMode(mode);
    const targetGo = mode === 'chill' ? 'chome' : 'home';
    const btn = document.querySelector(`.rail-btn[data-go="${targetGo}"]`);
    if (btn) btn.click();
  }

  showModePanel() {
    const main = Dom.byId('settingsMain');
    const panel = Dom.byId('modePanel');
    if (main) main.style.display = 'none';
    if (panel) { panel.removeAttribute('hidden'); panel.style.display = 'block'; }
  }

  hideModePanel() {
    const main = Dom.byId('settingsMain');
    const panel = Dom.byId('modePanel');
    if (panel) { panel.setAttribute('hidden',''); panel.style.display = 'none'; }
    if (main) main.style.display = '';
  }
}
