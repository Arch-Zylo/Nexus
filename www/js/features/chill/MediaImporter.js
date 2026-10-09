import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { MangaModel } from './manga/MangaModel.js';
import { Dom } from '../../core/Dom.js';

export class MediaImporter extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.chillObjectUrls = [];
    this.importMode = 'music';
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    document.querySelectorAll('#view-import [data-import-tab]').forEach(b => {
      b.addEventListener('click', () => this.setImportMode(b.dataset.importTab));
    });
    Dom.byId('importMusicFile')?.addEventListener('change', (e) => { this.importFiles(e.target.files, 'music'); e.target.value = ''; });
    Dom.byId('importVideoFile')?.addEventListener('change', (e) => { this.importFiles(e.target.files, 'video'); e.target.value = ''; });
  }

  trackChillUrl(url) { this.chillObjectUrls.push(url); return url; }

  revokeChillUrls() {
    this.chillObjectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    this.chillObjectUrls = [];
    const v = document.querySelector('#dlgBody video');
    if (v) { try { v.pause(); } catch {} v.removeAttribute('src'); v.load(); }
  }

  setImportMode(mode) {
    if (typeof this.app.mangaImport.refreshMangaTitles === 'function') this.app.mangaImport.refreshMangaTitles();
    this.importMode = ['music','video','manga'].includes(mode) ? mode : 'music';
    document.querySelectorAll('#view-import [data-import-tab]').forEach(b => b.classList.toggle('on', b.dataset.importTab === this.importMode));
    Dom.byId('importMusicMode').hidden = this.importMode !== 'music';
    Dom.byId('importVideoMode').hidden = this.importMode !== 'video';
    Dom.byId('importMangaMode').hidden = this.importMode !== 'manga';
    this.drawImportList(this.importMode);
  }

  drawImportList(type) {
    const el = Dom.byId('import' + type.charAt(0).toUpperCase() + type.slice(1) + 'List');
    if (!el) return;
    const items = this.state.chillMedia.filter(m => m.type === type).sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
    el.innerHTML = items.length ? items.map(m => `
    <div class="chill-row" data-mid="${m.id}">
      <div class="chill-row-main">
        <div class="chill-row-title">${Util.esc(m.title)}</div>
        <div class="chill-row-sub">${m.type === 'manga' ? MangaModel.mangaSub(m) : Util.fileSize(m.size)}</div>
      </div>
      <button type="button" class="btn-icon" data-del-media="${m.id}" title="Delete">✕</button>
    </div>`).join('') : '<div class="empty">Nothing imported yet</div>';
    if (type === 'manga') el.querySelectorAll('[data-mid]').forEach(r => r.addEventListener('click', () => this.app.series.mgOpenSeries(r.dataset.mid)));
    el.querySelectorAll('[data-del-media]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const m = this.state.chillMedia.find(x => x.id === btn.dataset.delMedia);
        if (!m) return;
        if (!confirm(`Delete "${m.title}"?`)) return;
        if (m.type === 'manga') {
          for (const p of MangaModel.mangaAllPages(m)) { try { await this.app.mediaDb.deleteBlob(p.id); } catch {} }
        } else {
          try { await this.app.mediaDb.deleteBlob(m.id); } catch {}
        }
        this.state.chillMedia = this.state.chillMedia.filter(x => x.id !== m.id);
        try { await this.app.mediaDb.deleteBlob('thumb:' + m.id); } catch {}
        { const tu = this.app.thumbs.thumbUrls.get(m.id); if (tu) URL.revokeObjectURL(tu); this.app.thumbs.thumbUrls.delete(m.id); this.app.thumbs.thumbBad.delete(m.id); }
        delete (this.state.chillProgress || {})[m.id];
        this.app.store.save();
        this.drawImportList(type); this.app.music.drawMusic(); this.app.video.drawWatch();
      });
    });
  }

  async importFiles(fileList, type) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > 200 * 1024 * 1024 && !confirm(`Import ${files.length} file${files.length === 1 ? '' : 's'}?\n\nThis will use about ${Util.fileSize(total)} of storage.`)) return;
    let ok = 0, failed = 0, full = false, doneBytes = 0;
    const NP = this.app.progress, label = type === 'video' ? 'Importing videos' : 'Importing music';
    // share of the bar for file i (by size; by count if every file is empty)
    const share = (i, part) => total ? (doneBytes + files[i].size * part) / total : (i + part) / files.length;
    NP.start(label, `Preparing ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      for (let i = 0; i < files.length; i++) {
        NP.update(share(i, 0.5), `${i + 1} of ${files.length} · ${files[i].name} (${Util.fileSize(files[i].size)})`, label);
        const mid = Util.id();
        try { await this.app.mediaDb.put(mid, files[i]); }
        catch (e) { failed++; if (e && e.name === 'QuotaExceededError') { full = true; failed += files.length - i - 1; break; } doneBytes += files[i].size; continue; }
        doneBytes += files[i].size;
        this.state.chillMedia.push({ id: mid, type, title: Util.fileTitle(files[i]), size: files[i].size, mimeType: files[i].type, dateAdded: Date.now() });
        ok++;
        NP.update(total ? doneBytes / total : (i + 1) / files.length, `${i + 1} of ${files.length} saved`, label);
      }
      this.app.store.save();
      this.drawImportList(type); this.app.music.drawMusic(); this.app.video.drawWatch();
      if (ok) this.app.store.log(`Imported ${ok} ${type} file${ok === 1 ? '' : 's'}`, COLORS[2]);
      if (type === 'music') this.app.music.metaPass();
    } finally {
      NP.finish(ok > 0 || !failed, failed ? `${ok} imported · ${failed} failed` : `${ok} imported`);
    }
    this.app.toast.show(failed ? `Imported ${ok}, ${failed} failed${full ? ' — storage is full' : ''}.` : `Imported ${ok} file${ok === 1 ? '' : 's'}.`, failed ? 'err' : 'ok', 5000);
  }
}
