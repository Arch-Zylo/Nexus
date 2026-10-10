import { Component } from './Component.js';
import { Dom } from './Dom.js';

const FILE = 'assets/greeting.mp3';   // Nexus's default greeting clip
const LINES = {                        // built-in voice wording (used only when no clip can be played)
  morning: (n) => `Ara ara... good morning, ${n}. Did you sleep well?`,
  afternoon: (n) => `Ara ara... good afternoon, ${n}. Shall we get on with the day?`,
  evening: (n) => `Ara ara... good evening, ${n}. I've been waiting for you.`,
  night: (n) => `Ara ara... it's late, ${n}. Don't stay up too long, hm?`
};

/**
 * Spoken greeting, once per app launch. It never repeats while the app stays open (coming back from the
 * background is not a new launch). It waits for the Terms gate and the app lock, and if the system blocks
 * autoplay it plays on the first tap instead.
 *
 * What plays, in order: the user's clip for the current time of day → the user's "Any time" clip →
 * the default clip (assets/greeting.mp3) → the phone's built-in voice. Clips are uploaded in Settings → Greeting
 * and kept in the on-device media database under `greet:<slot>`.
 */
export class Greeter extends Component {
  constructor(app) {
    super(app);
    this.done = false;        // already greeted in this launch
    this.armed = false;       // waiting for a first tap because autoplay was blocked
    this.cur = null;          // audio currently playing (so a new preview can stop it)
  }

  init() {
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    setTimeout(this.tryGreet, 700);
  }

  /** Called at start-up, after the Terms are accepted and after the app is unlocked. Does nothing once greeted. */
  tryGreet() {
    if (this.done || this.state.greet === false) return;
    if (this.app.lock && this.app.lock.locked) return;
    const tos = Dom.byId('tosGate'); if (tos && !tos.hidden) return;
    this.done = true;
    this.play(true);
  }

  /** morning 05–11:59 · afternoon 12–16:59 · evening 17–20:59 · night 21–04:59 */
  slot(d = new Date()) {
    const h = d.getHours();
    return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  }

  line(slot = this.slot()) {
    const n = (this.state.name || '').trim() || 'you';
    return (LINES[slot] || LINES[this.slot()])(n);
  }

  stop() {
    if (this.cur) { try { this.cur.pause(); } catch {} this.cur = null; }
    try { speechSynthesis.cancel(); } catch {}
  }

  /** Plays the greeting for `slot` (default: now). `auto` = launched by the app, so a blocked autoplay waits for a tap. */
  async play(auto = false, slot = this.slot()) {
    this.stop();
    const r = await this.playFile(slot);
    if (r === 'ok') return;
    if (r === 'blocked') { if (auto) this.armTap(); return; }
    this.speak(auto, slot);
  }

  /** 'ok' | 'blocked' (autoplay) | 'none' (nothing playable). */
  async playFile(slot) {
    for (const key of new Set([slot, 'all'])) {
      let rec = null;
      try { rec = await this.app.mediaDb.getBlob('greet:' + key); } catch {}
      if (rec && rec.blob) {
        const r = await this.tryClip(URL.createObjectURL(rec.blob), true);
        if (r !== 'none') return r;
      }
    }
    return this.tryClip(FILE, false);
  }

  tryClip(src, revoke) {
    return new Promise((res) => {
      let a; try { a = new Audio(src); } catch { res('none'); return; }
      const done = (v) => { if (revoke && v !== 'ok') URL.revokeObjectURL(src); res(v); };
      if (revoke) a.onended = () => URL.revokeObjectURL(src);
      a.onerror = () => done('none');
      this.cur = a;
      a.play().then(() => done('ok')).catch((e) => done(e && e.name === 'NotAllowedError' ? 'blocked' : 'none'));
    });
  }

  async speak(auto = false, slot = this.slot()) {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    let voices = ss.getVoices();
    if (!voices.length) {
      await new Promise((ok) => { const t = setTimeout(ok, 800); ss.addEventListener('voiceschanged', () => { clearTimeout(t); ok(); }, { once: true }); });
      voices = ss.getVoices();
    }
    const u = new SpeechSynthesisUtterance(this.line(slot));
    const en = voices.filter(v => /^en/i.test(v.lang));
    u.voice = en.find(v => /female|samantha|zira|aria|jenny|susan|hazel|karen|moira|tessa|victoria|google us english/i.test(v.name)) || en[0] || null;
    u.lang = (u.voice && u.voice.lang) || 'en-US';
    u.pitch = 1.2; u.rate = 0.88; u.volume = 1;            // soft, unhurried, a little playful
    u.onerror = (e) => { if (auto && e && e.error === 'not-allowed') this.armTap(); };
    try { ss.cancel(); ss.speak(u); } catch {}
  }

  armTap() {
    if (this.armed) return;
    this.armed = true;
    document.addEventListener('pointerdown', () => { this.armed = false; this.play(false); }, { once: true });
  }

  /** Turns the greeting on/off (Settings → Greeting). Turning it on plays it once as a preview. */
  toggle() {
    this.state.greet = this.state.greet === false;
    this.app.store.save();
    this.app.settings.refreshSettingsUI();
    if (this.state.greet) this.play(false); else this.stop();
  }
}
