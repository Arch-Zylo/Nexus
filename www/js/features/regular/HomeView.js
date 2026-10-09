import { Component } from '../../core/Component.js';
import { COLORS } from '../../core/constants.js';
import { Util } from '../../core/Util.js';
import { Dom } from '../../core/Dom.js';

export class HomeView extends Component {
  drawHome() {
    const now = new Date();
    const dow = now.getDay();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const cashAccs = this.state.accounts.filter(a => a.type === 'cash');
    const totalCash = cashAccs.reduce((s,a) => s + Util.bal(a), 0);
    const entries = cashAccs.reduce((s,a) => s + (a.tx||[]).length, 0);
    const open = this.state.tasks.filter(t => !t.done).length;
    const up = this.state.tasks.filter(t => !t.done && Util.daysOut(t.due) >= 0).length;

    // Classes left today: today's classes that haven't started yet — an
    // ongoing class (already started, not yet ended) no longer counts as
    // "left". Naturally counts down through the day, and is 0 on weekends
    // since there are no Sat/Sun classes in the timetable.
    const todaysAllClasses = this.state.classes.filter(c => +c.day === dow);
    const classesLeftToday = todaysAllClasses.filter(c => Util.mins(c.start) > nowMins).length;

    const tilesHtml = [
      { label:'On Hand', value: this.app.store.money(totalCash), color: COLORS[4], primary: true, cls: '' },
      { label:'Open Tasks', value: open, color: COLORS[1], cls: 'metric-opentasks' },
      { label:'Classes Left', value: classesLeftToday, color: COLORS[3], cls: 'metric-classesleft' },
    ].map(m => `
    <div class="metric${m.primary ? ' primary' : ''}${m.cls ? ' '+m.cls : ''}">
      <div class="accent" style="background:${m.color}"></div>
      <div class="label">${m.label}</div>
      <div class="value">${m.value}</div>
    </div>`).join('');

    const spend = this.app.spending.computeSpendBreakdown();
    const spendPie = spend.spendTotal
      ? `background:conic-gradient(${spend.stops.join(', ')});`
      : `background:${COLORS[7]};opacity:0.25;`;
    const centerHtml = spend.spendTotal
      ? `<div class="donut-center"><div class="donut-total">${this.app.store.money(spend.spendTotal)}</div><div class="donut-sub">spent</div></div>`
      : `<div class="donut-center"><div class="donut-sub">No spend</div></div>`;
    const spendTile = `
    <div class="metric metric-spend" id="metricSpend" style="cursor:pointer;" title="Spending by category">
      <div class="spend-pie" style="${spendPie}"><div class="donut-hole">${centerHtml}</div></div>
    </div>`;

    Dom.byId('metrics').innerHTML = tilesHtml + spendTile;
    Dom.byId('metricSpend').onclick = () => this.app.spending.showSpendingDetail();

    // Today classes
    const todays = this.state.classes.filter(c => +c.day === dow).sort((a,b)=>Util.mins(a.start)-Util.mins(b.start));
    Dom.byId('todayClasses').innerHTML = todays.length
      ? todays.map(c => `
      <div class="row">
        <span class="dot" style="background:${c.color}"></span>
        <div class="row-main">
          <div class="row-title">${Util.esc(c.sub)}${c.lab?' (Lab)':''}</div>
          ${c.room?`<div class="row-sub">${Util.esc(c.room)}</div>`:''}
        </div>
        <span class="row-meta">${Util.t12(c.start)}–${Util.t12(c.end)}</span>
      </div>`).join('')
      : '<div class="empty">No classes today</div>';

    // Due soon
    const due = [...this.state.tasks].filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
    Dom.byId('dueSoon').innerHTML = due.length
      ? due.map(t => {
          const d = Util.daysOut(t.due);
          return `<div class="row">
          <span class="dot" style="background:${d<0?COLORS[1]:COLORS[0]}"></span>
          <div class="row-main"><div class="row-title">${Util.esc(t.title)}</div></div>
          <span class="row-meta">${d<0?'Overdue':Util.rel(d)}</span>
        </div>`;
        }).join('')
      : '<div class="empty">Nothing due</div>';

    // Upcoming events
    const upcomingEvents = [...(this.state.events || [])]
      .filter(e => !e.date || Util.daysOut(e.date) >= 0)
      .sort((a, b) => ((a.date||'') + (a.time||'')).localeCompare((b.date||'') + (b.time||'')))
      .slice(0, 5);
    Dom.byId('upcomingEvents').innerHTML = upcomingEvents.length
      ? upcomingEvents.map(e => {
          const d = e.date ? Util.daysOut(e.date) : null;
          const when = d === null ? '' : Util.rel(d);
          return `<div class="row">
          <span class="dot" style="background:${COLORS[2]}"></span>
          <div class="row-main">
            <div class="row-title">${Util.esc(e.title)}</div>
            ${e.loc ? `<div class="row-sub">${Util.esc(e.loc)}</div>` : ''}
          </div>
          <span class="row-meta">${when}${e.time ? ' · ' + Util.t12(e.time) : ''}</span>
        </div>`;
        }).join('')
      : '<div class="empty">No upcoming events</div>';

    // Coming up (future tasks as stand-in + people birthdays this month)
    const month = now.getMonth()+1;
    const bdays = this.state.people.filter(p => p.bday && +p.bday.split('-')[1] === month)
      .sort((a,b)=>+a.bday.split('-')[2]-+b.bday.split('-')[2]);
    Dom.byId('comingUp').innerHTML = bdays.length
      ? bdays.map(p => `
      <div class="row">
        <span class="dot" style="background:${COLORS[6]}"></span>
        <div class="row-main"><div class="row-title">${Util.esc(p.first)} ${Util.esc(p.last)}</div></div>
        <span class="row-meta">${Util.parseD(p.bday).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${Util.rel(Util.daysUntilBirthday(p.bday))}</span>
      </div>`).join('')
      : '<div class="empty">No birthdays this month</div>';

    // Recent
    const logs = (this.state.log||[]).slice(0,6);
    Dom.byId('recentLog').innerHTML = logs.length
      ? logs.map(l => `
      <div class="row">
        <span class="dot" style="background:${l.color}"></span>
        <div class="row-main">
          <div class="row-title">${Util.esc(l.msg)}</div>
          <div class="row-sub">${Util.ago(l.ts)}</div>
        </div>
      </div>`).join('')
      : '<div class="empty">Activity will appear here</div>';
  }
}
