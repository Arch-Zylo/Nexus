import { Component } from './Component.js';
import { Dom } from './Dom.js';

export class Dialog extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('dlgClose').onclick = this.closeDialog;
    Dom.byId('backdrop').onclick = e => { if (e.target.id === 'backdrop') this.closeDialog(); };
  }

  closeDialog() {
    Dom.byId('backdrop').classList.remove('open');
    const dlg = document.querySelector('.dialog');
    if (dlg) dlg.classList.remove('dialog-wide');
    this.app.importer.revokeChillUrls();
  }
}
