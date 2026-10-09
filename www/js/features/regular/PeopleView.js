import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class PeopleView extends Component {
  /** @param {import('../../core/App.js').App} app */
  constructor(app) {
    super(app);
    this.peopleSortMode = 'first';
  }

  /** Wires DOM events and applies initial state. Called once by App.start(). */
  init() {
    document.querySelectorAll('#peopleSort .sort-link').forEach(btn => {
      btn.onclick = () => {
        this.peopleSortMode = btn.dataset.sort;
        document.querySelectorAll('#peopleSort .sort-link').forEach(b => b.classList.toggle('on', b === btn));
        this.drawPeople();
      };
    });
    Dom.byId('btnAddPerson').onclick = () => {
      const sheet = Dom.byId('sheetPerson');
      if (sheet.classList.contains('open')) this.resetPersonForm();
      else this.openPersonForm(null);
    };
    Dom.byId('cancelPerson').onclick = () => this.resetPersonForm();
    Dom.byId('savePerson').onclick = () => {
      const first = Dom.byId('p-first').value.trim();
      if (!first) { Dom.byId('p-first').focus(); return; }
      const editId = Dom.byId('p-edit-id').value;
      const payload = {
        first,
        last: Dom.byId('p-last').value.trim(),
        bday: Dom.byId('p-bday').value || '',
        notes: Dom.byId('p-notes').value.trim()
      };
      if (editId) {
        const idx = this.state.people.findIndex(x => x.id === editId);
        if (idx >= 0) this.state.people[idx] = { ...this.state.people[idx], ...payload };
        this.app.store.save(); this.app.store.log(`Person updated · ${first}`, COLORS[2]);
      } else {
        this.state.people.push({ id: Util.id(), ...payload });
        this.app.store.save(); this.app.store.log(`Person · ${first}`, COLORS[2]);
      }
      this.resetPersonForm();
      this.drawPeople(); this.app.home.drawHome();
    };
    Dom.byId('deletePerson').onclick = () => {
      const editId = Dom.byId('p-edit-id').value;
      if (!editId) return;
      const p = this.state.people.find(x => x.id === editId);
      const nm = p ? `${p.first} ${p.last}`.trim() : 'this person';
      if (!confirm(`Delete ${nm}?`)) return;
      this.state.people = this.state.people.filter(x => x.id !== editId);
      this.app.store.save();
      this.resetPersonForm();
      this.drawPeople(); this.app.home.drawHome();
    };
  }

  drawPeople() {
    const list = Dom.byId('peopleList');
    const sort = this.peopleSortMode;
    let items = [...this.state.people];
    if (sort === 'first') items.sort((a,b) => (a.first||'').localeCompare(b.first||''));
    else if (sort === 'last') items.sort((a,b) => (a.last||'').localeCompare(b.last||''));
    else if (sort === 'bday') {
      const withB = items.filter(p => p.bday);
      const noB = items.filter(p => !p.bday);
      const year = new Date().getFullYear();
      withB.sort((a,b) => {
        const da = Util.daysOut(a.bday.replace(/^\d{4}/, String(year)));
        const db = Util.daysOut(b.bday.replace(/^\d{4}/, String(year)));
        const na = da < 0 ? da + 365 : da;
        const nb = db < 0 ? db + 365 : db;
        return na - nb;
      });
      items = withB.concat(noB);
    }
    list.innerHTML = items.length ? items.map(p => {
      const age = p.bday ? Util.personAge(p.bday) : null;
      const dLeft = p.bday ? Util.daysUntilBirthday(p.bday) : null;
      const bdayText = dLeft === null ? '' : dLeft === 0 ? 'Today' : dLeft === 1 ? 'Tomorrow' : `${dLeft} days left`;
      return `<div class="card" data-pid="${p.id}" style="cursor:pointer;">
      <div class="card-bar" style="background:${COLORS[2]}"></div>
      <div class="card-body">
        <div class="card-title">${Util.esc(p.first)} ${Util.esc(p.last)}</div>
        ${p.bday?`<div class="card-info">❀ ${Util.parseD(p.bday).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · Age ${age} · ${bdayText}</div>`:''}
        ${p.notes?`<div class="card-note">${Util.esc(p.notes)}</div>`:''}
      </div>
    </div>`;
    }).join('') : '<div class="empty">No people yet</div>';

    list.querySelectorAll('[data-pid]').forEach(card => {
      card.onclick = () => this.showPersonDetail(card.dataset.pid);
    });
  }

  showPersonDetail(pid) {
    const p = this.state.people.find(x => x.id === pid);
    if (!p) return;
    const age = p.bday ? Util.personAge(p.bday) : null;
    const dLeft = p.bday ? Util.daysUntilBirthday(p.bday) : null;
    const turningAge = dLeft === 0 ? age : age + 1;
    const nextBdayText = dLeft === null ? '' : dLeft === 0 ? 'Today 🎉' : dLeft === 1 ? 'Tomorrow' : `In ${dLeft} days`;
    Dom.byId('dlgTitle').textContent = 'Person';
    Dom.byId('dlgBody').innerHTML = `
    <div class="class-detail">
      <div class="cd-title">${Util.esc(p.first)} ${Util.esc(p.last)}</div>
      <div class="cd-rows">
        <div class="cd-row"><span class="cd-k">Birthday</span><span class="cd-v">${p.bday ? Util.parseD(p.bday).toLocaleDateString('en-US',{month:'long',day:'numeric'}) : '—'}</span></div>
        ${p.bday ? `<div class="cd-row"><span class="cd-k">Age</span><span class="cd-v">${age} years old</span></div>` : ''}
        ${p.bday ? `<div class="cd-row"><span class="cd-k">Next birthday</span><span class="cd-v">${nextBdayText} · turns ${turningAge}</span></div>` : ''}
        <div class="cd-row"><span class="cd-k">Notes</span><span class="cd-v">${p.notes ? Util.esc(p.notes) : '—'}</span></div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-gold" id="editPersonBtn">Edit</button>
        <button class="btn btn-ghost" id="delPersonBtn" style="color:var(--coral);border-color:rgba(240,113,120,0.35);">Delete</button>
      </div>
    </div>`;
    Dom.byId('backdrop').classList.add('open');
    Dom.byId('editPersonBtn').onclick = () => {
      Dom.byId('backdrop').classList.remove('open');
      this.openPersonForm(p);
    };
    Dom.byId('delPersonBtn').onclick = () => {
      const nm = `${p.first} ${p.last}`.trim() || 'this person';
      if (!confirm(`Delete ${nm}?`)) return;
      this.state.people = this.state.people.filter(x => x.id !== pid);
      this.app.store.save();
      Dom.byId('backdrop').classList.remove('open');
      this.drawPeople(); this.app.home.drawHome();
    };
  }

  openPersonForm(p) {
    Dom.byId('p-edit-id').value = p ? p.id : '';
    Dom.byId('p-first').value = p ? (p.first || '') : '';
    Dom.byId('p-last').value = p ? (p.last || '') : '';
    Dom.byId('p-bday').value = p ? (p.bday || '') : '';
    Dom.byId('p-notes').value = p ? (p.notes || '') : '';
    Dom.byId('deletePerson').hidden = !p;
    Dom.byId('sheetPerson').classList.add('open');
    Dom.byId('p-first').focus();
  }

  resetPersonForm() {
    Dom.byId('p-edit-id').value = '';
    Dom.byId('p-first').value = '';
    Dom.byId('p-last').value = '';
    Dom.byId('p-bday').value = '';
    Dom.byId('p-notes').value = '';
    Dom.byId('deletePerson').hidden = true;
    Dom.byId('sheetPerson').classList.remove('open');
  }
}
