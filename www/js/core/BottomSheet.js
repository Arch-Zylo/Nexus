import { Component } from './Component.js';
import { Dom } from './Dom.js';
import { Motion } from '../ui/Motion.js';

export class BottomSheet extends Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    super(app);
    this.mgSheetTimer = null;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('mgSheetBack')?.addEventListener('click', (e) => { if (e.target.id === 'mgSheetBack') this.close(); });
  }

  open(html) {
    const b = Dom.byId('mgSheetBack'), closing = b.classList.contains('closing'), was = !b.hidden && !closing;
    clearTimeout(this.mgSheetTimer); b.classList.remove('closing');
    Dom.byId('mgSheet').innerHTML = html; b.hidden = false; if (!was) this.app.overlays.open(this.hide);
  }

  hide() {
    const b = Dom.byId('mgSheetBack'); if (b.hidden || b.classList.contains('closing')) return;
    const done = () => { b.hidden = true; b.classList.remove('closing'); Dom.byId('mgSheet').innerHTML = ''; };
    if (Motion.reduced()) { done(); return; }
    b.classList.add('closing'); this.mgSheetTimer = setTimeout(done, 190);
  }

  close() { this.hide(); this.app.overlays.release(this.hide); }
}
