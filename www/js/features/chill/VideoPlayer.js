import { Component } from '../../core/Component.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';
import { Icons } from '../../ui/Icons.js';

export class VideoPlayer extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.vpCur = null;
    this.vpLastSave = 0;
    this.vidUrl = null;
    this.vpHide = null;
    this.vpSeeking = false;
    this.vpLastTap = 0;
    this.vpV = Dom.byId('vpVideo');
    /* Fullscreen = landscape. Try the real fullscreen + orientation lock; if the WebView
       refuses to rotate, turn the player 90° with CSS so it is still landscape. */
    this.vpFsOn = false;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    [['vpClose', 'close', 24], ['vpBack', 'back10', 34], ['vpFwd', 'fwd10', 34], ['vpPlay', 'pause', 38], ['vpFs', 'fs', 24]]
      .forEach(([i, k, s]) => { const e = Dom.byId(i); if (e) e.innerHTML = Icons.svgI(Icons.IC[k], s); });
    Dom.byId('vpClose')?.addEventListener('click', () => this.app.overlays.close(this.closeVideo));
    Dom.byId('vpPlay')?.addEventListener('click', () => { if (this.vpV.paused) this.vpV.play(); else this.vpV.pause(); this.vpShowUi(); });
    Dom.byId('vpBack')?.addEventListener('click', () => this.vpSkip(-10));
    Dom.byId('vpFwd')?.addEventListener('click', () => this.vpSkip(10));
    Dom.byId('vpSpeed')?.addEventListener('click', () => {
      const sp = [1, 1.25, 1.5, 2, 0.75]; const n = sp[(sp.indexOf(this.vpV.playbackRate) + 1) % sp.length];
      this.vpV.playbackRate = n; Dom.byId('vpSpeed').textContent = n + '×'; this.vpShowUi();
    });
    Dom.byId('vpFs')?.addEventListener('click', () => { if (this.vpFsOn) this.vpExitFs(); else this.vpEnterFs(); });
    window.addEventListener('resize', this.vpApplyRot);
    document.addEventListener('fullscreenchange', () => { if (this.vpFsOn && !document.fullscreenElement && !Dom.byId('vidPlayer').hidden && document.documentElement.dataset.fsApi) this.vpExitFs(); });
    this.vpV?.addEventListener('play', () => { Dom.byId('vpPlay').innerHTML = Icons.svgI(Icons.IC.pause, 38); this.vpShowUi(); });
    this.vpV?.addEventListener('pause', () => { Dom.byId('vpPlay').innerHTML = Icons.svgI(Icons.IC.play, 38); this.vpShowUi(); });
    this.vpV?.addEventListener('timeupdate', () => {
      const d = this.vpV.duration || 0;
      if (!this.vpSeeking) Dom.byId('vpSeek').value = d ? (this.vpV.currentTime / d) * 1000 : 0;
      Dom.byId('vpCur').textContent = Util.fmtT(this.vpV.currentTime); Dom.byId('vpDur').textContent = Util.fmtT(d);
    });
    Dom.byId('vpSeek')?.addEventListener('input', () => { this.vpSeeking = true; });
    Dom.byId('vpSeek')?.addEventListener('change', () => { if (this.vpV.duration) this.vpV.currentTime = (Dom.byId('vpSeek').value / 1000) * this.vpV.duration; this.vpSeeking = false; this.vpShowUi(); });
    this.vpV?.addEventListener('timeupdate', () => {
      if (!this.vpCur) return;
      this.vpCur.pos = this.vpV.currentTime; this.vpCur.dur = this.vpV.duration || this.vpCur.dur; this.vpCur.seen = Date.now();
      if (Date.now() - this.vpLastSave > 10000) { this.vpLastSave = Date.now(); this.app.store.save(); }
    });
    this.vpV?.addEventListener('pause', () => { if (this.vpCur) this.app.store.save(); });
    this.vpV?.addEventListener('ended', () => { if (this.vpCur) { this.vpCur.pos = 0; this.app.store.save(); } });
    this.vpV?.addEventListener('error', () => { if (this.vpV.getAttribute('src')) this.app.toast.show('This video could not be played — the format may be unsupported.', 'err', 5000); });
    // tap video = show/hide controls, double-tap left/right = seek 10s
    this.vpV?.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - this.vpLastTap < 300) { const rot = Dom.byId('vidPlayer').classList.contains('rot'); const left = rot ? e.clientY < window.innerHeight / 2 : e.clientX < window.innerWidth / 2; this.vpSkip(left ? -10 : 10); this.vpLastTap = 0; return; }
      this.vpLastTap = now;
      if (Dom.byId('vpUi').classList.contains('off')) this.vpShowUi(); else { clearTimeout(this.vpHide); Dom.byId('vpUi').classList.add('off'); }
    });
  }

  drawWatch() {
    const el = Dom.byId('watchGrid');
    if (!el) return;
    const items = this.state.chillMedia.filter(m => m.type === 'video').sort((a,b) => (b.dateAdded||0)-(a.dateAdded||0));
    el.innerHTML = items.length ? items.map(m => `
    <div class="chill-tile vt" data-watch="${m.id}">
      <div class="thumb wide" data-thumb="${m.id}" style="${Util.artStyle(m.title)}"><span class="play">${Icons.svgI(Icons.IC.play, 18)}</span><span class="dur">${m.duration ? Util.fmtT(m.duration) : ''}</span></div>
      <div class="chill-tile-title">${Util.esc(m.title)}</div>
      <div class="chill-tile-sub">${m.missing ? 'File unavailable' : Util.fileSize(m.size)}</div>
    </div>`).join('') : '<div class="empty">No videos imported yet — go to Import</div>';
    el.querySelectorAll('[data-watch]').forEach(tile => tile.addEventListener('click', () => this.openVideo(tile.dataset.watch)));
    this.app.thumbs.hydrateThumbs(el);
  }

  vpShowUi() {
    Dom.byId('vpUi').classList.remove('off'); clearTimeout(this.vpHide);
    if (!this.vpV.paused) this.vpHide = setTimeout(() => Dom.byId('vpUi').classList.add('off'), 3000);
  }

  async openVideo(mid) {
    const m = this.state.chillMedia.find(x => x.id === mid);
    if (!m) return;
    const blob = await this.app.mediaDb.getBlob(mid).catch(() => null);
    if (!blob) { m.missing = true; this.app.store.save(); this.app.toast.show(`“${m.title}” is unavailable — its file is missing. Remove it in Import.`, 'err', 5000); this.drawWatch(); return; }
    if (m.missing) { delete m.missing; this.app.store.save(); }
    this.app.audio.chillAudio.pause();
    if (this.vidUrl) URL.revokeObjectURL(this.vidUrl);
    this.vidUrl = URL.createObjectURL(blob);
    this.vpV.onloadedmetadata = () => {
      const resume = m.pos;
      this.vpCur = m; m.dur = this.vpV.duration || m.dur;
      if (Util.resumable({ pos: resume, dur: this.vpV.duration })) this.vpV.currentTime = resume;
      if (this.vpV.videoWidth > this.vpV.videoHeight && !this.vpFsOn) this.vpEnterFs();
    };   // landscape video -> landscape player
    this.vpV.src = this.vidUrl; this.vpV.playbackRate = 1; Dom.byId('vpSpeed').textContent = '1×';
    Dom.byId('vpTitle').textContent = m.title;
    Dom.byId('vidPlayer').hidden = false; this.app.overlays.open(this.closeVideo);
    this.vpV.play().catch(() => {}); this.vpShowUi();
  }

  closeVideo() {
    if (this.vpCur) { this.vpCur.pos = this.vpV.currentTime || this.vpCur.pos; this.vpCur.seen = Date.now(); this.app.store.save(); this.vpCur = null; }
    this.vpV.pause(); this.vpV.removeAttribute('src'); this.vpV.load();
    if (this.vidUrl) { URL.revokeObjectURL(this.vidUrl); this.vidUrl = null; }
    if (this.vpFsOn) this.vpExitFs();
    Dom.byId('vidPlayer').hidden = true;
  }

  vpSkip(s) { this.vpV.currentTime = Math.max(0, Math.min(this.vpV.duration || 0, this.vpV.currentTime + s)); this.vpShowUi(); }

  vpApplyRot() { Dom.byId('vidPlayer').classList.toggle('rot', this.vpFsOn && window.innerHeight > window.innerWidth); }

  vpTimeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

  async vpLockLandscape() {
    const so = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenOrientation;   // Android: real rotation
    try { if (so && so.lock) { await Promise.race([so.lock({ orientation: 'landscape' }), this.vpTimeout(800)]); return; } } catch {}
    try { await Promise.race([Dom.byId('vidPlayer').requestFullscreen?.(), this.vpTimeout(500)]); document.documentElement.dataset.fsApi = document.fullscreenElement ? '1' : ''; } catch {}
    try { await Promise.race([screen.orientation?.lock?.('landscape'), this.vpTimeout(500)]); } catch {}
  }

  vpEnterFs() {
    this.vpFsOn = true;
    Dom.byId('vpFs').innerHTML = Icons.svgI(Icons.IC.fsOff, 24);
    this.vpApplyRot();                                   // turn it sideways straight away if the phone is still upright
    this.vpLockLandscape().finally(() => { this.vpApplyRot(); setTimeout(this.vpApplyRot, 400); });
  }

  vpExitFs() {
    this.vpFsOn = false;
    try { const so = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenOrientation; if (so && so.unlock) so.unlock(); } catch {}
    try { screen.orientation?.unlock?.(); } catch {}
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    this.vpApplyRot(); Dom.byId('vpFs').innerHTML = Icons.svgI(Icons.IC.fs, 24);
  }
}
