/**
 * Progress card shown at the top of the screen during imports and restores.
 * Determinate (`update`) or indeterminate (`start` / `busy`); `finish` fills the bar,
 * turns it green (or red on failure) and slides it away.
 */
export class ProgressCard {
  constructor() {
    this.card = null; this.fill = null; this.labelEl = null; this.pctEl = null; this.subEl = null;
    this.hideTimer = null; this.raf = 0; this.shownAt = 0;
    this.cur = { frac: 0, ind: true, label: '', sub: '' };
  }

  get isOpen() { return !!this.card && this.card.classList.contains('show'); }

  build() {
    if (this.card) return;
    const c = this.card = document.createElement('div');
    c.className = 'nx-prog';
    c.setAttribute('role', 'progressbar');
    c.setAttribute('aria-valuemin', '0');
    c.setAttribute('aria-valuemax', '100');
    c.innerHTML =
      '<div class="nx-prog-head"><span class="nx-prog-label"></span><span class="nx-prog-pct"></span></div>' +
      '<div class="nx-prog-track"><div class="nx-prog-fill"></div></div>' +
      '<div class="nx-prog-sub" aria-live="polite"></div>';
    document.body.appendChild(c);
    this.fill = c.querySelector('.nx-prog-fill');
    this.labelEl = c.querySelector('.nx-prog-label');
    this.pctEl = c.querySelector('.nx-prog-pct');
    this.subEl = c.querySelector('.nx-prog-sub');
  }

  paint() {
    this.raf = 0;
    if (!this.card) return;
    const cur = this.cur, pct = Math.round(cur.frac * 100);
    this.card.classList.toggle('ind', cur.ind);
    this.labelEl.textContent = cur.label;
    this.subEl.textContent = cur.sub;
    this.pctEl.textContent = cur.ind ? '' : pct + '%';
    this.fill.style.width = cur.ind ? '' : (cur.frac * 100).toFixed(1) + '%';
    if (cur.ind) this.card.removeAttribute('aria-valuenow'); else this.card.setAttribute('aria-valuenow', String(pct));
    this.card.setAttribute('aria-label', cur.label);
  }

  queue() { if (!this.raf) this.raf = requestAnimationFrame(() => this.paint()); }

  open(label) {
    this.build();
    clearTimeout(this.hideTimer);
    this.card.classList.remove('done', 'err');
    this.cur = { frac: 0, ind: true, label: label || 'Working…', sub: '' };
    this.paint();
    void this.card.offsetWidth;            // force a frame so the slide-in transition runs
    this.card.classList.add('show');
    this.shownAt = Date.now();
  }

  /** Show the card in "working" (indeterminate) mode. */
  start(label, sub) { this.open(label); this.cur.sub = sub || ''; this.queue(); }

  /** Like start, but keeps the card if it is already open. */
  busy(label, sub) {
    if (!this.isOpen) this.open(label);
    this.cur.ind = true; if (label) this.cur.label = label; this.cur.sub = sub || '';
    this.queue();
  }

  /** frac is 0..1 and never goes backwards. */
  update(frac, sub, label) {
    if (!this.isOpen) this.open(label || 'Importing…');
    frac = Math.max(0, Math.min(1, +frac || 0));
    this.cur.ind = false;
    this.cur.frac = Math.max(this.cur.frac, frac);
    if (sub != null) this.cur.sub = sub;
    if (label) this.cur.label = label;
    this.queue();
  }

  /** Fill to 100% (or turn red on failure), then slide away. */
  finish(ok, sub) {
    if (!this.isOpen) return;
    ok = ok !== false;
    this.cur.ind = false;
    if (ok) this.cur.frac = 1;
    this.cur.sub = sub != null ? sub : (ok ? 'Done' : 'Stopped');
    this.card.classList.toggle('done', ok);
    this.card.classList.toggle('err', !ok);
    this.paint();
    clearTimeout(this.hideTimer);
    const minShow = Math.max(0, 650 - (Date.now() - this.shownAt));   // long enough to be seen even for fast imports
    this.hideTimer = setTimeout(() => this.card.classList.remove('show'), minShow + (ok ? 450 : 1200));
  }

  /** Hide immediately (e.g. the user cancelled a confirm). */
  hide() { if (this.card) { clearTimeout(this.hideTimer); this.card.classList.remove('show'); } }
}
