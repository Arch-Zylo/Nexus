/* Application constants — plain data shared across the app. */

/* ============================================================
   NEXUS — Original student planner
   Built from scratch · localStorage · zero dependencies
   ============================================================ */
export const KEY = 'nexus-v1';
export const BACKUP_KEY = 'nexus-v1-backup';
export const LOCK_KEY = 'nexus-applock-v1';   // app-lock PIN hash + settings; kept out of the main store so it never lands in backups
export const COLORS = [
  '#f5c15a','#f07178','#b794f6','#6bb3f0','#5dcea6','#e8a87c','#c38d9e','#41b3a3',
  '#ff6b6b','#feca57','#48dbfb','#1dd1a1','#5f27cd','#ff9ff3','#54a0ff','#00d2d3',
  '#ee5a24','#a3cb38','#1289a7','#d980fa','#b71540','#0a3d62','#e58e26','#cad3c8'
];
export const DAYS = ['','Mon','Tue','Wed','Thu','Fri'];
export const DAYS_FULL = ['','Monday','Tuesday','Wednesday','Thursday','Friday'];
// Fixed spending categories for expense transactions + the Home pie chart.
export const BASE_SPEND_CATS = [
  { key: 'medical', label: 'Medical', color: '#ff3b3b' },
  { key: 'food', label: 'Food', color: '#ffd400' },
  { key: 'snack', label: 'Snack', color: '#ff9500' },
  { key: 'transportation', label: 'Transportation', color: '#1e6fff' },
  { key: 'school', label: 'School Payment', color: '#7b2fe0' },
  { key: 'other', label: 'Other', color: '#00b358' },
];
export const CAT_PALETTE = ['#e84393', '#00cec9', '#fdcb6e', '#6c5ce7', '#fab1a0', '#55efc4', '#74b9ff', '#e17055'];
export const APP_VERSION = '1.5.0';
export const APP_CHANNEL = 'beta';
export const APP_VERSION_LABEL = 'v1.5.0 (beta)';
/* Theme — dark themes only (no light mode) */
export const THEMES = [
  { id: 'night', label: 'Night' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'starry', label: 'Starry Night' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'ember', label: 'Ember' },
  { id: 'forest', label: 'Forest' },
  { id: 'violet', label: 'Violet' },
  { id: 'slate', label: 'Slate' },
  { id: 'crimson', label: 'Crimson' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'carbon', label: 'Carbon' }
];
/* Style — layout feel (not color) */
export const STYLES = [
  { id: 'soft', label: 'Soft' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'round', label: 'Round' },
  { id: 'compact', label: 'Compact' },
  { id: 'dense', label: 'Dense' }
];
/* ---------- Chill Mode: file storage (IndexedDB) ----------
   Imported music/video/manga files are real binary data, far too big for
   localStorage (which backs `store`), so the actual bytes live in an
   IndexedDB object store keyed by id. Only lightweight metadata (title,
   type, size, dateAdded) lives in store.chillMedia / store.chillStories,
   which is why imports aren't included in the JSON backup export. */
export const CHILL_DB_NAME = 'nexus-chill';
export const CURRENCIES = ['$', '₱', '€', '£', '¥', '₹', '₩', 'Rp'];
/* ---------- TIMETABLE NOTIFICATIONS ----------
   Works two ways:
   - Installed app (Capacitor/Android): uses @capacitor/local-notifications
     to schedule real, repeating weekly alarms that fire even if the app
     is closed.
   - Browser preview: best-effort foreground watcher using the Web
     Notification API (only fires while this tab is open).
   Each class can use the global default lead time, override it, or opt
   out of reminders entirely. */
export const LEAD_OPTIONS = [5, 10, 15, 30, 60];
export const ARC_ACCEPT = '.cbz,.zip,application/zip,application/x-zip-compressed,application/x-cbz,application/vnd.comicbook+zip,application/octet-stream';
/* ⋮ menus, share, delete */
export const REPEAT_LABEL = { all: 'Repeat: all', one: 'Repeat: this song', off: 'Repeat: off' };
export const AUDIO_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac' };
export const MODE_LABEL = { vertical: '⇵ Scroll', ltr: '→ LTR', rtl: '← RTL' };
/* First-run Terms */
export const TOS_KEY = 'nexus-tos-v2';
