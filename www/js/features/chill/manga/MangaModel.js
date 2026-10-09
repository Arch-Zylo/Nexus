export class MangaModel {
  /* manga: title / chapter / panels */
  static mangaChapters(m) { return m.chapters || (m.pages ? [{ id: 'c0', name: 'Chapter 1', pages: m.pages }] : []); }

  static mangaAllPages(m) { return MangaModel.mangaChapters(m).flatMap(c => c.pages || []); }

  static mangaSub(m) { const c = MangaModel.mangaChapters(m).length, p = MangaModel.mangaAllPages(m).length; return `${c} chapter${c===1?'':'s'} · ${p} page${p===1?'':'s'}`; }

  static parseMangaPath(s) {
    const p = (s || '').split('/').map(x => x.trim()).filter(Boolean);
    return { title: p[0] || '', chapter: p[1] || 'Chapter 1' };
  }

  // Order chapters by their first number (Chapter 2 < ch3 < Chapter 10), falling back to name
  static chapterCmp(a, b) {
    const na = parseFloat((a.name.match(/\d+(?:\.\d+)?/) || [])[0]), nb = parseFloat((b.name.match(/\d+(?:\.\d+)?/) || [])[0]);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  static nextChapterName(m) { return 'Chapter ' + (m ? MangaModel.mangaChapters(m).length + 1 : 1); }
}
