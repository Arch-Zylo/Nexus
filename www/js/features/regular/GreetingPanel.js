import { Component } from '../../core/Component.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';

const SLOTS = [
  { id: 'morning', name: 'Morning', when: '5:00 am – 11:59 am' },
  { id: 'afternoon', name: 'Afternoon', when: '12:00 pm – 4:59 pm' },
  { id: 'evening', name: 'Evening', when: '5:00 pm – 8:59 pm' },
  { id: 'night', name: 'Night', when: '9:00 pm – 4:59 am' },
  { id: 'all', name: 'Any time', when: 'Plays when a time of day has no clip of its own' }
];
const MAX_BYTES = 6 * 1024 * 1024;   // keep clips small — they live on the device
const MAX_SECS = 30;

/** Settings → Greeting: upload, play and remove a clip for each time of day. Clips are stored in the media database. */
export class GreetingPanel extends Component {
  constructor(app) {
    super(app);
    this.uploadSlot = null;
    this.clips = {};            // slot -> { name, dur }
  }

  init() {
    Dom.byId('greetBack')?.addEventListener('click', this.hide);
    Dom.byId('greetToggle')?.addEventListener('click', () => this.app.greeter.toggle());
    Dom.byId('greetTest')?.addEventListener('click', () => this.app.greeter.play(false));
    Dom.byId('greetReset')?.addEventListener('click', this.resetAll);
    Dom.byId('greetFile')?.addEventListener('change', this.onFile);
    Dom.byId('greetSlots')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const slot = b.dataset.slot, act = b.dataset.g;
      if (act === 'upload') { this.uploadSlot = slot; this.msg(''); Dom.byId('greetFile').click(); }
      else if (act === 'play') this.app.greeter.play(false, slot === 'all' ? this.app.greeter.slot() : slot);
      else if (act === 'remove') this.remove(slot);
    });
  }

  async show() {
    const main = Dom.byId('settingsMain'), panel = Dom.byId('greetPanel');
    if (main) main.style.display = 'none';
    if (panel) { panel.removeAttribute('hidden'); panel.style.display = 'block'; }
    this.msg('');
    await this.load();
    this.draw();
  }

  hide() {
    const main = Dom.byId('settingsMain'), panel = Dom.byId('greetPanel');
    if (panel) { panel.setAttribute('hidden', ''); panel.style.display = 'none'; }
    if (main) main.style.display = '';
    this.app.greeter.stop();
  }

  async load() {
    this.clips = {};
    for (const s of SLOTS) {
      try { const r = await this.app.mediaDb.getBlob('greet:' + s.id); if (r && r.blob) this.clips[s.id] = { name: r.name || 'Your clip', dur: r.dur || 0 }; } catch {}
    }
  }

  draw() {
    const host = Dom.byId('greetSlots'); if (!host) return;
    host.innerHTML = SLOTS.map((s) => {
      const c = this.clips[s.id];
      const state = c ? `${Util.esc(c.name)}${c.dur ? ' · ' + Math.round(c.dur) + ' s' : ''}` : 'Default';
      return `<div class="greet-slot" data-slot-row="${s.id}">
        <div class="greet-slot-top"><div><div class="greet-slot-name">${s.name}</div><div class="greet-slot-when">${s.when}</div></div>
        <span class="greet-slot-state${c ? ' custom' : ''}">${state}</span></div>
        <div class="greet-slot-btns">
          <button type="button" class="btn btn-gold btn-sm" data-g="upload" data-slot="${s.id}">${c ? 'Replace' : 'Upload'}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-g="play" data-slot="${s.id}">Play</button>
          ${c ? `<button type="button" class="btn btn-ghost btn-sm" data-g="remove" data-slot="${s.id}">Remove</button>` : ''}
        </div></div>`;
    }).join('');
  }

  msg(t, bad) { const m = Dom.byId('greetMsg'); if (m) { m.textContent = t; m.classList.toggle('bad', !!bad); } }

  /** Reads the clip length. Resolves to a number (0 if the browser can't tell) or null if the file can't be read. */
  duration(file) {
    return new Promise((res) => {
      const url = URL.createObjectURL(file); const a = new Audio();
      const end = (v) => { clearTimeout(t); URL.revokeObjectURL(url); res(v); };
      const t = setTimeout(() => end(null), 5000);
      a.preload = 'metadata';
      a.onloadedmetadata = () => end(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => end(null);
      a.src = url;
    });
  }

  async onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    const slot = this.uploadSlot; this.uploadSlot = null;
    if (!f || !slot) return;
    if (!(/^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac)$/i.test(f.name))) { this.msg('That doesn’t look like an audio file.', true); return; }
    if (f.size > MAX_BYTES) { this.msg('That file is too big — keep it under 6 MB.', true); return; }
    const dur = await this.duration(f);
    if (dur === null) { this.msg('Couldn’t read that audio file.', true); return; }
    if (dur > MAX_SECS) { this.msg(`Greetings can be up to ${MAX_SECS} seconds — that clip is ${Math.round(dur)} s.`, true); return; }
    try { await this.app.mediaDb.put('greet:' + slot, { blob: f, name: f.name, dur, type: f.type }); }
    catch { this.msg('Couldn’t save that clip on this device.', true); return; }
    this.clips[slot] = { name: f.name, dur };
    this.draw();
    this.msg(`Saved for ${SLOTS.find(s => s.id === slot).name.toLowerCase()}.`);
  }

  async remove(slot) {
    try { await this.app.mediaDb.deleteBlob('greet:' + slot); } catch {}
    delete this.clips[slot];
    this.draw();
    this.msg('Removed.');
  }

  async resetAll() {
    if (!Object.keys(this.clips).length) { this.msg('You haven’t added any clips.'); return; }
    if (!confirm('Remove all your greeting clips?')) return;
    for (const s of SLOTS) { try { await this.app.mediaDb.deleteBlob('greet:' + s.id); } catch {} }
    this.clips = {};
    this.draw();
    this.msg('All your clips were removed.');
  }
}
