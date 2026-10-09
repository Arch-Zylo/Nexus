import { Component } from '../../core/Component.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class StoriesView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('btnAddStory')?.addEventListener('click', () => {
      const sheet = Dom.byId('sheetStory');
      if (sheet.classList.contains('open')) this.resetStoryForm(); else this.openStoryForm(null);
    });
    Dom.byId('cancelStory')?.addEventListener('click', this.resetStoryForm);
    Dom.byId('saveStory')?.addEventListener('click', () => {
      const title = Dom.byId('st-title').value.trim();
      const body = Dom.byId('st-body').value.trim();
      if (!title || !body) { (title?Dom.byId('st-body'):Dom.byId('st-title')).focus(); return; }
      const editId = Dom.byId('st-edit-id').value;
      if (editId) {
        const idx = this.state.chillStories.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.chillStories[idx] = { ...this.state.chillStories[idx], title, body };
      } else {
        this.state.chillStories.push({ id: Util.id(), title, body, ts: Date.now() });
      }
      this.app.store.save(); this.resetStoryForm(); this.drawStories();
    });
    Dom.byId('deleteStory')?.addEventListener('click', () => {
      const editId = Dom.byId('st-edit-id').value;
      if (!editId) return;
      if (!confirm('Delete this story?')) return;
      this.state.chillStories = this.state.chillStories.filter(x => x.id !== editId);
      this.app.store.save(); this.resetStoryForm(); this.drawStories();
    });
  }

  drawStories() {
    const el = Dom.byId('storyList');
    if (!el) return;
    const items = [...this.state.chillStories].sort((a,b) => (b.ts||0)-(a.ts||0));
    el.innerHTML = items.length ? items.map(s => {
      const preview = (s.body || '').replace(/\s+/g,' ').trim().slice(0, 90);
      return `<div class="chill-row" data-story="${s.id}">
      <div class="chill-row-main">
        <div class="chill-row-title">${Util.esc(s.title)}</div>
        <div class="chill-row-sub">${Util.esc(preview)}${(s.body||'').length>90?'…':''}</div>
      </div>
    </div>`;
    }).join('') : '<div class="empty">No stories yet — tap + Story to write one</div>';
    el.querySelectorAll('[data-story]').forEach(row => {
      row.addEventListener('click', () => this.showStoryDetail(row.dataset.story));
    });
  }

  showStoryDetail(sid) {
    const s = this.state.chillStories.find(x => x.id === sid);
    if (!s) return;
    Dom.byId('dlgTitle').textContent = 'Story';
    Dom.byId('dlgBody').innerHTML = `
    <div class="note-full-title">${Util.esc(s.title)}</div>
    <div class="note-full-body">${Util.esc(s.body)}</div>
    <div class="note-full-meta">${s.ts ? Util.ago(s.ts) : ''}</div>
    <div class="cd-actions" style="margin-top:16px;">
      <button class="btn btn-gold" id="editStoryBtn">Edit</button>
      <button class="btn btn-ghost" id="delStoryBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editStoryBtn').onclick = () => { this.app.dialog.closeDialog(); this.openStoryForm(s); };
    Dom.byId('delStoryBtn').onclick = () => {
      if (!confirm('Delete this story?')) return;
      this.state.chillStories = this.state.chillStories.filter(x => x.id !== sid);
      this.app.store.save(); this.app.dialog.closeDialog(); this.drawStories();
    };
  }

  openStoryForm(s) {
    Dom.byId('st-edit-id').value = s ? s.id : '';
    Dom.byId('st-title').value = s ? (s.title||'') : '';
    Dom.byId('st-body').value = s ? (s.body||'') : '';
    Dom.byId('deleteStory').hidden = !s;
    Dom.byId('sheetStory').classList.add('open');
    Dom.byId('st-title').focus();
  }

  resetStoryForm() {
    Dom.byId('st-edit-id').value = '';
    Dom.byId('st-title').value = '';
    Dom.byId('st-body').value = '';
    Dom.byId('deleteStory').hidden = true;
    Dom.byId('sheetStory').classList.remove('open');
  }
}
