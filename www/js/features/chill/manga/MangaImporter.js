import { Component } from '../../../core/Component.js';
import { COLORS } from '../../../core/constants.js';
import { Util } from '../../../core/Util.js';
import { MangaModel } from './MangaModel.js';
import { ZipArchive } from '../../../storage/ZipArchive.js';
import { Dom } from '../../../core/Dom.js';

export class MangaImporter extends Component {
  /** @param {import('../../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.mgFailed = 0;
    this.mgDone = 0;
    this.mgTotal = 0;
  }

  /** Called after every saved page: updates the status line and the progress card. */
  mgTick() {
    this.mgDone++; this.mgStatus(`Importing… ${this.mgDone}/${this.mgTotal} pages`);
    this.app.progress.update(this.mgTotal ? this.mgDone / this.mgTotal : 0, `${this.mgDone} of ${this.mgTotal} pages`, 'Importing manga');
  }

  refreshMangaTitles() {
    const dl = Dom.byId('mgTitles'); if (!dl) return;
    dl.innerHTML = this.state.chillMedia.filter(m => m.type === 'manga').map(m => `<option value="${Util.esc(m.title)}/"></option>`).join('');
  }

  async addMangaChapter(title, chapter, files) {
    files = files.filter(f => (f.type || 'image/').startsWith('image/')).sort(Util.natSort);
    const pages = [];
    for (let i = 0; i < files.length; i++) {
      const pid = Util.id();
      try { await this.app.mediaDb.put(pid, files[i]); } catch { this.mgFailed++; continue; }
      this.mgTick();
      pages.push({ id: pid, order: i });
    }
    if (!pages.length) return 0;
    let m = this.state.chillMedia.find(x => x.type === 'manga' && x.title.toLowerCase() === title.toLowerCase());
    if (!m) { m = { id: Util.id(), type: 'manga', title, chapters: [], size: 0, dateAdded: Date.now() }; this.state.chillMedia.push(m); }
    else if (!m.chapters) { m.chapters = [{ id: Util.id(), name: 'Chapter 1', pages: m.pages || [] }]; delete m.pages; }
    let ch = m.chapters.find(c => c.name.toLowerCase() === chapter.toLowerCase());
    if (!ch) { ch = { id: Util.id(), name: chapter, pages: [] }; m.chapters.push(ch); }
    const base = ch.pages.length;
    pages.forEach((p, i) => { p.order = base + i; });
    ch.pages.push(...pages);
    m.chapters.sort(MangaModel.chapterCmp);
    m.size = MangaModel.mangaAllPages(m).length;
    this.app.thumbs.thumbBad.delete(m.id);
    return pages.length;
  }

  mangaImported(n, title, chapter) {
    this.app.store.save(); this.app.importer.drawImportList('manga'); this.app.read.drawManga(); this.refreshMangaTitles(); this.app.series.mgRenderSeries();
    this.app.store.log(`Imported ${n} panel${n===1?'':'s'} · ${title} / ${chapter}`, COLORS[2]);
    this.app.toast.show(`Imported ${n} panel${n===1?'':'s'}.`, 'ok');
  }

  mgStatus(t) { const e = Dom.byId('mgStatus'); if (e) e.textContent = t || ''; }

  async archiveGroups(file) {
    this.app.progress.busy('Reading archive', file.name);
    const zip = await ZipArchive.open(file), g = new Map();
    for (const e of zip.entries) {
      const parts = e.name.split('/').filter(Boolean), name = parts.pop();
      if (!name || !Util.isImg(name) || parts.some(s => s.startsWith('.') || s === '__MACOSX')) continue;
      const k = parts.join(' – '); if (!g.has(k)) g.set(k, []); g.get(k).push({ e, name });
    }
    const out = [];
    for (const [k, list] of g) {
      const files = [];
      for (const { e, name } of list) files.push(new File([await e.read(Util.mimeOf(name))], name, { type: Util.mimeOf(name) }));
      out.push({ chapter: g.size === 1 ? Util.stripExt(file.name) : (k || Util.stripExt(file.name)), files });
    }
    return out;
  }

