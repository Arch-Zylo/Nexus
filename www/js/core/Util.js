export class Util {
  static isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  static id() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  static esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

  static today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  static parseD(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d); }

  static daysOut(iso) {
    return Math.round((Util.parseD(iso) - Util.parseD(Util.today())) / 864e5);
  }

  static rel(n) {
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n < 0) return `${Math.abs(n)}d ago`;
    return `In ${n}d`;
  }

  // A person's current age in whole years, computed from their birthday.
  static personAge(bday) {
    if (!bday) return null;
    const b = Util.parseD(bday);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const hadBirthdayThisYear = (now.getMonth() > b.getMonth()) ||
      (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate());
    if (!hadBirthdayThisYear) age--;
    return age;
  }

  // Days remaining until this person's next birthday (0 = today).
  static daysUntilBirthday(bday) {
    if (!bday) return null;
    const year = new Date().getFullYear();
    let d = Util.daysOut(bday.replace(/^\d{4}/, String(year)));
    if (d < 0) d = Util.daysOut(bday.replace(/^\d{4}/, String(year + 1)));
    return d;
  }

  static t12(t) {
    if (!t) return '';
    let [h,m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2,'0')} ${ap}`;
  }

  static mins(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }

  static bal(a) { return (a.tx||[]).reduce((s,t)=>s+t.amt,0); }

  static ago(ts) {
    const m = Math.floor((Date.now()-ts)/6e4);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m/60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }

  static fileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  }

  static fileTitle(file) {
    return (file.name || 'Untitled').replace(/\.[^.]+$/, '');
  }

  static natSort(a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }); }

  static isImg(n) { return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(n); }

  static isArc(n) { return /\.(cbz|zip)$/i.test(n); }

  static stripExt(n) { return n.replace(/\.[^.]+$/, ''); }

  static mimeOf(n) { return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' })[(n.split('.').pop() || '').toLowerCase()] || 'image/jpeg'; }

  static hueOf(s) { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

  static artStyle(t) { const h = Util.hueOf(t); return `background-image:linear-gradient(135deg,hsl(${h},55%,38%),hsl(${(h + 50) % 360},60%,22%))`; }

  static fmtT(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  static artistOf(m) { return m.artist || 'Unknown artist'; }

  // a video is "in progress" once you're past the intro and not at the very end (scaled for short clips)
  static resumable(v) { return !!(v && v.dur && v.pos > Math.min(5, v.dur * 0.1) && v.pos < v.dur - Math.min(8, v.dur * 0.1)); }
}
