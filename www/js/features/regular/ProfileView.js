import { Component } from '../../core/Component.js';
import { Dom } from '../../core/Dom.js';

/** The Profile page: your name and school (edited inline) plus a few counts from your data. */
export class ProfileView extends Component {
  init() {
    Dom.byId('pf-save')?.addEventListener('click', this.save);
    ['pf-name', 'pf-school'].forEach(id => Dom.byId(id)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.save(); } }));
  }

  draw() {
    const name = (this.state.name || '').trim(), school = (this.state.school || '').trim();
    const set = (id, v) => { const e = Dom.byId(id); if (e) e.textContent = v; };
    set('profileAvatar', (name[0] || 'N').toUpperCase());
    set('profileName', name || 'Student');
    set('profileSchool', school || 'No school set');
    const nm = Dom.byId('pf-name'), sc = Dom.byId('pf-school');
    if (nm) nm.value = name;
    if (sc) sc.value = school;
    const s = this.state;
    const stats = [
      [(s.classes || []).length, 'Classes'],
      [(s.tasks || []).filter(t => !t.done).length, 'Open tasks'],
      [(s.notes || []).length, 'Notes'],
      [(s.people || []).length, 'People']
    ];
    const host = Dom.byId('profileStats');
    if (host) host.innerHTML = stats.map(([n, l]) => `<div class="pf-stat"><div class="pf-stat-n">${n}</div><div class="pf-stat-l">${l}</div></div>`).join('');
  }

  save() {
    this.state.name = (Dom.byId('pf-name').value || '').trim();
    this.state.school = (Dom.byId('pf-school').value || '').trim();
    this.app.store.save();
    this.app.settings.refreshSettingsUI();
    this.app.shell.tick();
    this.draw();
    this.app.toast.show('Profile saved');
  }
}
