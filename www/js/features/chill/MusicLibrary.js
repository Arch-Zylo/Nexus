import { Component } from '../../core/Component.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';
import { Id3 } from '../../media/Id3.js';
import { Icons } from '../../ui/Icons.js';

export class MusicLibrary extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.metaBusy = false;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    setTimeout(this.metaPass, 1500);
  }

  drawMusic() {
    const el = Dom.byId('musicList');
    if (!el) return;
    this.app.audio.refreshQueue();
    el.innerHTML = this.app.audio.chillQueue.length ? this.app.audio.chillQueue.map((m, i) => `
    <div class="chill-row${i === this.app.audio.chillQueueIndex ? ' playing' : ''}" data-play="${i}">
      <div class="thumb sq" data-thumb="${m.id}" style="${Util.artStyle(m.title)}"><span>♪</span></div>
      <div class="chill-row-main">
        <div class="chill-row-title">${Util.esc(m.title)}</div>
        <div class="chill-row-sub">${m.missing ? 'File unavailable' : Util.esc(Util.artistOf(m))}${m.lyrics ? ' · ♫' : ''}</div>
      </div>
      <span class="chill-row-icon">${i === this.app.audio.chillQueueIndex && !this.app.audio.chillAudio.paused ? '♪' : Icons.svgI(Icons.IC.play, 18)}</span>
    </div>`).join('') : '<div class="empty">No music imported yet — go to Import</div>';
    el.querySelectorAll('[data-play]').forEach(row => {
      row.addEventListener('click', async () => { await this.app.audio.playChillTrack(Number(row.dataset.play)); this.app.nowPlaying.openNowPlaying(1); });
    });
    this.app.thumbs.hydrateThumbs(el);
  }

  /* metadata (title / artist / lyrics / cover) read from the file's ID3 tag */
  async ensureMeta(m) {
    if (m.metaDone || m.type !== 'music') return false;
    m.metaDone = true;
    try {
      const b = await this.app.mediaDb.getBlob(m.id);
      if (!b) { delete m.metaDone; return false; }
      const t = await Id3.id3Read(b);
      if (t.title) m.title = t.title;
      if (t.artist) m.artist = t.artist;
      if (t.lyrics && !m.lyrics) m.lyrics = t.lyrics;
      if (t.cover) {
        const th = await this.app.thumbs.blobToThumb(t.cover, 500);
        if (th) { await this.app.mediaDb.put('thumb:' + m.id, th).catch(() => {}); const old = this.app.thumbs.thumbUrls.get(m.id); if (old) URL.revokeObjectURL(old); this.app.thumbs.thumbUrls.delete(m.id); this.app.thumbs.thumbBad.delete(m.id); }
      }
      this.app.store.save(); return true;
    } catch { return false; }
  }

  async metaPass() {
    if (this.metaBusy) return; this.metaBusy = true; let any = false;
    for (const m of this.state.chillMedia.filter(x => x.type === 'music' && !x.metaDone)) { if (await this.ensureMeta(m)) any = true; }
    this.metaBusy = false;
    if (any) { this.drawMusic(); this.app.importer.drawImportList('music'); this.app.nowPlaying.drawNpQueue(); }
  }

  async deleteMusic(m) {
    if (!confirm(`Delete “${m.title}”?`)) return;
    if (this.app.audio.chillCurId === m.id) {
      this.app.audio.stop();
      Dom.byId('miniPlayer').hidden = true; if (!Dom.byId('nowPlaying').hidden) this.app.overlays.close(this.app.nowPlaying.closeNowPlaying);
    }
    try { await this.app.mediaDb.deleteBlob(m.id); } catch {}
    try { await this.app.mediaDb.deleteBlob('thumb:' + m.id); } catch {}
    { const tu = this.app.thumbs.thumbUrls.get(m.id); if (tu) URL.revokeObjectURL(tu); this.app.thumbs.thumbUrls.delete(m.id); this.app.thumbs.thumbBad.delete(m.id); }
    this.state.chillMedia = this.state.chillMedia.filter(x => x.id !== m.id);
    this.app.store.save(); this.drawMusic(); this.app.importer.drawImportList('music'); this.app.nowPlaying.drawNpQueue();
  }
}
