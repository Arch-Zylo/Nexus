import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Dom } from '../../core/Dom.js';
import { Util } from '../../core/Util.js';

export class NotesView extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.noteTimer = null;
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    ['n-title', 'n-body'].forEach(i => Dom.byId(i).addEventListener('input', () => {
      Dom.byId('noteStatus').textContent = 'Saving…';
      clearTimeout(this.noteTimer);
      this.noteTimer = setTimeout(this.commitNote, 600);
    }));
    Dom.byId('btnAddNote').onclick = () => this.openNoteForm(null);
    Dom.byId('noteBack').onclick = () => this.app.overlays.close(this.closeNoteEditor);
    Dom.byId('deleteNote').onclick = () => {
      const editId = Dom.byId('n-edit-id').value;
      if (!editId || !confirm('Delete this note?')) return;
      this.state.notes = this.state.notes.filter(x => x.id !== editId);
      this.app.store.save();
      Dom.byId('n-edit-id').value = '';
      this.app.overlays.close(this.closeNoteEditor);
    };
  }

  drawNotes() {
    const grid = Dom.byId('noteGrid');
    const items = [...this.state.notes].sort((a,b)=>(b.ts||0)-(a.ts||0));
    grid.innerHTML = items.length ? items.map(n => {
      const preview = (n.body || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<div class="note" data-nid="${n.id}">
      ${n.title ? `<h3>${Util.esc(n.title)}</h3>` : ''}
      <div class="preview">${Util.esc(preview)}${(n.body||'').length > 90 ? '…' : ''}</div>
      <div class="when">${n.ts ? Util.ago(n.ts) : ''}</div>
    </div>`;
    }).join('') : '<div class="empty">No notes yet</div>';

    grid.querySelectorAll('[data-nid]').forEach(card => {
      card.onclick = () => this.openNoteForm(this.state.notes.find(x => x.id === card.dataset.nid));
    });
  }

  openNoteForm(n) {
    if (Dom.byId('noteEditor').hidden) this.app.overlays.open(this.closeNoteEditor);
    Dom.byId('n-edit-id').value = n ? n.id : '';
    Dom.byId('n-title').value = n ? (n.title || '') : '';
    Dom.byId('n-body').value = n ? (n.body || '') : '';
    Dom.byId('deleteNote').hidden = !n;
    Dom.byId('noteStatus').textContent = '';
    Dom.byId('noteList').hidden = true;
    Dom.byId('noteEditor').hidden = false;
    window.scrollTo(0, 0);
    if (!n) Dom.byId('n-title').focus();
  }

  // Auto-save like Google Keep: create/update as you type, discard empty notes.
  commitNote() {
    clearTimeout(this.noteTimer);
    const title = Dom.byId('n-title').value.trim();
    const body = Dom.byId('n-body').value.trim();
    const editId = Dom.byId('n-edit-id').value;
    if (!title && !body) {
      if (editId) {
        this.state.notes = this.state.notes.filter(x => x.id !== editId);
        Dom.byId('n-edit-id').value = '';
        Dom.byId('deleteNote').hidden = true;
        this.app.store.save();
      }
      return;
    }
    const cur = editId && this.state.notes.find(x => x.id === editId);
    if (cur) {
      if (cur.title === title && cur.body === body) return;
      cur.title = title; cur.body = body; cur.ts = Date.now();
    } else {
      const nid = Util.id();
      this.state.notes.push({ id: nid, title, body, ts: Date.now() });
      Dom.byId('n-edit-id').value = nid;
      Dom.byId('deleteNote').hidden = false;
      this.app.store.log(`Note · ${title || body.slice(0, 30)}`, COLORS[5]);
    }
    this.app.store.save();
    Dom.byId('noteStatus').textContent = 'Saved';
  }

  closeNoteEditor() {
    this.commitNote();
    Dom.byId('noteEditor').hidden = true;
    Dom.byId('noteList').hidden = false;
    this.drawNotes();
  }
}
