import { Component } from './Component.js';
import { Dom } from './Dom.js';

export class Toast extends Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    super(app);
    this.toastTimer = null;
  }

  show(msg, kind, ms) {
    let t = Dom.byId('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = String(msg); t.className = 'show ' + (kind || '');
    clearTimeout(this.toastTimer);
    if (ms !== 0) this.toastTimer = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }
}
