import { Component } from '../../../core/Component.js';
import { ARC_ACCEPT, COLORS } from '../../../core/constants.js';
import { Dom } from '../../../core/Dom.js';
import { Util } from '../../../core/Util.js';
import { MangaModel } from './MangaModel.js';

export class SeriesView extends Component {
  /** @param {import('../../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.mgSeriesId = null;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('mgPlus')?.addEventListener('click', () => {
      const has = this.state.chillMedia.some(m => m.type === 'manga');
      this.app.sheet.open(`<div class="mg-sh-title">Add manga</div>
    <button type="button" class="mg-opt" id="mgoSeries"><b>📚 New series</b><small>Create a series, then add its chapters</small></button>
    <button type="button" class="mg-opt" id="mgoChapter" ${has ? '' : 'disabled'}><b>📖 New chapter</b><small>${has ? 'Add a chapter to an existing series' : 'Create a series first'}</small></button>
    <button type="button" class="btn btn-ghost" id="mgoCancel">Cancel</button>`);
      Dom.byId('mgoSeries').onclick = this.mgNewSeries; Dom.byId('mgoChapter').onclick = this.mgPickSeries; Dom.byId('mgoCancel').onclick = this.app.sheet.close;
    });
    Dom.byId('mgSeriesBack')?.addEventListener('click', () => this.app.overlays.close(this.closeSeries));
    Dom.byId('mgAddCh')?.addEventListener('click', () => { if (this.mgSeriesId) this.mgChapterSheet(this.mgSeriesId); });
    Dom.byId('mgSeriesDel')?.addEventListener('click', () => { const m = this.mgSeriesId && this.find(this.mgSeriesId); if (m) this.mgDeleteSeries(m); });
  }

  find(mid) { return this.state.chillMedia.find(x => x.id === mid && x.type === 'manga'); }

  mgNewSeries() {
    this.app.sheet.open(`<div class="mg-sh-title">New series</div>
    <input id="mgSeriesName" class="mg-input" placeholder="Series title" autocomplete="off">
    <button type="button" class="btn btn-gold" id="mgCreate">Create series</button>
    <label class="btn btn-ghost mg-lab">Import a whole folder instead<input type="file" id="mgPickAuto" webkitdirectory multiple hidden></label>
    <button type="button" class="btn btn-ghost" id="mgBack">‹ Back</button>
    <p class="mg-hint">Folder import reads <b>series / chapter / images</b> (or a folder of series) and creates everything at once.</p>`);
    Dom.byId('mgSeriesName').focus();
    const create = () => {
      const title = Dom.byId('mgSeriesName').value.trim();
      if (!title) { this.app.toast.show('Enter a series title.', 'err'); return; }
      let m = this.state.chillMedia.find(x => x.type === 'manga' && x.title.toLowerCase() === title.toLowerCase());
      if (!m) {
        m = { id: Util.id(), type: 'manga', title, chapters: [], size: 0, dateAdded: Date.now() };
        this.state.chillMedia.push(m); this.app.store.save(); this.app.store.log(`New series · ${title}`, COLORS[2]);
        this.app.importer.drawImportList('manga'); this.app.read.drawManga();
      } else this.app.toast.show('That series already exists — opening it.', 'info');
      this.app.sheet.close(); this.mgOpenSeries(m.id);
    };
    Dom.byId('mgCreate').onclick = create;
    Dom.byId('mgSeriesName').onkeydown = (e) => { if (e.key === 'Enter') create(); };
    Dom.byId('mgPickAuto').onchange = () => { const files = Array.from(Dom.byId('mgPickAuto').files || []); this.app.sheet.close(); if (files.length) this.app.mangaImport.mgImportFolder(files, { mode: 'auto' }); };
    Dom.byId('mgBack').onclick = () => Dom.byId('mgPlus').click();
  }

  mgPickSeries() {
    const list = this.state.chillMedia.filter(m => m.type === 'manga');
    this.app.sheet.open(`<div class="mg-sh-title">Add chapter to…</div>` +
      list.map(m => `<button type="button" class="mg-opt" data-s="${m.id}"><b>${Util.esc(m.title)}</b><small>${MangaModel.mangaSub(m)}</small></button>`).join('') +
      `<button type="button" class="btn btn-ghost" id="mgBack">‹ Back</button>`);
    Dom.byId('mgSheet').querySelectorAll('[data-s]').forEach(b => { b.onclick = () => this.mgChapterSheet(b.dataset.s); });
    Dom.byId('mgBack').onclick = () => Dom.byId('mgPlus').click();
  }

  mgChapterSheet(mid) {
    const m = this.find(mid); if (!m) return;
    this.app.sheet.open(`<div class="mg-sh-title">Add chapter · ${Util.esc(m.title)}</div>
    <input id="mgChapterName" class="mg-input" placeholder="Chapter name" value="${Util.esc(MangaModel.nextChapterName(m))}" autocomplete="off">
    <label class="btn btn-gold mg-lab">Select panels (images)<input type="file" id="mgPickImgs" accept="image/*" multiple hidden></label>
    <label class="btn btn-ghost mg-lab">Select .cbz / .zip<input type="file" id="mgPickArc" accept="${ARC_ACCEPT}" multiple hidden></label>
    <label class="btn btn-ghost mg-lab">Import a folder of chapters<input type="file" id="mgPickDir" webkitdirectory multiple hidden></label>
    <button type="button" class="btn btn-ghost" id="mgCancel2">Cancel</button>
    <p class="mg-hint">Select all the panels at once — they're ordered by file name (image1, image2 … image10). Each .cbz/.zip becomes its own chapter. Folder import needs a file picker that supports folders.</p>`);
    const ctxNow = () => ({ mode: 'chapter', mid, chapter: (Dom.byId('mgChapterName')?.value || '').trim(), def: MangaModel.nextChapterName(m) });
    const bind = (inputId, fn) => { const el = Dom.byId(inputId); el.onchange = () => { const files = Array.from(el.files || []), ctx = ctxNow(); this.app.sheet.close(); if (files.length) fn(files, ctx); }; };
    bind('mgPickImgs', this.app.mangaImport.mgImportFiles); bind('mgPickArc', this.app.mangaImport.mgImportFiles); bind('mgPickDir', this.app.mangaImport.mgImportFolder);
    Dom.byId('mgCancel2').onclick = this.app.sheet.close;
  }

  closeSeries() { Dom.byId('mgSeries').hidden = true; this.mgSeriesId = null; }

  mgOpenSeries(mid) { const was = !Dom.byId('mgSeries').hidden; this.mgSeriesId = mid; Dom.byId('mgSeries').hidden = false; if (!was) this.app.overlays.open(this.closeSeries); this.mgRenderSeries(); }

  mgRenderSeries() {
    const m = this.mgSeriesId && this.find(this.mgSeriesId);
    if (!m) { if (Dom.byId('mgSeries') && !Dom.byId('mgSeries').hidden) this.app.overlays.close(this.closeSeries); return; }
    const chs = MangaModel.mangaChapters(m);
    Dom.byId('mgSeriesTitle').textContent = m.title; Dom.byId('mgSeriesSub').textContent = MangaModel.mangaSub(m);
    Dom.byId('mgSeriesList').innerHTML = chs.length ? chs.map((c, i) => {
      const n = (c.pages || []).length;
      return `<div class="chill-row"><div class="chill-row-main"><div class="chill-row-title">${Util.esc(c.name)}</div><div class="chill-row-sub">${n} page${n === 1 ? '' : 's'}</div></div><button type="button" class="btn-icon" data-delch="${i}" title="Delete chapter">✕</button></div>`;
    }).join('') : '<div class="empty">No chapters yet — tap “＋ Add chapter”.</div>';
    Dom.byId('mgSeriesList').querySelectorAll('[data-delch]').forEach(b => { b.onclick = () => this.mgDeleteChapter(m, Number(b.dataset.delch)); });
  }

  async mgResetCover(mid) {
    try { await this.app.mediaDb.deleteBlob('thumb:' + mid); } catch {}
    const tu = this.app.thumbs.thumbUrls.get(mid); if (tu) URL.revokeObjectURL(tu);
    this.app.thumbs.thumbUrls.delete(mid); this.app.thumbs.thumbBad.delete(mid);
  }

  async mgDeleteChapter(m, i) {
    const chs = MangaModel.mangaChapters(m), c = chs[i]; if (!c) return;
    if (!confirm(`Delete “${c.name}”?`)) return;
    for (const p of c.pages || []) { try { await this.app.mediaDb.deleteBlob(p.id); } catch {} }
    if (!m.chapters) { m.chapters = chs.slice(); delete m.pages; }
    m.chapters.splice(i, 1);
    m.size = MangaModel.mangaAllPages(m).length;
    delete (this.state.chillProgress || {})[m.id];
    await this.mgResetCover(m.id);
    this.app.store.save(); this.mgRenderSeries(); this.app.importer.drawImportList('manga'); this.app.read.drawManga();
  }

  async mgDeleteSeries(m) {
    if (!confirm(`Delete “${m.title}” and all its chapters?`)) return;
    for (const p of MangaModel.mangaAllPages(m)) { try { await this.app.mediaDb.deleteBlob(p.id); } catch {} }
    this.state.chillMedia = this.state.chillMedia.filter(x => x.id !== m.id);
    delete (this.state.chillProgress || {})[m.id];
    await this.mgResetCover(m.id);
    this.app.store.save(); this.app.overlays.close(this.closeSeries); this.app.importer.drawImportList('manga'); this.app.read.drawManga();
  }
}
