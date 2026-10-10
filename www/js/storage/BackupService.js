import { Component } from '../core/Component.js';
import { APP_VERSION, BACKUP_KEY, LOCK_KEY, KEY } from '../core/constants.js';
import { Platform } from '../core/Platform.js';
import { Util } from '../core/Util.js';
import { MangaModel } from '../features/chill/manga/MangaModel.js';
import { ZipArchive } from './ZipArchive.js';
import { ZipWriter } from './ZipWriter.js';
import { Dom } from '../core/Dom.js';

export class BackupService extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('importFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      const msg = Dom.byId('dataMsg');
      const say = (t, c) => { if (msg) { msg.textContent = t; msg.style.color = c || 'var(--fog)'; } };
      try {
        const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
        if (head[0] === 0x50 && head[1] === 0x4b) { await this.restoreNexusBackup(f, say); return; }
        this.app.progress.start('Importing backup', f.name);
        const ns = this.app.store.normalizeStore(JSON.parse(await f.text()));
        if (!ns) { this.app.progress.finish(false, 'Not a valid backup — nothing changed'); say('This file is not a valid Nexus backup. Nothing was changed.', 'var(--coral)'); return; }
        this.state = ns; this.app.store.save(); this.app.theme.applyTheme(this.state.theme || 'night'); this.app.mode.applyMode(this.state.mode); this.app.boot();
        this.app.progress.finish(true, 'Backup imported');
        say('Imported successfully (data only — this file contains no music, videos or manga).', 'var(--mint)');
      } catch (err) {
        this.app.progress.finish(false, 'Could not read that file');
        console.warn('Nexus: import failed', err);
        say('Could not read that file. Nothing was changed.', 'var(--coral)');
      }
    };
  }

  async buildNexusBackup(json, say) {
    const keys = [];
    for (const m of this.state.chillMedia) { if (m.type === 'manga') MangaModel.mangaAllPages(m).forEach(p => keys.push(p.id)); else keys.push(m.id); }
    const entries = [], files = []; let missing = 0;
    for (let i = 0; i < keys.length; i++) {
      const b = await this.app.mediaDb.getBlob(keys[i]).catch(() => null);
      if (!b) { missing++; continue; }
      entries.push({ name: 'media/' + encodeURIComponent(keys[i]), blob: b }); files.push({ key: keys[i], type: b.type || '' });
      if (i % 10 === 0) say?.(`Reading media… ${i + 1}/${keys.length}`);
    }
    const manifest = { format: 'nexusbackup', backupVersion: 2, appVersion: APP_VERSION, createdAt: new Date().toISOString(), files, missing };
    entries.unshift({ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest)]) }, { name: 'data.json', blob: new Blob([json]) });
    const zip = await ZipWriter.build(entries, (i, n) => { if (i % 10 === 0) say?.(`Packing backup… ${i}/${n}`); });
    if (missing) this.app.toast.show(`${missing} media file${missing === 1 ? ' was' : 's were'} missing on this device and not included.`, 'err', 6000);
    return zip;
  }

  async restoreNexusBackup(file, say) {
    const NP = this.app.progress;
    NP.start('Restoring backup', 'Reading backup file…');
    try { return await this.restoreNexusBackupInner(file, say, NP); }
    catch (e) { NP.finish(false, 'Could not restore'); throw e; }
  }

  async restoreNexusBackupInner(file, say, NP) {
    const zip = await ZipArchive.open(file), all = Array.from(zip.entries);
    const ent = (n) => all.find(x => x.name === n);
    const de = ent('data.json'); if (!de) throw new Error('no data.json');
    const ns = this.app.store.normalizeStore(JSON.parse(await (await de.read()).text()));
    if (!ns) { NP.finish(false, 'Invalid backup — nothing changed'); say('This backup is invalid or from an unsupported version. Nothing was changed.', 'var(--coral)'); return; }
    const types = {}, me = ent('manifest.json');
    if (me) { try { (JSON.parse(await (await me.read()).text()).files || []).forEach(x => { types[x.key] = x.type; }); } catch {} }
    await this.app.mediaDb.clearAll().catch(() => {});
    const media = all.filter(x => x.name.startsWith('media/'));
    let n = 0, bad = 0;
    if (media.length) NP.update(0, `0 of ${media.length} media files`, 'Restoring media');
    for (const e of media) {
      try { const key = decodeURIComponent(e.name.slice(6)); await this.app.mediaDb.put(key, await e.read(types[key] || '')); n++; } catch { bad++; }
      NP.update((n + bad) / media.length, `${n + bad} of ${media.length} media files`, 'Restoring media');
      if ((n + bad) % 5 === 0) say(`Restoring media… ${n + bad}/${media.length}`);
    }
    NP.busy('Finishing up', 'Applying your data…');
    this.app.thumbs.thumbUrls.forEach(u => URL.revokeObjectURL(u)); this.app.thumbs.thumbUrls.clear(); this.app.thumbs.thumbBad.clear();
    this.state = ns; this.app.store.save(); this.app.theme.applyTheme(this.state.theme || 'night'); this.app.mode.applyMode(this.state.mode); this.app.boot();
    NP.finish(!bad, bad ? `${n} restored · ${bad} failed` : 'Backup restored');
    say(bad ? `Restored, but ${bad} media file${bad === 1 ? '' : 's'} could not be written (storage may be full).` : `Restored everything, including ${n} media file${n === 1 ? '' : 's'}.`, bad ? 'var(--coral)' : 'var(--mint)');
  }

  async writeBlobNative(FS, filename, blob) {
    const CH = 3 * 1024 * 1024; let uri = null;
    const b64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
    for (let o = 0; o < blob.size; o += CH) {
      const data = await b64(blob.slice(o, o + CH));
      if (o === 0) uri = (await FS.writeFile({ path: filename, data, directory: 'CACHE' })).uri;
      else await FS.appendFile({ path: filename, data, directory: 'CACHE' });
    }
    return { uri };
  }

  /* Wipe data — 3 different confirmations */
  async wipeAllData() {
    if (!confirm('1/3 — Delete ALL data?\n\nClasses, events, tasks, people, notes, wallet, passwords — everything.')) return;
    if (!confirm('2/3 — This cannot be undone.\n\nHave you exported a backup?\nPress OK only if you are sure.')) return;
    const typed = prompt('3/3 — Type WIPE (all caps) to permanently erase everything:');
    if (typed !== 'WIPE') {
      const msg = Dom.byId('dataMsg');
      if (msg) { msg.textContent = 'Wipe cancelled.'; msg.style.color = 'var(--fog)'; }
      return;
    }
    await this.performWipe();
    this.app.passwords.hidePassPanel();
    this.app.settings.refreshSettingsUI();
    const msg2 = Dom.byId('dataMsg');
    if (msg2) { msg2.textContent = 'All data wiped — including media files and the on-device backup.'; msg2.style.color = 'var(--coral)'; }
  }

  /** The actual erase (no prompts). Also used by "Forgot PIN" on the lock screen. */
  async performWipe() {
    try { [KEY, BACKUP_KEY, BACKUP_KEY + '-ts', 'nexus_mg_mode', LOCK_KEY].forEach(k => localStorage.removeItem(k)); } catch {}
    try { await this.app.mediaDb.clearAll(); } catch {}
    try { this.app.audio.chillAudio.pause(); this.app.audio.chillAudio.removeAttribute('src'); Dom.byId('miniPlayer').hidden = true; } catch {}
    this.app.thumbs.thumbUrls.forEach(u => URL.revokeObjectURL(u)); this.app.thumbs.thumbUrls.clear(); this.app.thumbs.thumbBad.clear();
    try { this.app.lock.cfg = null; } catch {}      // the lock key was just removed above
    this.state = this.app.store.defaultStore();
    this.app.store.save();
    this.app.theme.applyTheme('night');
    this.app.theme.applyStyle('soft');
    this.app.boot();
  }

  async doExport() {
    const json = JSON.stringify({ backupVersion: 2, appVersion: APP_VERSION, createdAt: new Date().toISOString(), data: this.state }, null, 2);
    const msg = Dom.byId('dataMsg');
    const stamp = Util.today(); // YYYY-MM-DD
    let filename = `nexus-backup-${stamp}.json`;

    // Always keep an on-device fallback copy too (used by "Restore from your
    // local backup" in the import flow), regardless of how the file export
    // below goes.
    try {
      localStorage.setItem(BACKUP_KEY, json);
      localStorage.setItem(BACKUP_KEY + '-ts', String(Date.now()));
    } catch {}

    // Full backup (.nexusbackup) when there is Chill media; plain JSON otherwise.
    let fileBlob = null;
    if (this.state.chillMedia.length) {
      const say = (t) => { if (msg) { msg.textContent = t; msg.style.color = 'var(--fog)'; } };
      try { fileBlob = await this.buildNexusBackup(json, say); filename = `nexus-backup-${stamp}.nexusbackup`; }
      catch (e) { console.warn(e); this.app.toast.show((e && e.message) || 'Could not pack media.', 'err', 6000); fileBlob = null; if (!confirm('Media could not be packed. Export data only (no music, videos or manga)?')) return; }
    }
    if (Platform.isNative()) {
      // On Android there is no plain browser "Save As" dialog inside a
      // WebView, so we write the backup to the app's cache and hand it to
      // the native Share sheet — that's what lets the user pick exactly
      // where it goes (Files, Drive, email, etc.) and see it land there.
      const FS = window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
      const ShareP = window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      if (!FS) {
        if (msg) { msg.textContent = 'Export failed — Filesystem plugin unavailable.'; msg.style.color = 'var(--coral)'; }
        return;
      }
      try {
        const written = fileBlob ? await this.writeBlobNative(FS, filename, fileBlob) : await FS.writeFile({ path: filename, data: json, directory: 'CACHE', encoding: 'utf8' });
        if (ShareP) {
          await ShareP.share({
            title: 'Nexus backup',
            text: 'Nexus Student OS backup — ' + filename,
            url: written.uri,
            dialogTitle: 'Save your Nexus backup'
          });
          if (msg) { msg.textContent = `Backup ready as ${filename} — choose where to save it.`; msg.style.color = 'var(--mint)'; }
        } else {
          if (msg) { msg.textContent = `Backup written to app storage as ${filename}, but the Share plugin is unavailable to save it elsewhere.`; msg.style.color = 'var(--mint)'; }
        }
      } catch (e) {
        // The user cancelling the share sheet also lands here on some
        // Android versions — the local-storage backup above still exists.
        console.warn('Nexus: export share failed', e);
        if (msg) { msg.textContent = 'Export saved to local storage only (share was cancelled or failed).'; msg.style.color = 'var(--fog)'; }
      }
    } else {
      // Static-site / browser build: trigger a real file download so the
      // backup is a visible file the user's browser Save-As / Downloads
      // flow handles, not just an invisible localStorage write.
      try {
        const blob = fileBlob || new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        if (msg) { msg.textContent = `Backup downloaded as ${filename}.`; msg.style.color = 'var(--mint)'; }
      } catch (e) {
        console.warn('Nexus: export download failed', e);
        if (msg) { msg.textContent = 'Export failed — local storage may be full.'; msg.style.color = 'var(--coral)'; }
      }
    }
  }
}
