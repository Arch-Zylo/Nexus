import { Component } from '../../core/Component.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';
import { Icons } from '../../ui/Icons.js';

export class AudioPlayer extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.chillQueue = [];
    this.chillQueueIndex = -1;
    this.chillCurId = null;
    this.shuffleOn = false;
    this.repeatMode = 'all';
    this.audioUrl = null;
    this.chillAudio = Dom.byId('chillAudio');
  }

  /** Rebuilds the queue from the music library (newest first), keeping the index on the current track. */
  refreshQueue() {
    this.chillQueue = this.state.chillMedia.filter(m => m.type === 'music').sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    if (this.chillCurId) this.chillQueueIndex = this.chillQueue.findIndex(x => x.id === this.chillCurId);
  }

  /** Stops playback and forgets the current track. */
  stop() {
    this.chillAudio.pause(); this.chillAudio.removeAttribute('src');
    this.chillCurId = null; this.chillQueueIndex = -1;
  }

  /** Jump to a fraction (0..1) of the current track. */
  seekFraction(f) { if (this.chillAudio.duration) this.chillAudio.currentTime = f * this.chillAudio.duration; }

  toggleShuffle() { this.shuffleOn = !this.shuffleOn; return this.shuffleOn; }

  cycleRepeat() { this.repeatMode = { all: 'one', one: 'off', off: 'all' }[this.repeatMode]; return this.repeatMode; }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    [['mpPrev', 'prev', 22], ['mpNext', 'next', 22], ['mpPlay', 'play', 22]]
      .forEach(([i, k, s]) => { const e = Dom.byId(i); if (e) e.innerHTML = Icons.svgI(Icons.IC[k], s); });
    ['mpPlay', 'npPlay'].forEach(i => Dom.byId(i)?.addEventListener('click', this.togglePlay));
    ['mpPrev', 'npPrev'].forEach(i => Dom.byId(i)?.addEventListener('click', this.prevTrack));
    ['mpNext', 'npNext'].forEach(i => Dom.byId(i)?.addEventListener('click', () => this.playChillTrack(this.nextIndex(1))));
    this.chillAudio?.addEventListener('play', () => { this.syncPlayUi(); this.app.music.drawMusic(); });
    this.chillAudio?.addEventListener('pause', () => { this.syncPlayUi(); this.app.music.drawMusic(); });
    this.chillAudio?.addEventListener('timeupdate', () => {
      const d = this.chillAudio.duration || 0, t = this.chillAudio.currentTime;
      if (!this.app.nowPlaying.npSeeking) { Dom.byId('npSeek').value = d ? (t / d) * 1000 : 0; Dom.byId('npSeek').style.setProperty('--p', d ? (t / d) * 100 + '%' : '0%'); }
      Dom.byId('npCur').textContent = Util.fmtT(t); Dom.byId('npDur').textContent = Util.fmtT(d);
      Dom.byId('mpProg').style.width = d ? (t / d) * 100 + '%' : '0';
      const nb = Dom.byId('chNpBar'); if (nb && d) nb.style.width = (t / d) * 100 + '%';
      this.app.nowPlaying.syncLrc(t);
    });
    this.chillAudio?.addEventListener('ended', () => {
      if (this.repeatMode === 'one') { this.chillAudio.currentTime = 0; this.chillAudio.play(); }
      else if (this.repeatMode === 'off' && !this.shuffleOn && this.chillQueueIndex === this.chillQueue.length - 1) this.syncPlayUi();
      else this.playChillTrack(this.nextIndex(1));
    });
    this.chillAudio?.addEventListener('error', () => { if (this.chillAudio.getAttribute('src')) this.app.toast.show('This audio could not be played — the format may be unsupported.', 'err', 5000); });
  }

  syncPlayUi() {
    const p = !this.chillAudio.paused;
    Dom.byId('mpPlay').innerHTML = Icons.svgI(p ? Icons.IC.pause : Icons.IC.play, 22);
    Dom.byId('npPlay').innerHTML = Icons.svgI(p ? Icons.IC.pause : Icons.IC.play, 46);
    Dom.byId('npRing')?.classList.toggle('paused', !p); Dom.byId('npOrbit')?.classList.toggle('paused', !p);
    Dom.byId('mpSub').textContent = this.chillAudio.src ? (p ? 'Playing' : 'Paused') : 'Not playing';
    if (!Dom.byId('nowPlaying').hidden) this.app.nowPlaying.drawNpQueue();
    if (Dom.byId('view-chome') && Dom.byId('view-chome').classList.contains('on')) this.app.chillHome.drawChillHome();
  }

  async playChillTrack(i) {
    if (i < 0 || i >= this.chillQueue.length) return;
    this.chillQueueIndex = i;
    const m = this.chillQueue[i]; this.chillCurId = m.id;
    const blob = await this.app.mediaDb.getBlob(m.id).catch(() => null);
    if (!blob) { m.missing = true; this.app.store.save(); this.app.toast.show(`“${m.title}” is unavailable — its file is missing (it may not have been restored). Remove it in Import.`, 'err', 5000); this.app.music.drawMusic(); return; }
    if (m.missing) { delete m.missing; this.app.store.save(); }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = URL.createObjectURL(blob);
    this.chillAudio.src = this.audioUrl;
    this.chillAudio.play().catch(() => {});
    await this.app.music.ensureMeta(m);
    Dom.byId('mpTitle').textContent = m.title;
    Dom.byId('miniPlayer').hidden = false;
    const mt = Dom.byId('mpThumb');
    mt.style.cssText = Util.artStyle(m.title); mt.textContent = '♪';
    this.app.thumbs.getThumbUrl(m).then(u => { if (u && this.chillQueue[this.chillQueueIndex] === m) { mt.style.backgroundImage = `url(${u})`; mt.textContent = ''; } });
    this.app.nowPlaying.updateNpHeader(); this.app.nowPlaying.drawLyrics(false); this.syncPlayUi(); this.app.music.drawMusic();
  }

  nextIndex(dir) {
    const n = this.chillQueue.length; if (!n) return -1;
    if (dir > 0 && this.shuffleOn && n > 1) { let r; do { r = Math.floor(Math.random() * n); } while (r === this.chillQueueIndex); return r; }
    return (this.chillQueueIndex + dir + n) % n;
  }

  togglePlay() { if (!this.chillAudio.src) return; if (this.chillAudio.paused) this.chillAudio.play(); else this.chillAudio.pause(); }

  prevTrack() { if (this.chillAudio.currentTime > 3) this.chillAudio.currentTime = 0; else this.playChillTrack(this.nextIndex(-1)); }
}
