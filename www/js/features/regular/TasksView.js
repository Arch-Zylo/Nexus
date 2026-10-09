import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class TasksView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('btnAddTask').onclick = () => {
      const sheet = Dom.byId('sheetTask');
      if (sheet.classList.contains('open')) this.resetTaskForm();
      else this.openTaskForm(null);
    };
    Dom.byId('cancelTask').onclick = () => this.resetTaskForm();
    Dom.byId('saveTask').onclick = () => {
      const title = Dom.byId('t-title').value.trim();
      if (!title) { Dom.byId('t-title').focus(); return; }
      const editId = Dom.byId('t-edit-id').value;
      const payload = {
        title,
        sub: Dom.byId('t-sub').value.trim(),
        due: Dom.byId('t-due').value || Util.today(),
        notes: Dom.byId('t-notes').value.trim()
      };
      if (editId) {
        const idx = this.state.tasks.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.tasks[idx] = { ...this.state.tasks[idx], ...payload };
        this.app.store.save(); this.app.store.log(`Task updated · ${title}`, COLORS[0]);
      } else {
        this.state.tasks.push({ id: Util.id(), done: false, ...payload });
        this.app.store.save(); this.app.store.log(`Task · ${title}`, COLORS[0]);
      }
      this.resetTaskForm();
      this.drawTasks(); this.app.home.drawHome();
      this.app.notifications.scheduleDueTaskReminders();
    };
    Dom.byId('deleteTask').onclick = () => {
      const editId = Dom.byId('t-edit-id').value;
      if (!editId) return;
      const t = this.state.tasks.find(x => x.id === editId);
      if (!confirm(`Delete "${t ? t.title : 'this task'}"?`)) return;
      this.state.tasks = this.state.tasks.filter(x => x.id !== editId);
      this.app.store.save();
      this.resetTaskForm();
      this.drawTasks(); this.app.home.drawHome();
      this.app.notifications.scheduleDueTaskReminders();
    };
    Dom.byId('t-due').value = Util.today();
  }

  drawTasks() {
    const list = Dom.byId('taskList');
    const items = [...this.state.tasks].sort((a,b)=>a.due.localeCompare(b.due));
    list.innerHTML = items.length ? items.map(t => {
      const d = Util.daysOut(t.due);
      const overdue = !t.done && d < 0;
      return `<div class="card${t.done?' done':''}" data-tid="${t.id}" style="cursor:pointer;">
      <div class="card-bar" style="background:${t.done?COLORS[4]:(overdue?COLORS[1]:COLORS[0])}"></div>
      <div class="card-body">
        <div class="card-title">${Util.esc(t.title)}
          <span class="tag${overdue?' warn':(t.done?' ok':'')}">${t.done?'Done':(overdue?'Overdue':Util.rel(d))}</span>
        </div>
        <div class="card-info">${t.sub?Util.esc(t.sub)+' · ':''}${Util.parseD(t.due).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
        ${t.notes?`<div class="card-note">${Util.esc(t.notes)}</div>`:''}
      </div>
      <div class="card-ops">
        <button class="btn-icon${t.done?' active':''}" data-tog="${t.id}" title="${t.done?'Mark not done':'Mark done'}">✓</button>
      </div>
    </div>`;
    }).join('') : '<div class="empty">No tasks yet</div>';

    list.querySelectorAll('[data-tog]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const t = this.state.tasks.find(x => x.id === b.dataset.tog);
      if (t) { t.done = !t.done; this.app.store.save(); this.drawTasks(); this.app.home.drawHome(); this.app.notifications.scheduleDueTaskReminders(); }
    });

    list.querySelectorAll('[data-tid]').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('[data-tog]')) return;
        this.showTaskDetail(card.dataset.tid);
      };
    });
  }

  showTaskDetail(tid) {
    const t = this.state.tasks.find(x => x.id === tid);
    if (!t) return;
    const d = Util.daysOut(t.due);
    const overdue = !t.done && d < 0;
    Dom.byId('dlgTitle').textContent = 'Task';
    Dom.byId('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${Util.esc(t.title)}${t.done ? ' <span class="tag ok">Done</span>' : overdue ? ' <span class="tag warn">Overdue</span>' : ''}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Subject</span><span class="cd-v">${t.sub ? Util.esc(t.sub) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Due</span><span class="cd-v">${Util.parseD(t.due).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${t.notes ? Util.esc(t.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editTaskBtn">Edit</button>
        <button class="btn btn-ghost" id="delTaskBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editTaskBtn').onclick = () => {
      Dom.byId('backdrop').classList.remove('open');
      this.openTaskForm(t);
    };
    Dom.byId('delTaskBtn').onclick = () => {
      if (!confirm(`Delete "${t.title}"?`)) return;
      this.state.tasks = this.state.tasks.filter(x => x.id !== tid);
      this.app.store.save();
      Dom.byId('backdrop').classList.remove('open');
      this.drawTasks(); this.app.home.drawHome();
      this.app.notifications.scheduleDueTaskReminders();
    };
  }

  openTaskForm(t) {
    Dom.byId('t-edit-id').value = t ? t.id : '';
    Dom.byId('t-title').value = t ? (t.title || '') : '';
    Dom.byId('t-sub').value = t ? (t.sub || '') : '';
    Dom.byId('t-due').value = t ? (t.due || Util.today()) : Util.today();
    Dom.byId('t-notes').value = t ? (t.notes || '') : '';
    Dom.byId('deleteTask').hidden = !t;
    Dom.byId('sheetTask').classList.add('open');
    Dom.byId('t-title').focus();
  }

  resetTaskForm() {
    Dom.byId('t-edit-id').value = '';
    Dom.byId('t-title').value = '';
    Dom.byId('t-sub').value = '';
    Dom.byId('t-due').value = Util.today();
    Dom.byId('t-notes').value = '';
    Dom.byId('deleteTask').hidden = true;
    Dom.byId('sheetTask').classList.remove('open');
  }

  fillSubs() {
    const dl = Dom.byId('subList');
    const subs = [...new Set(this.state.classes.map(c=>c.sub).filter(Boolean))];
    dl.innerHTML = subs.map(s => `<option value="${Util.esc(s)}">`).join('');
  }
}
