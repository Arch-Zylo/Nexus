/** Small helpers for motion preferences and one-shot visual effects. */
export class Motion {
  /** True when the OS asks for reduced motion — skip or shorten animations. */
  static reduced() {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Briefly add a class to <html> (used for the theme / mode cross-fades). */
  static flash(cls, ms = 500) {
    if (Motion.reduced()) return;
    const h = document.documentElement;
    h.classList.add(cls);
    clearTimeout(h['_t_' + cls]);
    h['_t_' + cls] = setTimeout(() => h.classList.remove(cls), ms);
  }

  static sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
