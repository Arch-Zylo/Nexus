import { Component } from '../../core/Component.js';
import { COLORS, DAYS, DAYS_FULL } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class TimetableView extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.pickColor = COLORS[0];
    this.ttMode = 'classes';
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    this.chips(Dom.byId('c-chips'));
    Dom.byId('c-color')?.addEventListener('input', e => {
      this.pickColor = e.target.value;
      this.chips(Dom.byId('c-chips'));
    });
    Dom.byId('btnAddClass').onclick = () => {
      const sheet = Dom.byId('sheetClass');
      if (sheet.classList.contains('open')) this.resetClassForm();
      else this.openClassForm(null);
    };
    Dom.byId('cancelClass').onclick = () => this.resetClassForm();
    Dom.byId('saveClass').onclick = () => {
      const sub = Dom.byId('c-sub').value.trim();
      if (!sub) { Dom.byId('c-sub').focus(); return; }
      const editId = Dom.byId('c-edit-id').value;
      const payload = {
        sub,
        room: Dom.byId('c-room').value.trim(),
        inst: Dom.byId('c-inst').value.trim(),
        day: Dom.byId('c-day').value,
        start: Dom.byId('c-start').value,
        end: Dom.byId('c-end').value,
        lab: Dom.byId('c-lab').checked,
        notify: Dom.byId('c-notify').checked,
        notifyLead: Dom.byId('c-notify-lead').value ? Number(Dom.byId('c-notify-lead').value) : null,
        color: this.pickColor
      };
      if (editId) {
        const idx = this.state.classes.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.classes[idx] = { ...this.state.classes[idx], ...payload };
        this.app.store.save(); this.app.store.log(`Updated · ${sub}`, this.pickColor);
      } else {
        this.state.classes.push({ id: Util.id(), ...payload });
        this.app.store.save(); this.app.store.log(`Class · ${sub}`, this.pickColor);
      }
      this.resetClassForm();
      this.drawBoard(); this.app.home.drawHome(); this.app.tasks.fillSubs();
      this.app.notifications.scheduleAllClassNotifications();
    };
    document.querySelectorAll('.tt-mode').forEach(btn => {
      btn.addEventListener('click', () => this.setTtMode(btn.dataset.ttMode));
    });
  }

  /* Color chips + free color picker */
  chips(el) {
    if (!el) return;
    el.innerHTML = COLORS.map(c =>
      `<button type="button" class="chip${c.toLowerCase()===this.pickColor.toLowerCase()?' on':''}" style="background:${c}" data-c="${c}"></button>`
    ).join('');
    el.querySelectorAll('.chip').forEach(c => c.onclick = () => {
      this.pickColor = c.dataset.c;
      const inp = Dom.byId('c-color');
      if (inp) inp.value = this.pickColor;
      this.chips(el);
    });
  }

  drawBoard() {
    const grid = Dom.byId('board');
    const startH = 7, endH = 20, slots = (endH - startH) * 2; // 26 half-hour slots
    let html = '<div class="b-head"></div>';
    for (let d = 1; d <= 5; d++) html += `<div class="b-head">${DAYS[d]}</div>`;
    for (let i = 0; i < slots; i++) {
      const m = startH * 60 + i * 30;
      const h = Math.floor(m / 60), mm = m % 60;
      const label = mm === 0 ? (h > 12 ? h - 12 : h) + (h >= 12 ? 'p' : 'a') : '';
      html += `<div class="b-time">${label}</div>`;
      for (let d = 1; d <= 5; d++) html += `<div class="b-cell" data-d="${d}" data-m="${m}"></div>`;
    }
    grid.innerHTML = html;

    // After layout, measure one cell height so blocks scale with the fitted grid
    const sample = grid.querySelector('.b-cell');
    const cellH = sample ? sample.getBoundingClientRect().height : 20;

    this.state.classes.forEach(c => {
      const sm = Util.mins(c.start), em = Util.mins(c.end);
      const day = +c.day;
      if (day < 1 || day > 5) return;
      const si = Math.max(0, Math.floor((sm - startH * 60) / 30));
      const ei = Math.min(slots, Math.ceil((em - startH * 60) / 30));
      const cell = grid.querySelector(`.b-cell[data-d="${day}"][data-m="${startH * 60 + si * 30}"]`);
      if (!cell) return;
      const block = document.createElement('div');
      block.className = 'b-block';
      block.dataset.cid = c.id;
      block.style.background = c.color || COLORS[0];
      block.style.height = Math.max((ei - si) * cellH - 2, 16) + 'px';
      block.style.cursor = 'pointer';
      block.innerHTML = `${Util.esc(c.sub)}${c.lab ? ' (L)' : ''}`;
      block.title = `${c.sub} ${Util.t12(c.start)}–${Util.t12(c.end)}`;
      block.onclick = (e) => { e.stopPropagation(); this.showClassDetail(c.id); };
      cell.appendChild(block);
    });
  }

  showClassDetail(cid) {
    const c = this.state.classes.find(x => x.id === cid);
    if (!c) return;
    const dayName = DAYS_FULL[+c.day] || '';
    Dom.byId('dlgTitle').textContent = 'Class';
    Dom.byId('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-color" style="background:${c.color || COLORS[0]}"></div>
      <div class="cd-title">${Util.esc(c.sub)}${c.lab ? ' <span class="tag">Lab</span>' : ''}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Day</span><span class="cd-v">${dayName}</span></div>
        <div class="cd-row"><span class="cd-k">Time</span><span class="cd-v">${Util.t12(c.start)} – ${Util.t12(c.end)}</span></div>
        <div class="cd-row"><span class="cd-k">Room</span><span class="cd-v">${c.room ? Util.esc(c.room) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Instructor</span><span class="cd-v">${c.inst ? Util.esc(c.inst) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editClassBtn">Edit</button>
        <button class="btn btn-ghost" id="delClassBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editClassBtn').onclick = () => {
      Dom.byId('backdrop').classList.remove('open');
      this.openClassForm(c);
    };
    Dom.byId('delClassBtn').onclick = () => {
      if (!confirm('Delete this class?')) return;
      this.state.classes = this.state.classes.filter(x => x.id !== cid);
      this.app.store.save();
      Dom.byId('backdrop').classList.remove('open');
      this.drawBoard(); this.app.home.drawHome(); this.app.tasks.fillSubs();
      this.app.notifications.scheduleAllClassNotifications();
    };
  }

  openClassForm(c) {
    const sheet = Dom.byId('sheetClass');
    Dom.byId('c-edit-id').value = c ? c.id : '';
    Dom.byId('c-sub').value = c ? (c.sub || '') : '';
    Dom.byId('c-room').value = c ? (c.room || '') : '';
    Dom.byId('c-inst').value = c ? (c.inst || '') : '';
    Dom.byId('c-day').value = c ? (c.day || '1') : '1';
    Dom.byId('c-start').value = c ? (c.start || '09:00') : '09:00';
    Dom.byId('c-end').value = c ? (c.end || '10:30') : '10:30';
    Dom.byId('c-lab').checked = c ? !!c.lab : false;
    Dom.byId('c-notify').checked = c ? c.notify !== false : true;
    Dom.byId('c-notify-lead').value = c && c.notifyLead ? String(c.notifyLead) : '';
    if (c && c.color) {
      this.pickColor = c.color;
      const inp = Dom.byId('c-color');
      if (inp) inp.value = c.color;
      this.chips(Dom.byId('c-chips'));
    }
    sheet.classList.add('open');
    Dom.byId('c-sub').focus();
  }

  resetClassForm() {
    Dom.byId('c-edit-id').value = '';
    Dom.byId('c-sub').value = '';
    Dom.byId('c-room').value = '';
    Dom.byId('c-inst').value = '';
    Dom.byId('c-day').value = '1';
    Dom.byId('c-start').value = '09:00';
    Dom.byId('c-end').value = '10:30';
    Dom.byId('c-lab').checked = false;
    Dom.byId('c-notify').checked = true;
    Dom.byId('c-notify-lead').value = '';
    Dom.byId('sheetClass').classList.remove('open');
  }

  setTtMode(mode) {
    this.ttMode = mode === 'events' ? 'events' : 'classes';
    document.querySelectorAll('.tt-mode').forEach(b => {
      b.classList.toggle('on', b.dataset.ttMode === this.ttMode);
    });
    const title = Dom.byId('ttPageTitle');
    if (title) title.textContent = this.ttMode === 'events' ? 'Events' : 'Timetable';
    const classesMode = Dom.byId('classesMode');
    const eventsMode = Dom.byId('eventsMode');
    const btnClass = Dom.byId('btnAddClass');
    const btnEvent = Dom.byId('btnAddEvent');
    if (this.ttMode === 'events') {
      if (classesMode) { classesMode.hidden = true; classesMode.style.display = 'none'; }
      if (eventsMode) { eventsMode.hidden = false; eventsMode.style.display = ''; }
      if (btnClass) { btnClass.hidden = true; btnClass.style.display = 'none'; }
      if (btnEvent) { btnEvent.hidden = false; btnEvent.style.display = ''; }
      this.app.events.drawEvents();
    } else {
      if (classesMode) { classesMode.hidden = false; classesMode.style.display = ''; }
      if (eventsMode) { eventsMode.hidden = true; eventsMode.style.display = 'none'; }
      if (btnClass) { btnClass.hidden = false; btnClass.style.display = ''; }
      if (btnEvent) { btnEvent.hidden = true; btnEvent.style.display = 'none'; }
      this.drawBoard();
    }
  }
}
