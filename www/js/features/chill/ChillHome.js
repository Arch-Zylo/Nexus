import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { MangaModel } from './manga/MangaModel.js';
import { Icons } from '../../ui/Icons.js';
import { Dom } from '../../core/Dom.js';

export class ChillHome extends Component {
  async playTrackById(tid) {
    this.app.audio.refreshQueue();
    const i = this.app.audio.chillQueue.findIndex(x => x.id === tid); if (i < 0) return;
    await this.app.audio.playChillTrack(i); this.app.nowPlaying.openNowPlaying(1);
  }

  drawChillHome() {
    const mEl = Dom.byId('chMetrics'); if (!mEl) return;
    const media = this.state.chillMedia, music = media.filter(m => m.type === 'music'), videos = media.filter(m => m.type === 'video'),
      series = media.filter(m => m.type === 'manga'), stories = this.state.chillStories;
    const total = music.length + videos.length + series.length + stories.length;
    const go = (view) => document.querySelector(`.rail-chill [data-go="${view}"]`)?.click();
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    // greeting, same style as Regular Home
    const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    Dom.byId('chGreet').textContent = this.state.name ? `${hello}, Master ${this.state.name}` : hello;
    Dom.byId('chGreetSub').textContent = total
      ? `${pl(music.length, 'song')} · ${pl(videos.length, 'video')} · ${pl(series.length, 'series')} — all on this device.`
      : 'Your downtime stuff — music, shows, and reading. Tap Import to add some.';

    // status tiles (same look as Regular Home)
    const tile = (cls, label, value, color, to, primary) => `
    <div class="metric${primary ? ' primary' : ''}${cls ? ' ' + cls : ''}" data-chgo="${to}" style="cursor:pointer">
      <div class="accent" style="background:${color}"></div>
      <div class="label">${label}</div><div class="value">${value}</div>
    </div>`;
    const parts = [[music.length, COLORS[3], 'Songs'], [videos.length, COLORS[1], 'Videos'], [series.length, COLORS[4], 'Manga'], [stories.length, COLORS[0], 'Stories']];
    let acc = 0;
    const stops = parts.filter(p => p[0]).map(([n, col]) => { const s = acc; acc += n / total * 100; return `${col} ${s}% ${acc}%`; });
    const pie = total ? `background:conic-gradient(${stops.join(', ')});` : `background:${COLORS[7]};opacity:0.25;`;
    const center = total ? `<div class="donut-center"><div class="donut-total">${total}</div><div class="donut-sub">items</div></div>` : `<div class="donut-center"><div class="donut-sub">Empty</div></div>`;
    const legend = parts.map(([n, col, nm]) => `<span title="${nm}"><b style="color:${col}">●</b> ${n}</span>`).join('');
    mEl.innerHTML =
      tile('', 'In Your Library', total, COLORS[4], 'import', true) +
      tile('metric-opentasks', 'Songs', music.length, COLORS[3], 'music') +
      tile('metric-classesleft', 'Videos', videos.length, COLORS[1], 'watch') +
      `<div class="metric metric-spend" data-chgo="import" style="cursor:pointer" title="Library mix: songs, videos, manga, stories">
       <div class="spend-pie" style="${pie}"><div class="donut-hole">${center}</div></div>
       <div class="donut-legend">${legend}</div></div>` +
      tile('', 'Manga series', series.length, COLORS[4], 'read') +
      tile('', 'Stories', stories.length, COLORS[0], 'read');
    mEl.querySelectorAll('[data-chgo]').forEach(t => { t.onclick = () => go(t.dataset.chgo); });

    const thumbRow = (m, main, sub, extra, attrs) => `
    <div class="chill-row" ${attrs}>
      <div class="thumb sq" data-thumb="${m.id}" style="${Util.artStyle(m.title)}"><span>${m.type === 'music' ? '♪' : m.type === 'video' ? '' : '📖'}</span></div>
      <div class="chill-row-main"><div class="chill-row-title">${Util.esc(main)}</div><div class="chill-row-sub">${Util.esc(sub)}</div>${extra || ''}</div>
    </div>`;
    const bar = (pct, id) => `<div class="cprog"><i ${id ? `id="${id}"` : ''} style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

    // Now Playing
    const cur = this.app.audio.chillCurId && this.app.audio.chillAudio.getAttribute('src') ? media.find(x => x.id === this.app.audio.chillCurId) : null;
    const nowEl = Dom.byId('chNow');
    if (cur) {
      const d = this.app.audio.chillAudio.duration || 0;
      nowEl.innerHTML = `<div class="chill-row" id="chNowRow">
      <div class="thumb sq" data-thumb="${cur.id}" style="${Util.artStyle(cur.title)}"><span>♪</span></div>
      <div class="chill-row-main"><div class="chill-row-title">${Util.esc(cur.title)}</div>
        <div class="chill-row-sub">${Util.esc(Util.artistOf(cur))} · ${this.app.audio.chillAudio.paused ? 'Paused' : 'Playing'}</div>${bar(d ? this.app.audio.chillAudio.currentTime / d * 100 : 0, 'chNpBar')}</div>
      <button type="button" class="ch-pp" id="chNowPP" title="Play / pause">${Icons.svgI(this.app.audio.chillAudio.paused ? Icons.IC.play : Icons.IC.pause, 28)}</button></div>`;
      Dom.byId('chNowRow').onclick = (e) => { if (!e.target.closest('#chNowPP')) this.app.nowPlaying.openNowPlaying(1); };
      Dom.byId('chNowPP').onclick = this.app.audio.togglePlay;
    } else nowEl.innerHTML = '<div class="empty">Nothing playing — pick a song in Music</div>';

    // Continue Reading
    const reading = series.map(m => ({ m, pr: (this.state.chillProgress || {})[m.id] })).filter(x => x.pr && MangaModel.mangaChapters(x.m)[x.pr.ci])
      .sort((a, b) => (b.pr.t || 0) - (a.pr.t || 0)).slice(0, 3);
    const rEl = Dom.byId('chReading');
    rEl.innerHTML = reading.length ? reading.map(({ m, pr }) => {
      const ch = MangaModel.mangaChapters(m)[pr.ci], n = (ch.pages || []).length || 1;
      return thumbRow(m, m.title, `${ch.name} · page ${Math.min(n, pr.page + 1)} of ${n}`, bar((pr.page + 1) / n * 100), `data-read="${m.id}"`);
    }).join('') : `<div class="empty">${series.length ? 'Open a series in Read — it will wait for you here' : 'No manga yet'}</div>`;
    rEl.querySelectorAll('[data-read]').forEach(r => { r.onclick = () => this.app.reader.openManga(r.dataset.read); });

    // Continue Watching
    const watching = videos.filter(Util.resumable).sort((a, b) => (b.seen || 0) - (a.seen || 0)).slice(0, 3);
    const wEl = Dom.byId('chWatching');
    wEl.innerHTML = watching.length ? watching.map(v => thumbRow(v, v.title, `${Util.fmtT(v.pos)} of ${Util.fmtT(v.dur)}`, bar(v.pos / v.dur * 100), `data-watch2="${v.id}"`)).join('')
      : `<div class="empty">${videos.length ? 'Videos you pause part-way show up here' : 'No videos yet'}</div>`;
    wEl.querySelectorAll('[data-watch2]').forEach(r => { r.onclick = () => this.app.video.openVideo(r.dataset.watch2); });

    // Favourites
    const favs = music.filter(m => m.fav).slice(0, 4);
    const fEl = Dom.byId('chFavs');
    fEl.innerHTML = favs.length ? favs.map(m => thumbRow(m, m.title, Util.artistOf(m), '', `data-fav="${m.id}"`)).join('')
      : '<div class="empty">Tap ♡ in the music player to add favourites</div>';
    fEl.querySelectorAll('[data-fav]').forEach(r => { r.onclick = () => this.playTrackById(r.dataset.fav); });

    // Recently Added
    const items = [
      ...media.map(m => ({ id: m.id, title: m.title, type: m.type, ts: m.dateAdded || 0, sub: m.type === 'music' ? Util.artistOf(m) : m.type === 'manga' ? MangaModel.mangaSub(m) : 'Video' })),
      ...stories.map(s => ({ id: s.id, title: s.title, type: 'story', ts: s.ts || 0, sub: 'Story' })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 10);
    const rc = Dom.byId('chillRecent');
    rc.innerHTML = items.length ? `<div class="cstrip">${items.map(it => `
    <div class="cstrip-item" data-ct="${it.type}" data-cid="${it.id}">
      <div class="thumb cs" ${it.type !== 'story' ? `data-thumb="${it.id}"` : ''} style="${Util.artStyle(it.title)}"><span>${{ music: '♪', video: '', manga: '📖', story: '✎' }[it.type]}</span></div>
      <div class="cs-t">${Util.esc(it.title)}</div><div class="cs-s">${Util.esc(it.sub)}${it.ts ? ' · ' + Util.ago(it.ts) : ''}</div>
    </div>`).join('')}</div>` : '<div class="empty">Nothing imported yet</div>';
    rc.querySelectorAll('[data-ct]').forEach(el => {
      el.onclick = () => { const t = el.dataset.ct, id = el.dataset.cid;
        if (t === 'music') this.playTrackById(id); else if (t === 'video') this.app.video.openVideo(id); else if (t === 'manga') this.app.reader.openManga(id); else this.app.stories.showStoryDetail(id); };
    });
    this.app.thumbs.hydrateThumbs(Dom.byId('view-chome'));
  }
}
