import { Component } from '../../core/Component.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class PasswordsView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('passBack')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hidePassPanel();
    });
    /* Password list actions (delegation) */
    Dom.byId('passList')?.addEventListener('click', async (e) => {
      const show = e.target.closest('[data-show]');
      const copy = e.target.closest('[data-copy]');
      const del = e.target.closest('[data-delpw]');
      if (show) {
        const p = (this.state.passwords || []).find(x => x.id === show.dataset.show);
        if (!p) return;
        const el = document.querySelector(`[data-val="${p.id}"]`);
        if (!el) return;
        if (el.dataset.shown === '1') {
          el.textContent = '••••••••';
          el.dataset.shown = '0';
          show.textContent = 'Show';
        } else {
          el.textContent = p.pass;
          el.dataset.shown = '1';
          show.textContent = 'Hide';
        }
      } else if (copy) {
        const p = (this.state.passwords || []).find(x => x.id === copy.dataset.copy);
        if (!p) return;
        try {
          await navigator.clipboard.writeText(p.pass);
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
        } catch {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = p.pass;
          document.body.appendChild(ta);
          ta.select();
          const okc = document.execCommand('copy');
          ta.remove();
          if (!okc) { this.app.toast.show('Could not copy the password.', 'err'); return; }
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
        }
      } else if (del) {
        if (!confirm('Delete this password?')) return;
        this.state.passwords = (this.state.passwords || []).filter(x => x.id !== del.dataset.delpw);
        this.app.store.save();
        this.drawPasswords();
      } else {
        const card = e.target.closest('.pass-card[data-pid]');
        if (card) this.showPasswordDetail(card.dataset.pid);
      }
    });
    Dom.byId('btnAddPass')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openPassForm(null);
    });
    Dom.byId('cancelPass')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.resetPassForm();
    });
    Dom.byId('savePass')?.addEventListener('click', (e) => {
      e.preventDefault();
      const site = Dom.byId('pw-site')?.value.trim();
      const user = Dom.byId('pw-user')?.value.trim() || '';
      const pass = Dom.byId('pw-pass')?.value || '';
      const notes = Dom.byId('pw-notes')?.value.trim() || '';
      if (!site) { Dom.byId('pw-site')?.focus(); return; }
      if (!pass) { Dom.byId('pw-pass')?.focus(); return; }
      const editId = Dom.byId('pw-edit-id')?.value || '';
      this.state.passwords = this.state.passwords || [];
      if (editId) {
        const idx = this.state.passwords.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.passwords[idx] = { ...this.state.passwords[idx], site, user, pass, notes };
        this.app.store.save();
      } else {
        this.state.passwords.push({ id: Util.id(), site, user, pass, notes });
        this.app.store.save();
      }
      this.resetPassForm();
      this.drawPasswords();
    });
    Dom.byId('deletePass')?.addEventListener('click', (e) => {
      e.preventDefault();
      const editId = Dom.byId('pw-edit-id')?.value || '';
      if (!editId) return;
      if (!confirm('Delete this password?')) return;
      this.state.passwords = (this.state.passwords || []).filter(x => x.id !== editId);
      this.app.store.save();
      this.resetPassForm();
      this.drawPasswords();
    });
  }

  showPassPanel() {
    const main = Dom.byId('settingsMain');
    const panel = Dom.byId('passPanel');
    if (panel && panel.hasAttribute('hidden')) this.app.overlays.open(this.hidePassPanel);
    if (main) main.style.display = 'none';
    if (panel) {
      panel.removeAttribute('hidden');
      panel.style.display = 'block';
    }
    this.drawPasswords();
  }

  hidePassPanel() {
    this.app.overlays.release(this.hidePassPanel);
    const main = Dom.byId('settingsMain');
    const panel = Dom.byId('passPanel');
    if (panel) {
      panel.setAttribute('hidden', '');
      panel.style.display = 'none';
    }
    if (main) main.style.display = '';
    if (Dom.byId('sheetPass')) this.resetPassForm();
  }

  drawPasswords() {
    const list = Dom.byId('passList');
    if (!list) return;
    this.state.passwords = this.state.passwords || [];
    const items = this.state.passwords;
    list.innerHTML = items.length ? items.map(p => `
    <div class="pass-card" data-pid="${p.id}" style="cursor:pointer;">
      <div class="pass-site">${Util.esc(p.site)}</div>
      <div class="pass-user">${Util.esc(p.user || '—')}</div>
      <div class="pass-row">
        <div class="pass-val" data-val="${p.id}">••••••••</div>
        <button type="button" class="btn-icon" data-show="${p.id}" title="Show">Show</button>
        <button type="button" class="btn-icon" data-copy="${p.id}" title="Copy">Copy</button>
        <button type="button" class="btn-icon" data-delpw="${p.id}" title="Delete">Del</button>
      </div>
      ${p.notes ? `<div style="font-size:0.75rem;color:var(--mist);margin-top:6px;">${Util.esc(p.notes)}</div>` : ''}
    </div>`).join('') : '<div class="empty" style="padding:12px 0;">No passwords yet — tap + Add</div>';
  }

  showPasswordDetail(pid) {
    const p = (this.state.passwords || []).find(x => x.id === pid);
    if (!p) return;
    Dom.byId('dlgTitle').textContent = 'Password';
    Dom.byId('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${Util.esc(p.site)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Username</span><span class="cd-v">${p.user ? Util.esc(p.user) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${p.notes ? Util.esc(p.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editPassBtn">Edit</button>
        <button class="btn btn-ghost" id="delPassBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editPassBtn').onclick = () => {
      Dom.byId('backdrop').classList.remove('open');
      this.openPassForm(p);
    };
    Dom.byId('delPassBtn').onclick = () => {
      if (!confirm('Delete this password?')) return;
      this.state.passwords = (this.state.passwords || []).filter(x => x.id !== pid);
      this.app.store.save();
      Dom.byId('backdrop').classList.remove('open');
      this.drawPasswords();
    };
  }

  openPassForm(p) {
    const sheet = Dom.byId('sheetPass');
    if (!sheet) return;
    Dom.byId('pw-edit-id').value = p ? p.id : '';
    Dom.byId('pw-site').value = p ? (p.site || '') : '';
    Dom.byId('pw-user').value = p ? (p.user || '') : '';
    Dom.byId('pw-pass').value = p ? (p.pass || '') : '';
    Dom.byId('pw-notes').value = p ? (p.notes || '') : '';
    Dom.byId('deletePass').hidden = !p;
    sheet.classList.add('open');
    sheet.style.display = 'block';
    Dom.byId('pw-site')?.focus();
  }

  resetPassForm() {
    const sheet = Dom.byId('sheetPass');
    Dom.byId('pw-edit-id').value = '';
    ['pw-site','pw-user','pw-pass','pw-notes'].forEach(id => {
      const el = Dom.byId(id);
      if (el) el.value = '';
    });
    Dom.byId('deletePass').hidden = true;
    if (sheet) { sheet.classList.remove('open'); sheet.style.display = ''; }
  }
}
