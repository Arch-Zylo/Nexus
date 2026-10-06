/* Nexus — motion + progress layer (loaded before nexus.js).
   1) window.NxProgress  — a determinate / indeterminate progress card used by every import.
   2) List animations    — new rows slide in, removed rows collapse out, with no changes to the draw functions.
   Everything respects "reduce motion". */
(function () {
  'use strict';
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------------ */
  /* 1. Progress card                                                    */
  /* ------------------------------------------------------------------ */
  let card, fill, labelEl, pctEl, subEl, hideT = null, raf = 0, shown = 0;
  let cur = { frac: 0, ind: true, label: '', sub: '' };

  function build() {
    if (card) return;
    card = document.createElement('div');
    card.className = 'nx-prog';
    card.setAttribute('role', 'progressbar');
    card.setAttribute('aria-valuemin', '0');
    card.setAttribute('aria-valuemax', '100');
    card.innerHTML =
      '<div class="nx-prog-head"><span class="nx-prog-label"></span><span class="nx-prog-pct"></span></div>' +
      '<div class="nx-prog-track"><div class="nx-prog-fill"></div></div>' +
      '<div class="nx-prog-sub" aria-live="polite"></div>';
    document.body.appendChild(card);
    fill = card.querySelector('.nx-prog-fill');
    labelEl = card.querySelector('.nx-prog-label');
    pctEl = card.querySelector('.nx-prog-pct');
    subEl = card.querySelector('.nx-prog-sub');
  }

  function paint() {
    raf = 0;
    if (!card) return;
    const pct = Math.round(cur.frac * 100);
    card.classList.toggle('ind', cur.ind);
    labelEl.textContent = cur.label;
    subEl.textContent = cur.sub;
    pctEl.textContent = cur.ind ? '' : pct + '%';
    fill.style.width = cur.ind ? '' : (cur.frac * 100).toFixed(1) + '%';
    if (cur.ind) card.removeAttribute('aria-valuenow'); else card.setAttribute('aria-valuenow', String(pct));
    card.setAttribute('aria-label', cur.label);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(paint); }

  function open(label) {
    build();
    clearTimeout(hideT);
    card.classList.remove('done', 'err');
    cur = { frac: 0, ind: true, label: label || 'Working…', sub: '' };
    paint();
    // force a frame so the slide-in transition runs from the hidden state
    void card.offsetWidth;
    card.classList.add('show');
    shown = Date.now();
  }

  const NxProgress = {
    /** Show the card in "working" (indeterminate) mode. */
    start(label, sub) { open(label); cur.sub = sub || ''; queue(); },
    /** Same as start, but keeps the card if it is already open. */
    busy(label, sub) {
      if (!card || !card.classList.contains('show')) { open(label); }
      cur.ind = true; if (label) cur.label = label; cur.sub = sub || '';
      queue();
    },
    /** frac is 0..1 (never goes backwards). label/sub optional. */
    update(frac, sub, label) {
      if (!card || !card.classList.contains('show')) open(label || 'Importing…');
      frac = Math.max(0, Math.min(1, +frac || 0));
      cur.ind = false;
      cur.frac = Math.max(cur.frac, frac);
      if (sub != null) cur.sub = sub;
      if (label) cur.label = label;
      queue();
    },
    /** Fill to 100% (or turn red on failure), then slide away. */
    finish(ok, sub) {
      if (!card || !card.classList.contains('show')) return;
      ok = ok !== false;
      cur.ind = false;
      if (ok) cur.frac = 1;
      if (sub != null) cur.sub = sub;
      else cur.sub = ok ? 'Done' : 'Stopped';
      card.classList.toggle('done', ok);
      card.classList.toggle('err', !ok);
      paint();
      clearTimeout(hideT);
      // keep it on screen long enough to be seen even for very fast imports
      const minShow = Math.max(0, 650 - (Date.now() - shown));
      hideT = setTimeout(() => { card.classList.remove('show'); }, minShow + (ok ? 450 : 1200));
    },
    /** Hide immediately (e.g. the user cancelled a confirm). */
    hide() { if (card) { clearTimeout(hideT); card.classList.remove('show'); } },
  };
  window.NxProgress = NxProgress;

  /* ------------------------------------------------------------------ */
  /* 2. List enter / exit animations                                     */
  /* ------------------------------------------------------------------ */
  const ITEM = '.row,.card,.chill-row,.pass-card,.loan-card,.event-card,.tx-row,.chill-tile,.cd-row,.cstrip-item';
  const prev = new WeakMap();   // container -> array of keys from its last render
  const stamp = new WeakMap();  // container -> time of last animated render (live-update guard)
  let busy = false, obs = null;

  function keyOf(n) {
    // first data-* attribute on the item (or inside it) is its identity; fall back to its text
    const scan = (e) => { for (const a of e.attributes) if (a.name.indexOf('data-') === 0) return a.name + '=' + a.value; return ''; };
    let k = scan(n);
    if (!k) { for (const e of n.querySelectorAll('*')) { k = scan(e); if (k) break; } }
    return k || 't:' + (n.textContent || '').trim().slice(0, 160);
  }
  const itemsOf = (c) => Array.from(c.children).filter(ch => ch.matches && ch.matches(ITEM));

  function handle(records) {
    if (busy || reduce()) return;
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
    busy = true;
    try {
      targets.forEach((c) => {
        if (!c.isConnected) return;
        const now = Date.now(), last = stamp.get(c) || 0;
        const cur = itemsOf(c), curKeys = cur.map(keyOf), before = prev.get(c);
        prev.set(c, curKeys);
        if (now - last < 450) { stamp.set(c, now); return; }       // rapid redraw = live update, don't animate
        stamp.set(c, now);
        const old = before || [];
        // entrances: everything on first render, otherwise only items that weren't there before
        let step = 0;
        cur.forEach((n, i) => {
          if (before && old.indexOf(curKeys[i]) !== -1) return;
          if (!c.offsetParent && c !== document.body) return;       // not visible (hidden view)
          n.classList.add('fx-in');
          n.style.animationDelay = Math.min(step++, 8) * 35 + 'ms';
          n.addEventListener('animationend', () => { n.classList.remove('fx-in'); n.style.animationDelay = ''; }, { once: true });
        });
        // exits: items that were rendered before and are gone now (needs the removed DOM nodes to clone)
        const gone = removedBy.get(c) || [];
        if (before && gone.length && c.offsetParent) {
          const ghosts = [];
          gone.forEach((n) => {
            const k = keyOf(n);
            if (curKeys.indexOf(k) !== -1) return;
            const idx = old.indexOf(k); if (idx === -1) return;
            ghosts.push({ n, idx });
          });
          if (ghosts.length && ghosts.length <= 3) {
            ghosts.sort((a, b) => a.idx - b.idx);
            ghosts.forEach(({ n, idx }) => {
              const g = n.cloneNode(true);
              g.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
              g.removeAttribute('id');
              g.setAttribute('aria-hidden', 'true');
              g.classList.remove('fx-in');
              g.style.pointerEvents = 'none';
              const ref = itemsOf(c)[idx] || null;
              if (ref) c.insertBefore(g, ref); else if (cur.length) cur[cur.length - 1].after(g); else c.appendChild(g);
              g.style.setProperty('--fx-h', g.offsetHeight + 'px');
              g.classList.add('fx-out');
              const kill = () => g.remove();
              g.addEventListener('animationend', kill, { once: true });
              setTimeout(kill, 600);
            });
          }
        }
      });
    } finally {
      busy = false;
      if (obs) obs.takeRecords();                                    // ignore our own ghost inserts
    }
  }

  function startObserver() {
    if (!window.MutationObserver || !document.body) return;
    obs = new MutationObserver(handle);
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);

  /* ------------------------------------------------------------------ */
  /* 3. Small helpers used by nexus.js                                    */
  /* ------------------------------------------------------------------ */
  /** Briefly add a class (for theme / mode cross-fades). */
  window.nxFlash = function (cls, ms) {
    if (reduce()) return;
    const h = document.documentElement;
    h.classList.add(cls);
    clearTimeout(h['_t_' + cls]);
    h['_t_' + cls] = setTimeout(() => h.classList.remove(cls), ms || 500);
  };
  window.nxReduceMotion = reduce;
})();
