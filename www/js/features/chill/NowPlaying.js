import { Component } from '../../core/Component.js';
import { AUDIO_EXT, REPEAT_LABEL } from '../../core/constants.js';
import { Dom } from '../../core/Dom.js';
import { Platform } from '../../core/Platform.js';
import { Util } from '../../core/Util.js';
import { Icons } from '../../ui/Icons.js';

export class NowPlaying extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.npSeeking = false;
    this.lrcLines = [];
    this.lrcCur = -1;
    this.vizCtx = null;
    this.vizAn = null;
    this.vizData = null;
    this.vizSrc = null;
    this.vizRaf = 0;
    this.vizFail = false;
    this.vizSm = new Float32Array(40);
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    [['npShare', 'share', 26], ['npMore', 'more', 26], ['npShuffle', 'shuffle', 26], ['npPrev', 'prev', 38], ['npNext', 'next', 38]]
      .forEach(([i, k, s]) => { const e = Dom.byId(i); if (e) e.innerHTML = Icons.svgI(Icons.IC[k], s); });
    this.app.audio.chillAudio?.addEventListener('playing', () => { this.vizAttach(); this.vizStart(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.vizCtx && this.vizCtx.state === 'suspended') this.vizCtx.resume().catch(() => {}); });
    Dom.byId('npPager')?.addEventListener('scroll', () => {
      const p = this.npPager(), i = Math.round(p.scrollLeft / Math.max(1, p.clientWidth));
      document.querySelectorAll('#npDots i').forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
    document.querySelectorAll('#npDots i').forEach((d, k) => d.addEventListener('click', () => this.npPager().scrollTo({ left: k * this.npPager().clientWidth, behavior: 'smooth' })));
    Dom.byId('npSeek')?.addEventListener('input', () => {
      this.npSeeking = true; const v = Dom.byId('npSeek').value / 1000;
      Dom.byId('npSeek').style.setProperty('--p', v * 100 + '%'); Dom.byId('npCur').textContent = Util.fmtT(v * (this.app.audio.chillAudio.duration || 0));
    });
    Dom.byId('npSeek')?.addEventListener('change', () => { this.app.audio.seekFraction(Dom.byId('npSeek').value / 1000); this.npSeeking = false; });
    Dom.byId('npShuffle')?.addEventListener('click', () => { const on = this.app.audio.toggleShuffle(); Dom.byId('npShuffle').style.color = on ? '#ff6b5e' : '#fff'; this.app.toast.show(on ? 'Shuffle on' : 'Shuffle off', 'info', 1200); });
    Dom.byId('npFav')?.addEventListener('click', () => { const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex]; if (!m) return; m.fav = !m.fav; if (!m.fav) delete m.fav; this.app.store.save(); this.updateNpHeader(); });
    Dom.byId('mpOpen')?.addEventListener('click', () => this.openNowPlaying(1));
    Dom.byId('npMore')?.addEventListener('click', () => {
      const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex]; if (!m) return;
      this.app.sheet.open(`<div class="mg-sh-title">${Util.esc(m.title)}</div>
    <button type="button" class="mg-opt" id="nmLyr"><b>${m.lyrics ? 'Edit lyrics' : 'Add lyrics'}</b><small>Type, paste, or use [mm:ss.xx] lines for synced lyrics</small></button>
    <button type="button" class="mg-opt" id="nmRep"><b>${REPEAT_LABEL[this.app.audio.repeatMode]}</b><small>Tap to change</small></button>
    <button type="button" class="mg-opt" id="nmDel"><b>Delete song</b><small>Removes it from this device</small></button>
    <button type="button" class="btn btn-ghost" id="nmX">Close</button>`);
      Dom.byId('nmLyr').onclick = () => { this.app.sheet.close(); this.npPager().scrollTo({ left: 2 * this.npPager().clientWidth, behavior: 'smooth' }); this.drawLyrics(true); };
      Dom.byId('nmRep').onclick = () => { this.app.toast.show(REPEAT_LABEL[this.app.audio.cycleRepeat()], 'info', 1400); this.app.sheet.close(); };
      Dom.byId('nmDel').onclick = () => { this.app.sheet.close(); this.app.music.deleteMusic(m); };
      Dom.byId('nmX').onclick = this.app.sheet.close;
    });
    Dom.byId('npShare')?.addEventListener('click', async () => {
      const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex]; if (!m) return;
      const blob = await this.app.mediaDb.getBlob(m.id).catch(() => null);
      if (!blob) { this.app.toast.show('This song’s file is unavailable.', 'err'); return; }
      const type = m.mimeType || blob.type || 'audio/mpeg';
      const name = (m.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'song') + '.' + (AUDIO_EXT[type] || 'mp3');
      try {
        if (Platform.isNative()) {
          const FS = window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem, SH = window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
          if (!FS || !SH) { this.app.toast.show('Sharing isn’t available in this build.', 'err'); return; }
          this.app.toast.show('Preparing…', 'info', 0);
          const w = await this.app.backup.writeBlobNative(FS, name, blob);
          await SH.share({ title: m.title, text: m.title + ' — ' + Util.artistOf(m), url: w.uri, dialogTitle: 'Share song' });
          this.app.toast.show('', 'info', 1);
        } else if (navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type })] })) {
          await navigator.share({ files: [new File([blob], name, { type })], title: m.title });
        } else this.app.toast.show('Sharing isn’t supported in this browser.', 'err');
      } catch (e) { if (!e || e.name !== 'AbortError') console.warn('Nexus: share failed', e); }
    });
    Dom.byId('npLyricsEditBtn')?.addEventListener('click', () => { if (this.app.audio.chillQueueIndex >= 0) this.drawLyrics(true); });
    Dom.byId('npLyricsCancel')?.addEventListener('click', () => this.drawLyrics(false));
    Dom.byId('npLyricsSave')?.addEventListener('click', () => {
      const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex]; if (!m) return;
      const v = Dom.byId('npLyricsText').value.trim();
      if (v) m.lyrics = v; else delete m.lyrics;
      this.app.store.save(); this.drawLyrics(false); this.app.music.drawMusic();
    });
  }

  npPager() { return Dom.byId('npPager'); }

  openNowPlaying(page) {
    if (Dom.byId('nowPlaying').hidden) { Dom.byId('nowPlaying').hidden = false; this.app.overlays.open(this.closeNowPlaying); }
    this.drawNpQueue(); this.updateNpHeader(); this.vizStart();
    const p = this.npPager(); p.scrollLeft = (page == null ? 1 : page) * p.clientWidth;
  }

  closeNowPlaying() { Dom.byId('nowPlaying').hidden = true; }

  vizAttach() {
    if (this.vizFail) return;
    try {
      if (!this.vizCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.vizFail = true; return; }
        this.vizCtx = new AC(); this.vizAn = this.vizCtx.createAnalyser(); this.vizAn.fftSize = 256; this.vizAn.smoothingTimeConstant = 0.7;
        this.vizData = new Uint8Array(this.vizAn.frequencyBinCount);
      }
      if (this.vizCtx.state === 'suspended') this.vizCtx.resume().catch(() => {});
      const cap = this.app.audio.chillAudio.captureStream || this.app.audio.chillAudio.mozCaptureStream;
      if (!cap) { this.vizFail = true; return; }
      const stream = cap.call(this.app.audio.chillAudio);
      if (!stream.getAudioTracks().length) return;
      if (this.vizSrc) { try { this.vizSrc.disconnect(); } catch {} }
      this.vizSrc = this.vizCtx.createMediaStreamSource(stream); this.vizSrc.connect(this.vizAn);
    } catch (e) { console.warn('Nexus: audio graph unavailable', e); this.vizFail = true; }
  }

  vizStart() { if (!this.vizRaf) this.vizRaf = requestAnimationFrame(this.vizDraw); }

  vizDraw() {
    this.vizRaf = 0;
    const cv = Dom.byId('npViz'); if (!cv || Dom.byId('nowPlaying').hidden) return;
    cv.style.visibility = this.vizFail ? 'hidden' : 'visible';
    const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (W && (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr))) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const live = this.vizAn && !this.app.audio.chillAudio.paused; if (live) this.vizAn.getByteFrequencyData(this.vizData);
    const N = 36, gap = 4, bw = (W - gap * (N - 1)) / N, grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffb8a8'); grad.addColorStop(1, '#ff6b5e'); g.fillStyle = grad;
    for (let i = 0; i < N; i++) {
      const idx = live ? Math.min(this.vizData.length - 1, Math.floor(Math.pow(i / N, 1.5) * this.vizData.length * 0.7)) : 0;
      const v = live ? this.vizData[idx] / 255 : 0;
      this.vizSm[i] = Math.max(v, this.vizSm[i] * 0.88);
      const bh = Math.max(4, this.vizSm[i] * H), x = i * (bw + gap), y = (H - bh) / 2, r = Math.min(bw / 2, bh / 2);
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + bw, y, x + bw, y + bh, r); g.arcTo(x + bw, y + bh, x, y + bh, r); g.arcTo(x, y + bh, x, y, r); g.arcTo(x, y, x + bw, y, r); g.fill();
    }
    this.vizRaf = requestAnimationFrame(this.vizDraw);
  }

  updateNpHeader() {
    const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex]; if (!m) return;
    Dom.byId('npTitle').textContent = m.title; Dom.byId('npArtist').textContent = Util.artistOf(m);
    Dom.byId('npFav').innerHTML = Icons.svgI(m.fav ? Icons.IC.heartOn : Icons.IC.heart, 26);
    Dom.byId('npShuffle').style.color = this.app.audio.shuffleOn ? '#ff6b5e' : '#fff';
    const art = Dom.byId('npArt'), bg = Dom.byId('npBg');
    art.style.cssText = Util.artStyle(m.title); art.textContent = '♪'; bg.style.cssText = Util.artStyle(m.title);
    this.app.thumbs.getThumbUrl(m).then(u => { if (u && this.app.audio.chillQueue[this.app.audio.chillQueueIndex] === m) { art.style.backgroundImage = bg.style.backgroundImage = `url(${u})`; art.textContent = ''; } });
  }

  drawNpQueue() {
    const box = Dom.byId('npQueue'); if (!box) return;
    const top = box.scrollTop, first = !box.children.length;
    box.innerHTML = this.app.audio.chillQueue.map((m, i) => `
    <div class="np-q${i === this.app.audio.chillQueueIndex ? ' cur' : ''}" data-q="${i}">
      <div class="np-q-main"><div class="np-q-t">${Util.esc(m.title)}</div><div class="np-q-a">${Util.esc(Util.artistOf(m))}</div></div>
      ${i === this.app.audio.chillQueueIndex ? `<span class="eq${this.app.audio.chillAudio.paused ? ' paused' : ''}"><i></i><i></i><i></i></span>` : ''}
      <button type="button" class="np-ic" data-qm="${i}" title="More">${Icons.svgI(Icons.IC.more, 22)}</button>
    </div>`).join('');
    box.querySelectorAll('[data-q]').forEach(r => r.addEventListener('click', (e) => { if (e.target.closest('[data-qm]')) return; this.app.audio.playChillTrack(Number(r.dataset.q)); }));
    box.querySelectorAll('[data-qm]').forEach(b => b.addEventListener('click', () => this.npRowSheet(Number(b.dataset.qm))));
    const cur = box.querySelector('.cur');
    box.scrollTop = first && cur ? Math.max(0, cur.offsetTop - 70) : top;
  }

  npRowSheet(i) {
    const m = this.app.audio.chillQueue[i]; if (!m) return;
    this.app.sheet.open(`<div class="mg-sh-title">${Util.esc(m.title)}</div>
    <button type="button" class="mg-opt" id="nrPlay"><b>Play</b></button>
    <button type="button" class="mg-opt" id="nrDel"><b>Delete song</b><small>Removes it from this device</small></button>
    <button type="button" class="btn btn-ghost" id="nrX">Close</button>`);
    Dom.byId('nrPlay').onclick = () => { this.app.sheet.close(); this.app.audio.playChillTrack(i); };
    Dom.byId('nrDel').onclick = () => { this.app.sheet.close(); this.app.music.deleteMusic(m); };
    Dom.byId('nrX').onclick = this.app.sheet.close;
  }

  parseLrc(t) {
    const re = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g, out = [];
    for (const line of t.split(/\r?\n/)) {
      const tags = [...line.matchAll(re)]; if (!tags.length) continue;
      const text = line.replace(re, '').trim();
      for (const g of tags) out.push({ t: Number(g[1]) * 60 + parseFloat(g[2].replace(':', '.')), text });
    }
    return out.sort((a, b) => a.t - b.t);
  }

  drawLyrics(editing) {
    const m = this.app.audio.chillQueue[this.app.audio.chillQueueIndex], has = !!(m && m.lyrics && m.lyrics.trim());
    Dom.byId('npLyricsView').hidden = !!editing; Dom.byId('npLyricsEdit').hidden = !editing;
    const body = Dom.byId('npLyricsBody'); this.lrcLines = []; this.lrcCur = -1;
    if (!has) {
      body.innerHTML = '<div class="np-lyr-empty">No lyrics yet</div>';
    } else {
      this.lrcLines = this.parseLrc(m.lyrics);
      if (this.lrcLines.length >= 2) body.innerHTML = this.lrcLines.map((l, i) => `<div class="ly" data-ly="${i}">${Util.esc(l.text) || '♪'}</div>`).join('');
      else { this.lrcLines = []; body.innerHTML = `<div class="ly plain">${Util.esc(m.lyrics).replace(/\n/g, '<br>')}</div>`; }
    }
    Dom.byId('npLyricsEditBtn').textContent = has ? 'Edit lyrics' : 'Add lyrics';
    if (editing) { Dom.byId('npLyricsText').value = has ? m.lyrics : ''; Dom.byId('npLyricsText').focus(); }
  }

  syncLrc(t) {
    if (!this.lrcLines.length) return;
    let i = -1; for (let k = 0; k < this.lrcLines.length; k++) { if (this.lrcLines[k].t <= t + 0.15) i = k; else break; }
    if (i === this.lrcCur) return; this.lrcCur = i;
    const body = Dom.byId('npLyricsBody'); body.querySelectorAll('.ly.cur').forEach(e => e.classList.remove('cur'));
    const el = body.querySelector(`[data-ly="${i}"]`); if (!el) return;
    el.classList.add('cur');
    const box = Dom.byId('npLyrScroll'); box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }
}
