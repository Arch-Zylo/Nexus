import { Component } from './Component.js';
import { STYLES, THEMES } from './constants.js';
import { Motion } from '../ui/Motion.js';
import { Dom } from './Dom.js';

export class ThemeManager extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('themeBtn')?.addEventListener('click', this.nextTheme);
    this.applyTheme(this.state.theme || 'night');
    this.applyStyle(this.state.style || 'soft');
  }

  applyTheme(t) {
    if (t === 'day' || !THEMES.find(x => x.id === t)) t = 'night';
    if (this.state.theme !== t && Motion.flash) Motion.flash('nx-theme-fx', 500);
    this.state.theme = t;
    document.documentElement.setAttribute('data-theme', t === 'night' ? '' : t);
    if (window.CircuitBG) { if (t === 'circuit') window.CircuitBG.start(); else window.CircuitBG.stop(); }
    if (window.StarryBG) { if (t === 'starry') window.StarryBG.start(); else window.StarryBG.stop(); }
    if (window.DragonBG) { if (t === 'dragon') window.DragonBG.start(); else window.DragonBG.stop(); }
    const tv = Dom.byId('themeValue');
    if (tv) tv.textContent = THEMES.find(x => x.id === t)?.label || 'Night';
    this.app.store.save();
  }

  nextTheme() {
    const i = THEMES.findIndex(x => x.id === (this.state.theme || 'night'));
    this.applyTheme(THEMES[(i + 1) % THEMES.length].id);
  }

  applyStyle(s) {
    if (!STYLES.find(x => x.id === s)) s = 'soft';
    this.state.style = s;
    document.documentElement.setAttribute('data-style', s);
    const sv = Dom.byId('styleValue');
    if (sv) sv.textContent = STYLES.find(x => x.id === s)?.label || 'Soft';
    this.app.store.save();
  }

  nextStyle() {
    const i = STYLES.findIndex(x => x.id === (this.state.style || 'soft'));
    this.applyStyle(STYLES[(i + 1) % STYLES.length].id);
  }
}
