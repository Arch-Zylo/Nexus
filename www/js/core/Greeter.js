import { Component } from './Component.js';
import { Dom } from './Dom.js';

const FILE = 'assets/greeting.mp3';   // optional: drop your own clip here and it plays instead of the built-in voice

/**
 * Spoken greeting, once per app launch. It never repeats while the app stays open (coming back from the
 * background is not a new launch). It waits for the Terms gate and the app lock, and if the system blocks
 * autoplay it plays on the first tap instead.
 */
export class Greeter extends Component {
  constructor(app) {
    super(app);
    this.done = false;        // already greeted in this launch
    this.armed = false;       // waiting for a first tap because autoplay was blocked
  }

  init() {
    document.addEventListener('visibilitychange', () => { if (document.hidden) { try { speechSynthesis.cancel(); } catch {} } });
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

  line() {
    const n = (this.state.name || '').trim();
    return n ? `Ara ara... welcome back, ${n}. I've been waiting for you.` : `Ara ara... welcome back. I've been waiting for you.`;
  }

  /** Plays the greeting. `auto` = launched by the app (so a blocked autoplay waits for a tap); a Settings tap passes false. */
  async play(auto = false) {
    const r = await this.playFile();
    if (r === 'ok') return;
    if (r === 'blocked') { if (auto) this.armTap(); return; }
    this.speak(auto);
  }

  playFile() {
    return new Promise((res) => {
      let a; try { a = new Audio(FILE); } catch { res('none'); return; }
      a.onerror = () => res('none');                       // no clip supplied → use the built-in voice
      a.onended = () => res('ok');
      a.play().then(() => res('ok')).catch((e) => res(e && e.name === 'NotAllowedError' ? 'blocked' : 'none'));
    });
  }

  async speak(auto = false) {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    let voices = ss.getVoices();
    if (!voices.length) {
      await new Promise((ok) => { const t = setTimeout(ok, 800); ss.addEventListener('voiceschanged', () => { clearTimeout(t); ok(); }, { once: true }); });
      voices = ss.getVoices();
    }
    const u = new SpeechSynthesisUtterance(this.line());
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

  /** Settings row: turn the greeting on/off. Turning it on plays it once as a preview. */
  toggle() {
    this.state.greet = this.state.greet === false;
    this.app.store.save();
    this.app.settings.refreshSettingsUI();
    if (this.state.greet) this.play(false);
    else { try { speechSynthesis.cancel(); } catch {} }
  }
}
