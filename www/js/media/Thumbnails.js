import { Component } from '../core/Component.js';
import { Util } from '../core/Util.js';
import { MangaModel } from '../features/chill/manga/MangaModel.js';
import { Id3 } from './Id3.js';

export class Thumbnails extends Component {
  /** @param {import('../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.thumbUrls = new Map();
    this.thumbBad = new Set();
  }

  async blobToThumb(blob, w) {
    try {
      const bmp = await createImageBitmap(blob);
      const sc = Math.min(1, w / bmp.width);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc));
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
      return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82));
    } catch { return null; }
  }

  videoFrame(blob) {
    return new Promise(res => {
      const v = document.createElement('video'), url = URL.createObjectURL(blob);
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      let done = false;
      const fin = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); res(r); };
      v.onerror = () => fin(null);
      v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) * 0.1); };
      v.onseeked = () => {
        try {
          const sc = Math.min(1, 480 / (v.videoWidth || 480)), cv = document.createElement('canvas');
          cv.width = Math.round((v.videoWidth || 480) * sc); cv.height = Math.round((v.videoHeight || 270) * sc);
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          const dur = v.duration;
          cv.toBlob(b => fin(b ? { blob: b, dur } : null), 'image/jpeg', 0.8);
        } catch { fin(null); }
      };
      setTimeout(() => fin(null), 10000);
      v.src = url;
    });
  }

  async getThumbUrl(m) {
    if (this.thumbUrls.has(m.id)) return this.thumbUrls.get(m.id);
    if (this.thumbBad.has(m.id)) return null;
    let blob = await this.app.mediaDb.getBlob('thumb:' + m.id).catch(() => null);
    if (!blob) {
      try {
        if (m.type === 'music') { const s = await this.app.mediaDb.getBlob(m.id); const a = s && await Id3.id3Cover(s); blob = a && await this.blobToThumb(a, 400); }
        else if (m.type === 'video') {
          const s = await this.app.mediaDb.getBlob(m.id), r = s && await this.videoFrame(s);
          if (r) { blob = r.blob; if (r.dur && !m.duration) { m.duration = r.dur; this.app.store.save(); } }
        } else if (m.type === 'manga') { const p = MangaModel.mangaAllPages(m)[0]; const s = p && await this.app.mediaDb.getBlob(p.id); blob = s && await this.blobToThumb(s, 360); }
      } catch {}
      if (blob) await this.app.mediaDb.put('thumb:' + m.id, blob).catch(() => {});
    }
    if (!blob) { this.thumbBad.add(m.id); return null; }
    const url = URL.createObjectURL(blob); this.thumbUrls.set(m.id, url); return url;
  }

  hydrateThumbs(root) {
    root.querySelectorAll('[data-thumb]').forEach(async el => {
      const m = this.state.chillMedia.find(x => x.id === el.dataset.thumb);
      if (!m) return;
      const u = await this.getThumbUrl(m);
      if (!el.isConnected) return;
      if (u) { el.style.backgroundImage = `url(${u})`; el.classList.add('has'); }
      const d = el.querySelector('.dur'); if (d && m.duration) d.textContent = Util.fmtT(m.duration);
    });
  }
}
