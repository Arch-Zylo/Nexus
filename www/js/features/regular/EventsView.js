import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class EventsView extends Component {
  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    Dom.byId('btnAddEvent')?.addEventListener('click', () => {
      const sheet = Dom.byId('sheetEvent');
      if (sheet.classList.contains('open')) this.resetEventForm();
      else this.openEventForm(null);
    });
    Dom.byId('cancelEvent')?.addEventListener('click', () => this.resetEventForm());
    Dom.byId('saveEvent')?.addEventListener('click', () => {
      const title = Dom.byId('e-title').value.trim();
      if (!title) { Dom.byId('e-title').focus(); return; }
      const editId = Dom.byId('e-edit-id').value;
      const payload = {
        title,
        date: Dom.byId('e-date').value || Util.today(),
        time: Dom.byId('e-time').value || '',
        loc: Dom.byId('e-loc').value.trim(),
        notes: Dom.byId('e-notes').value.trim()
      };
      this.state.events = this.state.events || [];
      if (editId) {
        const idx = this.state.events.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.events[idx] = { ...this.state.events[idx], ...payload };
        this.app.store.save(); this.app.store.log(`Event updated · ${title}`, COLORS[2]);
      } else {
        this.state.events.push({ id: Util.id(), ...payload });
        this.app.store.save(); this.app.store.log(`Event · ${title}`, COLORS[2]);
      }
      this.resetEventForm();
      this.drawEvents(); this.app.home.drawHome();
    });
  }

  drawEvents() {
    const list = Dom.byId('eventList');
    if (!list) return;
    this.state.events = this.state.events || [];
    const items = [...this.state.events].sort((a, b) => {
      const da = (a.date || '') + (a.time || '');
      const db = (b.date || '') + (b.time || '');
      return da.localeCompare(db);
    });
    list.innerHTML = items.length ? items.map(e => {
      const d = e.date ? Util.daysOut(e.date) : null;
      const dateLabel = e.date
        ? Util.parseD(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'No date';
      const timeLabel = e.time ? Util.t12(e.time) : '';
      const when = d === null ? '' : d === 0 ? ' · Today' : d === 1 ? ' · Tomorrow' : d < 0 ? ' · Past' : ` · in ${d}d`;
      return `<div class="event-card" data-eid="${e.id}">
      <div class="ev-title">${Util.esc(e.title)}</div>
      <div class="ev-meta">${Util.esc(dateLabel)}${timeLabel ? ' · ' + timeLabel : ''}${e.loc ? ' · ' + Util.esc(e.loc) : ''}${when}</div>
      ${e.notes ? `<div class="ev-notes">${Util.esc(e.notes)}</div>` : ''}
    </div>`;
    }).join('') : '<div class="empty">No events yet — tap + Event</div>';

    list.querySelectorAll('[data-eid]').forEach(card => {
      card.onclick = () => this.showEventDetail(card.dataset.eid);
    });
  }

  showEventDetail(eid) {
    const e = (this.state.events || []).find(x => x.id === eid);
    if (!e) return;
    const dateLabel = e.date
      ? Util.parseD(e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    Dom.byId('dlgTitle').textContent = 'Event';
    Dom.byId('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${Util.esc(e.title)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Date</span><span class="cd-v">${Util.esc(dateLabel)}</span></div>
        <div class="cd-row"><span class="cd-k">Time</span><span class="cd-v">${e.time ? Util.t12(e.time) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Location</span><span class="cd-v">${e.loc ? Util.esc(e.loc) : '—'}</span></div>
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${e.notes ? Util.esc(e.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editEventBtn">Edit</button>
        <button class="btn btn-ghost" id="delEventBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editEventBtn').onclick = () => {
      Dom.byId('backdrop').classList.remove('open');
      this.openEventForm(e);
    };
    Dom.byId('delEventBtn').onclick = () => {
      if (!confirm('Delete this event?')) return;
      this.state.events = this.state.events.filter(x => x.id !== eid);
      this.app.store.save();
      Dom.byId('backdrop').classList.remove('open');
      this.drawEvents(); this.app.home.drawHome();
    };
  }

  openEventForm(e) {
    Dom.byId('e-edit-id').value = e ? e.id : '';
    Dom.byId('e-title').value = e ? (e.title || '') : '';
    Dom.byId('e-date').value = e ? (e.date || Util.today()) : Util.today();
    Dom.byId('e-time').value = e ? (e.time || '15:00') : '15:00';
    Dom.byId('e-loc').value = e ? (e.loc || '') : '';
    Dom.byId('e-notes').value = e ? (e.notes || '') : '';
    Dom.byId('sheetEvent').classList.add('open');
    Dom.byId('e-title').focus();
  }

  resetEventForm() {
    Dom.byId('e-edit-id').value = '';
    Dom.byId('e-title').value = '';
    Dom.byId('e-date').value = Util.today();
    Dom.byId('e-time').value = '15:00';
    Dom.byId('e-loc').value = '';
    Dom.byId('e-notes').value = '';
    Dom.byId('sheetEvent').classList.remove('open');
  }
}