  async runMangaGroups(groups) {
    this.mgTotal = groups.reduce((n, g) => n + g.files.length, 0); this.mgDone = 0; this.mgFailed = 0;
    const NP = this.app.progress;
    const bytes = groups.reduce((n, g) => n + g.files.reduce((a, f) => a + f.size, 0), 0);
    if (bytes > 200 * 1024 * 1024 && !confirm(`Import ${this.mgTotal} pages?\n\nThis will use about ${Util.fileSize(bytes)} of storage.`)) { this.mgStatus(''); NP.hide(); return; }
    let pages = 0, last = null;
    NP.start('Importing manga', `0 of ${this.mgTotal} pages`);
    try {
      for (const g of groups) {
        NP.update(this.mgTotal ? this.mgDone / this.mgTotal : 0, `${g.title} · ${g.chapter}`, 'Importing manga');
        pages += await this.addMangaChapter(g.title, g.chapter, g.files); last = g;
      }
    } finally {
      this.mgStatus('');
      NP.finish(!!pages || !this.mgFailed, pages ? `${pages} page${pages === 1 ? '' : 's'} imported${this.mgFailed ? ` · ${this.mgFailed} failed` : ''}` : 'Nothing imported');
    }
    if (pages) this.mangaImported(pages, last.title, groups.length > 1 ? groups.length + ' chapters' : last.chapter);
    else if (!this.mgFailed) this.app.toast.show('No readable images found.', 'err');
    if (this.mgFailed) this.app.toast.show(`${this.mgFailed} page${this.mgFailed === 1 ? '' : 's'} could not be saved — storage may be full.`, 'err', 6000);
  }

  async mgImportFiles(files, ctx) {
    const m = this.app.series.find(ctx.mid); if (!m) return;
    const custom = ctx.chapter && ctx.chapter !== ctx.def ? ctx.chapter : '';
    const imgs = files.filter(f => Util.isImg(f.name) || (f.type || '').startsWith('image/')), arcs = files.filter(f => Util.isArc(f.name));
    const groups = [];
    if (imgs.length) groups.push({ title: m.title, chapter: ctx.chapter || ctx.def, files: imgs });
    try {
      for (const f of arcs) {
        const got = await this.archiveGroups(f);
        for (const a of got) groups.push({ title: m.title, chapter: custom && arcs.length === 1 && !imgs.length && got.length === 1 ? custom : a.chapter, files: a.files });
      }
    } catch (err) { this.app.progress.finish(false, 'Could not read the archive'); this.app.toast.show(err.message, 'err'); }
    if (groups.length) await this.runMangaGroups(groups); else { this.app.progress.finish(false, 'Nothing importable'); this.app.toast.show('Nothing importable was selected (images, .cbz or .zip).', 'err'); }
  }

  async mgImportFolder(fileList, ctx) {
    const items = Array.from(fileList).map(f => ({ f, p: (f.webkitRelativePath || f.name).split('/') }))
      .filter(x => !x.p.some(s => s.startsWith('.') || s === '__MACOSX'));
    if (!items.length) return;
    const root = items[0].p[0], map = new Map();
    const add = (title, chapter, files) => { const k = title + '\0' + chapter; if (!map.has(k)) map.set(k, { title, chapter, files: [] }); map.get(k).files.push(...files); };
    try {
      if (ctx.mode === 'chapter') {
        const m = this.app.series.find(ctx.mid); if (!m) return;
        const custom = ctx.chapter && ctx.chapter !== ctx.def ? ctx.chapter : root;
        for (const { f, p } of items) {
          const rel = p.slice(1);
          if (Util.isArc(f.name)) { for (const a of await this.archiveGroups(f)) add(m.title, a.chapter, a.files); }
          else if (Util.isImg(f.name)) add(m.title, rel.length > 1 ? rel.slice(0, -1).join(' – ') : custom, [f]);
        }
      } else {
        const deep = items.some(x => x.p.length >= 4);
        for (const { f, p } of items) {
          const rel = p.slice(1);
          if (Util.isArc(f.name)) {
            const title = deep && rel.length > 1 ? rel[0] : root;
            for (const a of await this.archiveGroups(f)) add(title, a.chapter, a.files);
          } else if (Util.isImg(f.name)) {
            if (deep) add(rel.length > 1 ? rel[0] : root, rel.length > 2 ? rel.slice(1, -1).join(' – ') : 'Chapter 1', [f]);
            else add(root, rel.length > 1 ? rel.slice(0, -1).join(' – ') : 'Chapter 1', [f]);
          }
        }
      }
    } catch (err) { this.app.progress.finish(false, 'Could not read the folder'); this.app.toast.show(err.message, 'err'); }
    if (map.size) await this.runMangaGroups([...map.values()]);
    else { this.app.progress.finish(false, 'Nothing importable'); this.app.toast.show('No images or .cbz files found in that folder.', 'err'); }
  }
}
