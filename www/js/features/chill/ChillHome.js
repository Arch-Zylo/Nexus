import { Component } from '../../core/Component.js';
import { Util } from '../../core/Util.js';
import { MangaModel } from './manga/MangaModel.js';
import { Icons } from '../../ui/Icons.js';
import { Dom } from '../../core/Dom.js';

const PER_SHELF = 12;
const GLYPH = { music: '♪', video: '', manga: '📖', story: '✎' };

/**
 * Chill dashboard: a greeting, then five shelves in this order —
 * Recently Added · Music · Watch · Read · Favorites.
 */
export class ChillHome extends Component {
  async playTrackById(tid) {
    this.app.audio.refreshQueue();
    const i = this.app.audio.chillQueue.findIndex(x => x.id === tid); if (i < 0) return;
    await this.app.audio.playChillTrack(i); this.app.nowPlaying.openNowPlaying(1);
  }

  /** Opens one item from a shelf, whatever its type. */
  openItem(type, id) {
    if (type === 'music') this.playTrackById(id);
    else if (type === 'video') this.app.video.openVideo(id);
    else if (type === 'manga') this.app.reader.openManga(id);
    else this.app.stories.showStoryDetail(id);
  }

  drawChillHome() {
    const host = Dom.byId('chillRecent'); if (!host) return;
    const media = this.state.chillMedia, stories = this.state.chillStories || [];
    const music = media.filter(m => m.type === 'music'), videos = media.filter(m => m.type === 'video'), series = media.filter(m => m.type === 'manga');
    const total = music.length + videos.length + series.length + stories.length;
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const byAdded = (a, b) => (b.dateAdded || b.ts || 0) - (a.dateAdded || a.ts || 0);

    // greeting
    const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    Dom.byId('chGreet').textContent = this.state.name ? `${hello}, Master ${this.state.name}` : hello;
    Dom.byId('chGreetSub').textContent = total
      ? `${pl(music.length, 'song')} · ${pl(videos.length, 'video')} · ${pl(series.length, 'series')} — all on this device.`
      : 'Your downtime stuff — music, shows, and reading. Tap Import to add some.';

    // shelf cards. `extra` adds data attributes (data-fav / data-read) alongside the generic data-ct/data-cid.
    const card = (it) => `
    <div class="cstrip-item" data-ct="${it.type}" data-cid="${it.id}" ${it.extra || ''}>
      <div class="thumb cs" ${it.type !== 'story' ? `data-thumb="${it.id}"` : ''} style="${Util.artStyle(it.title)}"><span>${GLYPH[it.type]}</span></div>
      <div class="cs-t">${Util.esc(it.title)}</div><div class="cs-s">${Util.esc(it.sub)}</div>
      ${it.pct != null ? `<div class="cprog"><i style="width:${Math.max(0, Math.min(100, it.pct))}%"></i></div>` : ''}
    </div>`;
    const shelf = (items, empty) => items.length ? `<div class="cstrip">${items.slice(0, PER_SHELF).map(card).join('')}</div>` : `<div class="empty">${empty}</div>`;
    const ago = (t) => (t ? ' · ' + Util.ago(t) : '');

    // 1 · Recently Added (everything, newest first)
    const recent = [
      ...media.map(m => ({ id: m.id, title: m.title, type: m.type, ts: m.dateAdded || 0, sub: (m.type === 'music' ? Util.artistOf(m) : m.type === 'manga' ? MangaModel.mangaSub(m) : 'Video') + ago(m.dateAdded) })),
      ...stories.map(s => ({ id: s.id, title: s.title, type: 'story', ts: s.ts || 0, sub: 'Story' + ago(s.ts) }))
    ].sort((a, b) => b.ts - a.ts);
    host.innerHTML = shelf(recent, 'Nothing imported yet — tap Import to add music, videos or manga');

    // 2 · Music (now playing on top, then your songs, newest first)
    const cur = this.app.audio.chillCurId && this.app.audio.chillAudio.getAttribute('src') ? media.find(x => x.id === this.app.audio.chillCurId) : null;
    let nowHtml = '';
    if (cur) {
      const a = this.app.audio.chillAudio, d = a.duration || 0;
      nowHtml = `<div class="chill-row ch-now" id="chNowRow">
      <div class="thumb sq" data-thumb="${cur.id}" style="${Util.artStyle(cur.title)}"><span>♪</span></div>
      <div class="chill-row-main"><div class="chill-row-title">${Util.esc(cur.title)}</div>
        <div class="chill-row-sub">${Util.esc(Util.artistOf(cur))} · ${a.paused ? 'Paused' : 'Playing'}</div>
        <div class="cprog"><i id="chNpBar" style="width:${d ? Math.min(100, a.currentTime / d * 100) : 0}%"></i></div></div>
      <button type="button" class="ch-pp" id="chNowPP" title="Play / pause">${Icons.svgI(a.paused ? Icons.IC.play : Icons.IC.pause, 28)}</button></div>`;
    }
    Dom.byId('chMusic').innerHTML = nowHtml + shelf(
      [...music].sort(byAdded).map(m => ({ id: m.id, title: m.title, type: 'music', sub: Util.artistOf(m) })),
      'No songs yet — import some to see them here');

    // 3 · Watch (videos you paused part-way first, with progress, then the rest)
    const resumable = videos.filter(Util.resumable).sort((a, b) => (b.seen || 0) - (a.seen || 0));
    const rest = videos.filter(v => !resumable.includes(v)).sort(byAdded);
    Dom.byId('chWatch').innerHTML = shelf([
      ...resumable.map(v => ({ id: v.id, title: v.title, type: 'video', sub: `${Util.fmtT(v.pos)} of ${Util.fmtT(v.dur)}`, pct: v.pos / v.dur * 100 })),
      ...rest.map(v => ({ id: v.id, title: v.title, type: 'video', sub: v.dur ? Util.fmtT(v.dur) : 'Video' }))
    ], 'No videos yet — import some to see them here');

    // 4 · Read (series you are part-way through first, with progress, then other series, then stories)
    const prog = this.state.chillProgress || {};
    const reading = series.map(m => ({ m, pr: prog[m.id] })).filter(x => x.pr && MangaModel.mangaChapters(x.m)[x.pr.ci]).sort((a, b) => (b.pr.t || 0) - (a.pr.t || 0));
    const readingIds = new Set(reading.map(x => x.m.id));
    Dom.byId('chRead').innerHTML = shelf([
      ...reading.map(({ m, pr }) => { const ch = MangaModel.mangaChapters(m)[pr.ci], n = (ch.pages || []).length || 1;
        return { id: m.id, title: m.title, type: 'manga', sub: `${ch.name} · p. ${Math.min(n, pr.page + 1)}/${n}`, pct: (pr.page + 1) / n * 100, extra: `data-read="${m.id}"` }; }),
      ...series.filter(m => !readingIds.has(m.id)).sort(byAdded).map(m => ({ id: m.id, title: m.title, type: 'manga', sub: MangaModel.mangaSub(m) })),
      ...[...stories].sort(byAdded).map(s => ({ id: s.id, title: s.title, type: 'story', sub: 'Story' }))
    ], 'No manga or stories yet — import some to see them here');

    // 5 · Favorites (anything you hearted — songs for now)
    Dom.byId('chFavs').innerHTML = shelf(
      media.filter(m => m.fav).sort(byAdded).map(m => ({ id: m.id, title: m.title, type: m.type, sub: m.type === 'music' ? Util.artistOf(m) : 'Video', extra: `data-fav="${m.id}"` })),
      'Tap ♡ in the music player to add favorites');

    // behaviour
    const view = Dom.byId('view-chome');
    view.onclick = (e) => {
      const go = e.target.closest('[data-chgo]');
      if (go) { document.querySelector(`.rail-chill [data-go="${go.dataset.chgo}"]`)?.click(); return; }
      if (e.target.closest('#chNowPP')) return;
      if (e.target.closest('#chNowRow')) { this.app.nowPlaying.openNowPlaying(1); return; }
      const it = e.target.closest('[data-ct]'); if (it) this.openItem(it.dataset.ct, it.dataset.cid);
    };
    const pp = Dom.byId('chNowPP'); if (pp) pp.onclick = this.app.audio.togglePlay;
    this.app.thumbs.hydrateThumbs(view);
  }
}
