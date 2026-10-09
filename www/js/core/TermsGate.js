import { Component } from './Component.js';
import { TOS_KEY } from './constants.js';
import { Dom } from './Dom.js';

export class TermsGate extends Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    super(app);
    this.tosReview = false;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('tosAgree')?.addEventListener('change', (e) => {
      const btn = Dom.byId('tosAccept');
      if (btn) btn.disabled = !e.target.checked;
    });
    Dom.byId('tosAccept')?.addEventListener('click', () => {
      if (!this.tosAccepted()) {
        const agree = Dom.byId('tosAgree');
        if (!agree?.checked) return;
        localStorage.setItem(TOS_KEY, '1');
      }
      if (this.tosReview) { this.tosReview = false; this.app.overlays.close(this.hideTos); } else this.hideTos();
    });
  }

  tosAccepted() { return localStorage.getItem(TOS_KEY) === '1'; }

  showTos(review) {
    const gate = Dom.byId('tosGate');
    const agree = Dom.byId('tosAgree');
    const btn = Dom.byId('tosAccept');
    if (!gate) return;
    gate.hidden = false;
    this.tosReview = !!review;
    if (review) this.app.overlays.open(this.hideTos);
    if (review) {
      if (agree) { agree.checked = true; agree.disabled = true; }
      if (btn) { btn.disabled = false; btn.textContent = 'Close'; }
    } else {
      if (agree) { agree.checked = false; agree.disabled = false; }
      if (btn) { btn.disabled = true; btn.textContent = 'Continue'; }
    }
  }

  hideTos() {
    const gate = Dom.byId('tosGate');
    if (gate) gate.hidden = true;
  }

  /* First-run terms gate — previously shown after the splash faded out */
  maybeShowTos() {
    if (!this.tosAccepted()) this.showTos(false);
  }
}
