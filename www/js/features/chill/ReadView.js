import { Component } from '../../core/Component.js';
import { Util } from '../../core/Util.js';
import { MangaModel } from './manga/MangaModel.js';
import { Dom } from '../../core/Dom.js';

export class ReadView extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.readMode = 'manga';
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    document.querySelectorAll('#view-read [data-read-tab]').forEach(b => {
      b.addEventListener('click', () => this.setReadMode(b.dataset.readTab));
    });
  }

  setReadMode(mode) {
    this.readMode = mode === 'stories' ? 'stories' : 'manga';
    document.querySelectorAll('#view-read [data-read-tab]').forEach(b => b.classList.toggle('on', b.dataset.readTab === this.readMode));
    Dom.byId('mangaMode').hidden = this.readMode !== 'manga';
    Dom.byId('storiesMode').hidden = this.readMode !== 'stories';
    Dom.byId('btnAddStory').hidden = this.readMode !== 'stories';
    if (this.readMode === 'manga') this.drawManga(); else this.app.stories.drawStories();
  }

  drawManga() {
    const el = Dom.byId('mangaGrid');
    if (!el) return;
    const items = this.state.chillMedia.filter(m => m.type === 'manga').sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
    el.innerHTML = items.length ? items.map(m => {
      const pr = (this.state.chillProgress || {})[m.id], ch = pr && MangaModel.mangaChapters(m)[pr.ci];
      return `<div class="chill-tile mt" data-manga="${m.id}">
      <div class="thumb tall" data-thumb="${m.id}" style="${Util.artStyle(m.title)}"><span>📖</span></div>
      <div class="chill-tile-title">${Util.esc(m.title)}</div>
      <div class="chill-tile-sub">${ch ? 'Continue · ' + Util.esc(ch.name) : MangaModel.mangaSub(m)}</div>
    </div>`; }).join('') : '<div class="empty">No manga imported yet — go to Import</div>';
    el.querySelectorAll('[data-manga]').forEach(tile => tile.addEventListener('click', () => this.app.reader.openManga(tile.dataset.manga)));
    this.app.thumbs.hydrateThumbs(el);
  }
}
