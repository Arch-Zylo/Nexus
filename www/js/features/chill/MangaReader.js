import { Component } from '../../core/Component.js';
import { MODE_LABEL } from '../../core/constants.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';
import { MangaModel } from './manga/MangaModel.js';
import { Motion } from '../../ui/Motion.js';

export class MangaReader extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.rd = null;
    this.rdSave = null;
    this.rdCloseT = null;
    this.rdChT = null;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('mgStage')?.addEventListener('scroll', () => {
      if (!this.rd || this.rd.mode !== 'vertical') return;
      const st = Dom.byId('mgStage'), ws = [...st.querySelectorAll('.mg-pg')];
      const i = ws.findIndex(w => w.offsetTop + w.offsetHeight > st.scrollTop + st.clientHeight * 0.4);
      if (i >= 0 && i !== this.rd.page) { this.rd.page = i; this.updatePg(); this.saveProg(); }
    });
    Dom.byId('mgStage')?.addEventListener('click', (e) => {
      if (!this.rd) return;
      const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (this.rd.mode !== 'vertical' && (x < 0.3 || x > 0.7)) { const fwd = x > 0.7; this.pageStep((this.rd.mode === 'rtl' ? !fwd : fwd) ? 1 : -1); return; }
      Dom.byId('mgReader').classList.toggle('off');
    });
    Dom.byId('mgClose')?.addEventListener('click', () => this.app.overlays.close(this.closeReader));
    Dom.byId('mgPrevCh')?.addEventListener('click', () => this.goCh(-1));
    Dom.byId('mgNextCh')?.addEventListener('click', () => this.goCh(1));
    Dom.byId('mgMode')?.addEventListener('click', () => {
      const nx = { vertical: 'ltr', ltr: 'rtl', rtl: 'vertical' }[this.rdMode()];
      localStorage.setItem('nexus_mg_mode', nx); Dom.byId('mgMode').textContent = MODE_LABEL[nx];
      if (this.rd) this.loadChapter(this.rd.ci, this.rd.page);
    });
    Dom.byId('mgChBtn')?.addEventListener('click', () => {
      const box = Dom.byId('mgChapters'); if (!this.rd) return;
      box.innerHTML = '<div class="mg-ch-head">Chapters <button type="button" id="mgChX" class="btn-icon">✕</button></div>' + this.rd.chs.map((c, i) =>
        `<div class="chill-row${i === this.rd.ci ? ' playing' : ''}" data-ch="${i}"><div class="chill-row-main"><div class="chill-row-title">${Util.esc(c.name)}</div><div class="chill-row-sub">${(c.pages || []).length} pages</div></div></div>`).join('');
      clearTimeout(this.rdChT); box.classList.remove('closing'); box.hidden = false;
      const chHide = () => {
        if (box.hidden) return;
        if (!this.rdMotion()) { box.hidden = true; return; }
        box.classList.add('closing'); clearTimeout(this.rdChT); this.rdChT = setTimeout(() => { box.hidden = true; box.classList.remove('closing'); }, 190);
      };
      Dom.byId('mgChX').onclick = chHide;
      box.querySelectorAll('[data-ch]').forEach(r => r.onclick = () => { chHide(); this.loadChapter(Number(r.dataset.ch), 0); });
    });
  }

  rdMotion() { return !(Motion.reduced()); }

  rdSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  rdMode() { return localStorage.getItem('nexus_mg_mode') || 'vertical'; }

  rdRelease() {
    this.rd?.io?.disconnect();
    (this.rd?.urls || []).forEach(u => URL.revokeObjectURL(u));
    if (this.rd) this.rd.urls = [];
  }

  async openManga(mid) {
    const m = this.state.chillMedia.find(x => x.id === mid); if (!m) return;
    const chs = MangaModel.mangaChapters(m);
    if (!chs.length) { this.app.toast.show('No chapters yet — add one from Import.', 'info'); return; }
    const pr = (this.state.chillProgress || {})[mid];
    this.rd = { m, chs, ci: 0, page: 0, pages: [], urls: [], token: 0 };
    Dom.byId('mgTitle').textContent = m.title;
    clearTimeout(this.rdCloseT); clearTimeout(this.rdChT); Dom.byId('mgReader').classList.remove('closing'); Dom.byId('mgChapters').classList.remove('closing');
    Dom.byId('mgStage').replaceChildren(); Dom.byId('mgStage').classList.remove('swap-out', 'swap-in');   // no stale pages from the last series
    Dom.byId('mgReader').hidden = false; this.app.overlays.open(this.closeReader); Dom.byId('mgReader').classList.remove('off'); Dom.byId('mgChapters').hidden = true;
    Dom.byId('mgMode').textContent = MODE_LABEL[this.rdMode()];
    await this.loadChapter(pr ? Math.min(pr.ci, chs.length - 1) : 0, pr ? pr.page : 0);
  }

  async loadChapter(ci, start = 0) {
    const st0 = Dom.byId('mgStage');
    if (st0.childElementCount && this.rdMotion()) { st0.classList.add('swap-out'); await this.rdSleep(150); if (!this.rd) return; }   // old pages fade away first
    this.rdRelease();
    this.rd.ci = ci; this.rd.page = start; this.rd.token++; this.rd.pre = new Map();
    const ch = this.rd.chs[ci], tk = this.rd.token;
    this.rd.pages = [...(ch.pages || [])].sort((a, b) => a.order - b.order);
    this.rd.mode = this.rdMode();
    Dom.byId('mgChName').textContent = ch.name;
    const st = Dom.byId('mgStage'); st.innerHTML = ''; st.scrollTop = 0;
    st.className = 'mg-stage ' + (this.rd.mode === 'vertical' ? 'v' : 'p');
    if (this.rdMotion()) { st.classList.add('swap-in'); st.addEventListener('animationend', () => st.classList.remove('swap-in'), { once: true }); }
    if (this.rd.mode === 'vertical') this.buildVertical(tk, start); else await this.showPage(start);
    this.updatePg(); this.saveProg();
  }

  buildVertical(tk, start) {
    const st = Dom.byId('mgStage');
    const wraps = this.rd.pages.map((p, i) => { const w = document.createElement('div'); w.className = 'mg-pg'; w.dataset.i = i; st.appendChild(w); return w; });
    const end = document.createElement('div'); end.className = 'mg-end';
    end.innerHTML = this.rd.ci < this.rd.chs.length - 1 ? '<button type="button" class="btn btn-gold" id="mgEndNext">Next chapter ›</button>' : '<div>End of series</div>';
    st.appendChild(end);
    Dom.byId('mgEndNext')?.addEventListener('click', (e) => { e.stopPropagation(); this.goCh(1); });
    this.rd.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) this.loadWrap(e.target, tk); }), { root: st, rootMargin: '1500px 0px' });
    wraps.forEach(w => this.rd.io.observe(w));
    if (start && wraps[start]) (async () => {
      await this.loadWrap(wraps[start], tk);
      try { await wraps[start].querySelector('img')?.decode(); } catch {}
      if (this.rd && tk === this.rd.token) wraps[start].scrollIntoView({ block: 'start' });
    })();
  }

  loadWrap(w, tk) {
    if (w._p) return w._p;
    w._p = (async () => {
      w.dataset.l = 1;
      const pg = this.rd && this.rd.pages[w.dataset.i];
      if (!pg || tk !== this.rd.token) return;
      const blob = await this.app.mediaDb.getBlob(pg.id).catch(() => null);
      if (!this.rd || tk !== this.rd.token) return;
      if (!blob) { w.classList.add('ok'); w.innerHTML = '<div class="mg-miss">Page unavailable</div>'; return; }
      const u = URL.createObjectURL(blob); this.rd.urls.push(u);
      const img = new Image(); img.src = u; img.onload = img.onerror = () => w.classList.add('ok'); w.appendChild(img);
    })();
    return w._p;
  }

  async showPage(i, dir = 0) {   // dir: +1 forward / -1 back / 0 = first show (fades in)
    if (!this.rd.pages.length) return;
    i = Math.max(0, Math.min(this.rd.pages.length - 1, i)); this.rd.page = i;
    const tk = this.rd.token, sq = this.rd.seq = (this.rd.seq || 0) + 1;
    let blob = this.rd.pre && this.rd.pre.get(i);
    if (!blob) blob = await this.app.mediaDb.getBlob(this.rd.pages[i].id).catch(() => null);
    if (!this.rd || tk !== this.rd.token || sq !== this.rd.seq || !blob) return;
    const url = URL.createObjectURL(blob), img = new Image();
    img.className = 'mg-one'; img.src = url;
    try { await img.decode(); } catch {}                       // wait until it can paint, so the slide-in never flashes
    if (!this.rd || tk !== this.rd.token || sq !== this.rd.seq) { URL.revokeObjectURL(url); return; }   // a newer tap won
    if (this.rd.cur) { URL.revokeObjectURL(this.rd.cur); this.rd.urls = this.rd.urls.filter(x => x !== this.rd.cur); }
    this.rd.cur = url; this.rd.urls.push(url);
    if (this.rdMotion()) {
      // the new page enters from the side you are reading towards (reversed for right-to-left)
      img.classList.add(!dir ? 'in-f' : ((dir > 0) !== (this.rd.mode === 'rtl') ? 'in-r' : 'in-l'));
      img.addEventListener('animationend', () => img.classList.remove('in-f', 'in-r', 'in-l'), { once: true });
    }
    Dom.byId('mgStage').replaceChildren(img);
    this.updatePg(); this.saveProg(); this.rdPrefetch(i);
  }

  rdPrefetch(i) {                                     // keep the neighbouring pages ready so turns feel instant
    const pre = this.rd.pre || (this.rd.pre = new Map()), tk = this.rd.token;
    for (const k of [...pre.keys()]) if (Math.abs(k - i) > 1) pre.delete(k);
    [i + 1, i - 1].forEach(k => {
      if (k < 0 || k >= this.rd.pages.length || pre.has(k)) return;
      this.app.mediaDb.getBlob(this.rd.pages[k].id).then(b => { if (b && this.rd && tk === this.rd.token) pre.set(k, b); }).catch(() => {});
    });
  }

  updatePg() {
    const el = Dom.byId('mgPg'), t = this.rd.pages.length ? `${this.rd.page + 1} / ${this.rd.pages.length}` : '0 / 0';
    if (el.textContent !== t) { el.textContent = t; if (this.rdMotion()) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
    const pr = Dom.byId('mgProg'), fill = Dom.byId('mgProgFill');
    if (pr && fill) { pr.classList.toggle('rtl', this.rd.mode === 'rtl'); fill.style.transform = `scaleX(${this.rd.pages.length ? (this.rd.page + 1) / this.rd.pages.length : 0})`; }
  }

  saveProg() {
    clearTimeout(this.rdSave);
    this.rdSave = setTimeout(() => { if (!this.rd) return; (this.state.chillProgress ||= {})[this.rd.m.id] = { ci: this.rd.ci, page: this.rd.page, t: Date.now() }; this.app.store.save(); }, 400);
  }

  async goCh(d, toLast) {
    const n = this.rd.ci + d; if (n < 0 || n >= this.rd.chs.length) return;
    await this.loadChapter(n, toLast ? Math.max(0, (this.rd.chs[n].pages || []).length - 1) : 0);
  }

  pageStep(d) { // d: +1 forward / -1 back
    const n = this.rd.page + d;
    if (n >= this.rd.pages.length) this.goCh(1); else if (n < 0) this.goCh(-1, true); else this.showPage(n, d);
  }

  closeReader() { this.saveProg(); clearTimeout(this.rdSave); if (this.rd) { (this.state.chillProgress ||= {})[this.rd.m.id] = { ci: this.rd.ci, page: this.rd.page, t: Date.now() }; this.app.store.save(); } this.rdRelease(); this.rd = null;
    const r = Dom.byId('mgReader');
    if (!this.rdMotion()) r.hidden = true;
    else { r.classList.add('closing'); clearTimeout(this.rdCloseT); this.rdCloseT = setTimeout(() => { r.hidden = true; r.classList.remove('closing'); }, 210); }
    this.app.read.drawManga(); }
}
