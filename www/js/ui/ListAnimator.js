import { Motion } from './Motion.js';

/**
 * Animates list changes without touching the code that draws the lists:
 * rows that appear glide in (staggered), rows that disappear collapse out.
 * Works by watching the DOM for rows (see ITEM) being added to / removed from a container.
 * Rapid redraws of the same container (live updates) are intentionally not animated.
 */
const ITEM = '.row,.card,.chill-row,.pass-card,.loan-card,.event-card,.tx-row,.chill-tile,.cd-row,.cstrip-item';

export class ListAnimator {
  constructor() {
    this.prev = new WeakMap();    // container -> keys of the rows from its last render
    this.stamp = new WeakMap();   // container -> time of its last animated render
    this.busy = false;
    this.observer = null;
  }

  start() {
    if (!window.MutationObserver || !document.body) return;
    this.observer = new MutationObserver((records) => this.handle(records));
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /** Identity of a row: its first data-* attribute (on it or inside it), else its text. */
  keyOf(n) {
    const scan = (e) => { for (const a of e.attributes) if (a.name.indexOf('data-') === 0) return a.name + '=' + a.value; return ''; };
    let k = scan(n);
    if (!k) { for (const e of n.querySelectorAll('*')) { k = scan(e); if (k) break; } }
    return k || 't:' + (n.textContent || '').trim().slice(0, 160);
  }

  itemsOf(c) { return Array.from(c.children).filter(ch => ch.matches && ch.matches(ITEM)); }

  handle(records) {
    if (this.busy || Motion.reduced()) return;
    const targets = new Set(), removedBy = new Map();
    for (const r of records) {
      if (r.type !== 'childList') continue;
      let touched = false;
      for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches && n.matches(ITEM)) touched = true;
      for (const n of r.removedNodes) if (n.nodeType === 1 && n.matches && n.matches(ITEM)) {
        touched = true;
        if (!removedBy.has(r.target)) removedBy.set(r.target, []);
        removedBy.get(r.target).push(n);
      }
      if (touched && r.target.nodeType === 1 && !r.target.closest('[data-nofx]')) targets.add(r.target);
    }
    if (!targets.size) return;
    this.busy = true;
    try {
      targets.forEach((c) => this.animateContainer(c, removedBy.get(c) || []));
    } finally {
      this.busy = false;
      if (this.observer) this.observer.takeRecords();     // ignore our own ghost inserts
    }
  }

  animateContainer(c, gone) {
    if (!c.isConnected) return;
    const now = Date.now(), last = this.stamp.get(c) || 0;
    const cur = this.itemsOf(c), curKeys = cur.map(n => this.keyOf(n)), before = this.prev.get(c);
    this.prev.set(c, curKeys);
    this.stamp.set(c, now);
    if (now - last < 450) return;                          // rapid redraw = live update, don't animate
    const old = before || [];
    // entrances: everything on first render, otherwise only rows that weren't there before
    let step = 0;
    cur.forEach((n, i) => {
      if (before && old.indexOf(curKeys[i]) !== -1) return;
      if (!c.offsetParent && c !== document.body) return;  // not visible (hidden view)
      n.classList.add('fx-in');
      n.style.animationDelay = Math.min(step++, 8) * 35 + 'ms';
      n.addEventListener('animationend', () => { n.classList.remove('fx-in'); n.style.animationDelay = ''; }, { once: true });
    });
    // exits: rows that were rendered before and are gone now (clone the removed node as a collapsing ghost)
    if (!before || !gone.length || !c.offsetParent) return;
    const ghosts = [];
    gone.forEach((n) => {
      const k = this.keyOf(n);
      if (curKeys.indexOf(k) !== -1) return;
      const idx = old.indexOf(k); if (idx === -1) return;
      ghosts.push({ n, idx });
    });
    if (!ghosts.length || ghosts.length > 3) return;
    ghosts.sort((a, b) => a.idx - b.idx);
    ghosts.forEach(({ n, idx }) => {
      const g = n.cloneNode(true);
      g.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      g.removeAttribute('id');
      g.setAttribute('aria-hidden', 'true');
      g.classList.remove('fx-in');
      g.style.pointerEvents = 'none';
      const ref = this.itemsOf(c)[idx] || null;
      if (ref) c.insertBefore(g, ref); else if (cur.length) cur[cur.length - 1].after(g); else c.appendChild(g);
      g.style.setProperty('--fx-h', g.offsetHeight + 'px');
      g.classList.add('fx-out');
      const kill = () => g.remove();
      g.addEventListener('animationend', kill, { once: true });
      setTimeout(kill, 600);
    });
  }
}
